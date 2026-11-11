import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import * as Handlebars from 'handlebars';
import { GeneratedContent, PublishStatus } from '../entities/generated-content.entity';
import { Project } from '../entities/project.entity';
import { PublishJob, JobStatus } from '../entities/publish-job.entity';
import { CsvRow } from '../entities/csv-row.entity';

@Processor('content-generation')
export class ContentGenerationProcessor {
    private readonly logger = new Logger(ContentGenerationProcessor.name);

    constructor(
        @InjectRepository(GeneratedContent)
        private contentRepository: Repository<GeneratedContent>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(CsvRow)
        private csvRowRepository: Repository<CsvRow>,
    ) { }

    @Process('generate-content')
    async handleGeneration(job: Job) {
        const { projectId, asDraft } = job.data;
        this.logger.log(`Starting content generation for project ${projectId}${asDraft ? ' (as draft)' : ''}`);

        // Fetch project WITHOUT loading csvRows relation
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        // Delete existing content
        await this.contentRepository.delete({ projectId });

        const contentTemplate = Handlebars.compile(project.template);
        const titleTemplate = project.titleTemplate ? Handlebars.compile(project.titleTemplate) : null;
        const metaTemplate = project.metaDescriptionTemplate
            ? Handlebars.compile(project.metaDescriptionTemplate)
            : null;
        const tagsTemplate = project.tagsTemplate ? Handlebars.compile(project.tagsTemplate) : null;

        // Count total rows
        const total = await this.csvRowRepository.count({
            where: { projectId },
        });

        // Process rows in batches
        const BATCH_SIZE = 100;
        let processedCount = 0;
        let offset = 0;

        while (offset < total) {
            const rows = await this.csvRowRepository.find({
                where: { projectId },
                order: { rowOrder: 'ASC' },
                skip: offset,
                take: BATCH_SIZE,
            });

            const contentBatch: GeneratedContent[] = [];

            for (const row of rows) {
                const data = row.rowData;

                const content = contentTemplate(data);
                const title = titleTemplate ? titleTemplate(data) : String(Object.values(data)[0]);
                const metaDescription = metaTemplate ? metaTemplate(data) : '';
                const tags = tagsTemplate ? tagsTemplate(data) : '';
                const slug = this.generateSlug(title, row.id);

                const generatedContent = this.contentRepository.create({
                    projectId,
                    content,
                    title,
                    metaDescription,
                    tags,
                    slug,
                    publishStatus: asDraft ? PublishStatus.DRAFT : PublishStatus.PENDING,
                });

                contentBatch.push(generatedContent);
            }

            // Batch save
            await this.contentRepository.save(contentBatch);
            processedCount += contentBatch.length;
            offset += rows.length;

            // Update progress
            await job.progress((processedCount / total) * 100);
        }

        this.logger.log(`Completed content generation for project ${projectId}`);
        return { generated: processedCount };
    }

    private generateSlug(title: string, id: string): string {
        const slugified = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `${slugified}-${id.substring(0, 8)}`;
    }
}

@Processor('content-publishing')
export class ContentPublishingProcessor {
    private readonly logger = new Logger(ContentPublishingProcessor.name);

    constructor(
        @InjectRepository(GeneratedContent)
        private contentRepository: Repository<GeneratedContent>,
        @InjectRepository(PublishJob)
        private publishJobRepository: Repository<PublishJob>,
    ) { }

    @Process('publish-content')
    async handlePublishing(job: Job) {
        const { projectId, delaySeconds } = job.data;
        this.logger.log(`Starting content publishing for project ${projectId} with ${delaySeconds}s delay`);

        // Create publish job record
        const contents = await this.contentRepository.find({
            where: { projectId, publishStatus: PublishStatus.PENDING },
        });

        const publishJob = this.publishJobRepository.create({
            projectId,
            status: JobStatus.PROCESSING,
            totalContents: contents.length,
            processedCount: 0,
            delaySeconds,
        });

        await this.publishJobRepository.save(publishJob);

        try {
            for (let i = 0; i < contents.length; i++) {
                const content = contents[i];

                // Simulate delay to avoid spam
                if (i > 0 && delaySeconds > 0) {
                    await this.sleep(delaySeconds * 1000);
                }

                // Mark as published, only if it is still pending (it may have been drafted meanwhile)
                await this.contentRepository.update(
                    { id: content.id, publishStatus: PublishStatus.PENDING },
                    { publishStatus: PublishStatus.PUBLISHED, publishedAt: new Date() },
                );

                // Update job progress
                publishJob.processedCount = i + 1;
                await this.publishJobRepository.save(publishJob);
                await job.progress((i + 1) / contents.length * 100);
            }

            publishJob.status = JobStatus.COMPLETED;
            await this.publishJobRepository.save(publishJob);

            this.logger.log(`Completed content publishing for project ${projectId}`);
            return { published: contents.length };
        } catch (error) {
            publishJob.status = JobStatus.FAILED;
            publishJob.errorMessage = error.message;
            await this.publishJobRepository.save(publishJob);
            throw error;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
