import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PublishJob, JobStatus } from '../../entities/publish-job.entity';
import { Project } from '../../entities/project.entity';
import { Organization } from '../../entities/organization.entity';

@Injectable()
export class AdminJobsService {
    constructor(
        @InjectRepository(PublishJob)
        private publishJobRepository: Repository<PublishJob>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
    ) { }

    async findAll(
        page: number = 1,
        limit: number = 20,
        status?: JobStatus,
        projectId?: string,
    ) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) {
            where.status = status;
        }
        if (projectId) {
            where.projectId = projectId;
        }

        const [jobs, total] = await this.publishJobRepository.findAndCount({
            where,
            take: limit,
            skip,
            order: { createdAt: 'DESC' },
        });

        // Batch-load related projects/organizations instead of querying per job (avoids N+1).
        const projectIds = [...new Set(jobs.map((job) => job.projectId).filter(Boolean))];
        const projects = projectIds.length
            ? await this.projectRepository.find({ where: { id: In(projectIds) } })
            : [];
        const projectMap = new Map(projects.map((p) => [p.id, p]));

        const orgIds = [...new Set(projects.map((p) => p.organizationId).filter(Boolean))];
        const organizations = orgIds.length
            ? await this.organizationRepository.find({ where: { id: In(orgIds) } })
            : [];
        const orgMap = new Map(organizations.map((o) => [o.id, o]));

        const jobsWithInfo = jobs.map((job) => {
            const project = projectMap.get(job.projectId) ?? null;
            const organization = project ? orgMap.get(project.organizationId) ?? null : null;

            return {
                ...job,
                project: project ? {
                    id: project.id,
                    name: project.name,
                } : null,
                organization: organization ? {
                    id: organization.id,
                    name: organization.name,
                } : null,
            };
        });

        return {
            data: jobsWithInfo,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getJobDetails(id: string) {
        const job = await this.publishJobRepository.findOne({ where: { id } });
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const project = await this.projectRepository.findOne({
            where: { id: job.projectId },
        });

        let organization: Organization | null = null;
        if (project) {
            organization = await this.organizationRepository.findOne({
                where: { id: project.organizationId },
            });
        }

        return {
            ...job,
            project: project ? {
                id: project.id,
                name: project.name,
                organizationId: project.organizationId,
            } : null,
            organization: organization ? {
                id: organization.id,
                name: organization.name,
            } : null,
        };
    }

    async pauseJob(id: string) {
        const job = await this.publishJobRepository.findOne({ where: { id } });
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== JobStatus.PROCESSING && job.status !== JobStatus.PENDING) {
            throw new NotFoundException('Can only pause pending or processing jobs');
        }

        job.status = JobStatus.PAUSED;
        return await this.publishJobRepository.save(job);
    }

    async resumeJob(id: string) {
        const job = await this.publishJobRepository.findOne({ where: { id } });
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== JobStatus.PAUSED) {
            throw new NotFoundException('Can only resume paused jobs');
        }

        job.status = JobStatus.PENDING;
        return await this.publishJobRepository.save(job);
    }

    async cancelJob(id: string) {
        const job = await this.publishJobRepository.findOne({ where: { id } });
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status === JobStatus.COMPLETED) {
            throw new NotFoundException('Cannot cancel completed job');
        }

        job.status = JobStatus.CANCELLED;
        return await this.publishJobRepository.save(job);
    }

    async deleteJob(id: string) {
        const job = await this.publishJobRepository.findOne({ where: { id } });
        if (!job) {
            throw new NotFoundException('Job not found');
        }

        await this.publishJobRepository.remove(job);
        return { message: 'Job deleted successfully' };
    }
}
