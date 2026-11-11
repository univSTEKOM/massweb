import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GeneratedContent, PublishStatus } from '../entities/generated-content.entity';
import { PublishJob, JobStatus } from '../entities/publish-job.entity';

@Injectable()
export class PublishSchedulerService {
    private readonly logger = new Logger(PublishSchedulerService.name);

    constructor(
        @InjectRepository(GeneratedContent)
        private contentRepository: Repository<GeneratedContent>,
        @InjectRepository(PublishJob)
        private publishJobRepository: Repository<PublishJob>,
    ) { }

    // Run every 30 seconds to check for pending publish jobs
    @Cron(CronExpression.EVERY_30_SECONDS)
    async processPublishJobs() {
        // Find pending publish jobs (skip paused ones)
        const pendingJobs = await this.publishJobRepository.find({
            where: { status: JobStatus.PENDING },
            order: { createdAt: 'ASC' },
            take: 1, // Process one job at a time
        });

        if (pendingJobs.length === 0) {
            return;
        }

        const job = pendingJobs[0];
        this.logger.log(`Processing publish job ${job.id} for project ${job.projectId}`);

        try {
            // Mark job as processing
            job.status = JobStatus.PROCESSING;
            job.startedAt = new Date();
            await this.publishJobRepository.save(job);

            // Get all pending content for this project
            const contents = await this.contentRepository.find({
                where: { projectId: job.projectId, publishStatus: PublishStatus.PENDING },
            });

            job.totalContents = contents.length;
            await this.publishJobRepository.save(job);

            // Persist job progress at most every PROGRESS_SAVE_INTERVAL items (plus the final one)
            // instead of on every item, to avoid thousands of UPDATE queries per large job.
            const PROGRESS_SAVE_INTERVAL = 25;

            // Publish each content item
            for (let i = 0; i < contents.length; i++) {
                const content = contents[i];

                // Add delay between items (except for the first one)
                if (i > 0 && job.delaySeconds > 0) {
                    await this.sleep(job.delaySeconds * 1000);
                }

                // Respect pause/cancel requested while this job is running. Checked on every
                // item when there is a delay (cheap relative to the sleep), otherwise periodically.
                if (job.delaySeconds > 0 || i % PROGRESS_SAVE_INTERVAL === 0) {
                    const current = await this.publishJobRepository.findOne({
                        where: { id: job.id },
                        select: ['id', 'status'],
                    });
                    if (current && (current.status === JobStatus.PAUSED || current.status === JobStatus.CANCELLED)) {
                        await this.publishJobRepository.update(job.id, { processedCount: i });
                        this.logger.log(`Publish job ${job.id} ${current.status} at ${i}/${contents.length}`);
                        return;
                    }
                }

                // Targeted update: only publish if the item is still pending.
                // Items moved to draft (or published manually) after the job started are skipped.
                await this.contentRepository.update(
                    { id: content.id, publishStatus: PublishStatus.PENDING },
                    { publishStatus: PublishStatus.PUBLISHED, publishedAt: new Date() },
                );

                // Update job progress periodically (and always on the last item).
                // Use update() on the progress column only so a concurrent pause/cancel is not overwritten.
                job.processedCount = i + 1;
                if ((i + 1) % PROGRESS_SAVE_INTERVAL === 0 || i === contents.length - 1) {
                    await this.publishJobRepository.update(job.id, { processedCount: job.processedCount });
                }

                this.logger.log(`Published ${i + 1}/${contents.length} items for job ${job.id}`);
            }

            // Mark job as completed
            await this.publishJobRepository.update(job.id, {
                status: JobStatus.COMPLETED,
                processedCount: contents.length,
                completedAt: new Date(),
            });

            this.logger.log(`Completed publish job ${job.id} - published ${contents.length} items`);
        } catch (error) {
            this.logger.error(`Failed to process publish job ${job.id}:`, error);
            job.status = JobStatus.FAILED;
            job.errorMessage = error.message;
            await this.publishJobRepository.save(job);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
