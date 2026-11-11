import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, MoreThanOrEqual } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as Handlebars from 'handlebars';
import { GeneratedContent, PublishStatus } from '../entities/generated-content.entity';
import { Project } from '../entities/project.entity';
import { CsvRow } from '../entities/csv-row.entity';
import { PublishJob, JobStatus } from '../entities/publish-job.entity';

@Injectable()
export class ContentGeneratorService {
    constructor(
        @InjectRepository(GeneratedContent)
        private contentRepository: Repository<GeneratedContent>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(CsvRow)
        private csvRowRepository: Repository<CsvRow>,
        @InjectRepository(PublishJob)
        private publishJobRepository: Repository<PublishJob>,
        @InjectQueue('content-generation')
        private generationQueue: Queue,
        @InjectQueue('content-publishing')
        private publishQueue: Queue,
    ) { }

    async generateContent(projectId: string, asDraft = false): Promise<{ jobId: string; totalRows: number }> {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        // Count rows instead of loading them all
        const totalRows = await this.csvRowRepository.count({
            where: { projectId },
        });

        const job = await this.generationQueue.add('generate-content', {
            projectId,
            totalRows,
            asDraft,
        });

        return {
            jobId: job.id.toString(),
            totalRows,
        };
    }

    async generateContentSync(projectId: string, asDraft = false): Promise<{ generatedCount: number }> {
        // Fetch project
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        // Clear existing generated content
        await this.contentRepository.delete({ projectId });

        // Compile templates once
        const contentTemplate = Handlebars.compile(project.template);
        const titleTemplate = project.titleTemplate ? Handlebars.compile(project.titleTemplate) : null;
        const metaDescriptionTemplate = project.metaDescriptionTemplate
            ? Handlebars.compile(project.metaDescriptionTemplate)
            : null;
        const tagsTemplate = project.tagsTemplate ? Handlebars.compile(project.tagsTemplate) : null;

        // Process rows in batches to avoid memory issues
        const FETCH_BATCH_SIZE = 500;
        const SAVE_BATCH_SIZE = 100;
        let offset = 0;
        let hasMore = true;
        let generatedCount = 0;
        let currentBatch: GeneratedContent[] = [];
        const usedSlugs = new Set<string>();

        while (hasMore) {
            const rows = await this.csvRowRepository.find({
                where: { projectId },
                order: { rowOrder: 'ASC' },
                skip: offset,
                take: FETCH_BATCH_SIZE,
            });

            if (rows.length === 0) {
                hasMore = false;
                break;
            }

            for (const row of rows) {
                const data = row.rowData;

                // Generate content
                const content = contentTemplate(data);
                const title = titleTemplate ? titleTemplate(data) : this.generateDefaultTitle(data);
                const metaDescription = metaDescriptionTemplate ? metaDescriptionTemplate(data) : '';
                const tags = tagsTemplate ? tagsTemplate(data) : '';

                // Generate slug
                const slugBase = this.generateSlug(title, '');
                let slug = slugBase;

                // Simple uniqueness check within this generation run
                // Note: For a robust system, we might need a database check or retry logic, 
                // but for mass generation from a single CSV, unique titles are usually expected.
                if (usedSlugs.has(slug)) {
                    // Try to make it unique by appending a counter or random string
                    // For now, let's skip duplicates to avoid errors, or append row order
                    slug = `${slugBase}-${row.rowOrder}`;
                }

                if (usedSlugs.has(slug)) {
                    continue; // Skip if still duplicate
                }
                usedSlugs.add(slug);

                const generatedContent = this.contentRepository.create({
                    projectId,
                    content,
                    title,
                    metaDescription,
                    tags,
                    slug,
                    thumbnailUrl: project.thumbnailUrl || undefined,
                    publishStatus: asDraft ? PublishStatus.DRAFT : PublishStatus.PENDING,
                });

                currentBatch.push(generatedContent);

                if (currentBatch.length >= SAVE_BATCH_SIZE) {
                    await this.contentRepository.save(currentBatch);
                    generatedCount += currentBatch.length;
                    currentBatch = [];
                }
            }

            offset += rows.length;
            if (rows.length < FETCH_BATCH_SIZE) {
                hasMore = false;
            }
        }

        // Save remaining items
        if (currentBatch.length > 0) {
            await this.contentRepository.save(currentBatch);
            generatedCount += currentBatch.length;
        }

        return { generatedCount };
    }

    async getGeneratedContents(
        projectId: string,
        page: number = 1,
        limit: number = 20,
        status?: PublishStatus,
        search?: string,
    ): Promise<{ contents: GeneratedContent[]; total: number; page: number; totalPages: number }> {
        const query = this.contentRepository.createQueryBuilder('content')
            .where('content.projectId = :projectId', { projectId });

        if (status) {
            query.andWhere('content.publishStatus = :status', { status });
        }

        if (search && search.trim()) {
            query.andWhere('content.title LIKE :search', { search: `%${search.trim()}%` });
        }

        const [contents, total] = await query
            .orderBy('content.createdAt', 'DESC')
            .take(limit)
            .skip((page - 1) * limit)
            .getManyAndCount();

        return {
            contents,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getContentById(id: string): Promise<GeneratedContent | null> {
        return await this.contentRepository.findOne({ where: { id } });
    }

    async updateContent(id: string, updates: Partial<GeneratedContent>): Promise<GeneratedContent> {
        const content = await this.contentRepository.findOne({ where: { id } });
        if (!content) {
            throw new Error('Content not found');
        }

        const previousStatus = content.publishStatus;
        Object.assign(content, updates);

        // Keep publishedAt consistent when the status is changed through a plain update
        if (updates.publishStatus && updates.publishStatus !== previousStatus) {
            (content as any).publishedAt =
                updates.publishStatus === PublishStatus.PUBLISHED ? new Date() : null;
        }

        return await this.contentRepository.save(content);
    }

    async deleteContent(id: string): Promise<void> {
        await this.contentRepository.delete(id);
    }

    async startPublishJob(projectId: string, delaySeconds?: number): Promise<{ jobId: string }> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new Error('Project not found');
        }

        const delay = delaySeconds ?? project.publishDelaySeconds;

        const job = await this.publishQueue.add('publish-content', {
            projectId,
            delaySeconds: delay,
        });

        return { jobId: job.id.toString() };
    }

    async startPublishJobAsync(projectId: string, delaySeconds?: number): Promise<{ jobId: string }> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new Error('Project not found');
        }

        const delay = delaySeconds ?? project.publishDelaySeconds ?? 0;

        const publishJob = this.publishJobRepository.create({
            projectId,
            status: JobStatus.PENDING,
            totalContents: 0,
            processedCount: 0,
            delaySeconds: delay,
        });

        const savedJob = await this.publishJobRepository.save(publishJob);

        return { jobId: savedJob.id };
    }

    async publishContentSync(projectId: string, delaySeconds?: number): Promise<{ published: number }> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new Error('Project not found');
        }

        const delay = delaySeconds ?? project.publishDelaySeconds ?? 0;

        const contents = await this.contentRepository.find({
            where: { projectId, publishStatus: PublishStatus.PENDING },
        });

        let publishedCount = 0;

        for (const content of contents) {
            if (publishedCount > 0 && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }

            // Only publish if it is still pending (it may have been moved to draft meanwhile)
            const result = await this.contentRepository.update(
                { id: content.id, publishStatus: PublishStatus.PENDING },
                { publishStatus: PublishStatus.PUBLISHED, publishedAt: new Date() },
            );

            if (result.affected) {
                publishedCount++;
            }
        }

        return { published: publishedCount };
    }

    async unpublishContent(contentIds: string[]): Promise<{ unpublished: number }> {
        let unpublishedCount = 0;

        for (const id of contentIds) {
            const content = await this.contentRepository.findOne({ where: { id } });
            if (content && content.publishStatus === PublishStatus.PUBLISHED) {
                content.publishStatus = PublishStatus.PENDING;
                (content as any).publishedAt = null;
                await this.contentRepository.save(content);
                unpublishedCount++;
            }
        }

        return { unpublished: unpublishedCount };
    }

    /**
     * Manual / bulk status change for selected contents.
     * - published: goes live immediately (manual publish, separate from auto-publish jobs).
     *   Items that are already published keep their original publishedAt.
     * - draft / pending: publishedAt is cleared.
     */
    async bulkUpdateStatus(contentIds: string[], status: PublishStatus): Promise<{ updated: number }> {
        this.assertManualStatus(status);
        const ids = Array.from(new Set(contentIds || [])).filter(Boolean);
        if (ids.length === 0) {
            return { updated: 0 };
        }

        let updated = 0;
        for (const chunk of this.chunk(ids, 1000)) {
            const qb = this.contentRepository
                .createQueryBuilder()
                .update(GeneratedContent)
                .where('id IN (:...ids)', { ids: chunk });

            if (status === PublishStatus.PUBLISHED) {
                qb.set({ publishStatus: status, publishedAt: () => 'CURRENT_TIMESTAMP' })
                    .andWhere('publishStatus != :published', { published: PublishStatus.PUBLISHED });
            } else {
                qb.set({ publishStatus: status, publishedAt: () => 'NULL' })
                    .andWhere('publishStatus != :status', { status });
            }

            const result = await qb.execute();
            updated += result.affected ?? 0;
        }

        return { updated };
    }

    /**
     * Mass status change for a whole project, e.g. "move every queued item to draft"
     * or "publish every draft now". Runs as a single UPDATE, independent of pagination.
     */
    async bulkUpdateProjectStatus(
        projectId: string,
        from: PublishStatus,
        to: PublishStatus,
    ): Promise<{ updated: number }> {
        this.assertManualStatus(to);
        if (!Object.values(PublishStatus).includes(from)) {
            throw new BadRequestException(`Invalid source status: ${from}`);
        }
        if (from === to) {
            return { updated: 0 };
        }

        const project = await this.projectRepository.findOne({ where: { id: projectId }, select: ['id'] });
        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const result = await this.contentRepository
            .createQueryBuilder()
            .update(GeneratedContent)
            .set({
                publishStatus: to,
                publishedAt: () => (to === PublishStatus.PUBLISHED ? 'CURRENT_TIMESTAMP' : 'NULL'),
            })
            .where('projectId = :projectId', { projectId })
            .andWhere('publishStatus = :from', { from })
            .execute();

        return { updated: result.affected ?? 0 };
    }

    async bulkDelete(contentIds: string[]): Promise<{ deleted: number }> {
        const ids = Array.from(new Set(contentIds || [])).filter(Boolean);
        let deleted = 0;
        for (const chunk of this.chunk(ids, 1000)) {
            const result = await this.contentRepository.delete({ id: In(chunk) });
            deleted += result.affected ?? 0;
        }
        return { deleted };
    }

    private assertManualStatus(status: PublishStatus) {
        const allowed = [PublishStatus.DRAFT, PublishStatus.PENDING, PublishStatus.PUBLISHED];
        if (!allowed.includes(status)) {
            throw new BadRequestException(`Status must be one of: ${allowed.join(', ')}`);
        }
    }

    private chunk<T>(items: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
        }
        return chunks;
    }

    async getPublishJobStatus(jobId: string): Promise<PublishJob> {
        const job = await this.publishJobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            throw new Error('Job not found');
        }
        return job;
    }

    async pausePublishJob(jobId: string): Promise<PublishJob> {
        const job = await this.publishJobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            throw new Error('Job not found');
        }
        if (job.status !== JobStatus.PROCESSING && job.status !== JobStatus.PENDING) {
            throw new Error('Can only pause pending or processing jobs');
        }
        job.status = JobStatus.PAUSED;
        return await this.publishJobRepository.save(job);
    }

    async resumePublishJob(jobId: string): Promise<PublishJob> {
        const job = await this.publishJobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            throw new Error('Job not found');
        }
        if (job.status !== JobStatus.PAUSED) {
            throw new Error('Can only resume paused jobs');
        }
        job.status = JobStatus.PENDING;
        return await this.publishJobRepository.save(job);
    }

    async cancelPublishJob(jobId: string): Promise<PublishJob> {
        const job = await this.publishJobRepository.findOne({ where: { id: jobId } });
        if (!job) {
            throw new Error('Job not found');
        }
        if (job.status === JobStatus.COMPLETED) {
            throw new Error('Cannot cancel completed job');
        }
        job.status = JobStatus.CANCELLED;
        return await this.publishJobRepository.save(job);
    }

    async getActivePublishJob(projectId: string): Promise<PublishJob | null> {
        const job = await this.publishJobRepository.findOne({
            where: [
                { projectId, status: JobStatus.PENDING },
                { projectId, status: JobStatus.PROCESSING },
                { projectId, status: JobStatus.PAUSED },
            ],
            order: { createdAt: 'DESC' },
        });
        return job;
    }

    async getOverallStats(organizationId?: string): Promise<{
        totalProjects: number;
        totalContent: number;
        publishedContent: number;
        pendingContent: number;
        draftContent: number;
        failedContent: number;
        activeJobs: number;
        completedJobsToday: number;
    }> {
        if (organizationId) {
            // Get projects for this organization
            const projects = await this.projectRepository.find({
                where: { organizationId },
                select: ['id']
            });

            const projectIds = projects.map(p => p.id);

            if (projectIds.length === 0) {
                return {
                    totalProjects: 0,
                    totalContent: 0,
                    publishedContent: 0,
                    pendingContent: 0,
                    draftContent: 0,
                    failedContent: 0,
                    activeJobs: 0,
                    completedJobsToday: 0,
                };
            }

            const totalProjects = projects.length;
            const totalContent = await this.contentRepository.count({
                where: { projectId: In(projectIds) }
            });
            const publishedContent = await this.contentRepository.count({
                where: { projectId: In(projectIds), publishStatus: PublishStatus.PUBLISHED },
            });
            const pendingContent = await this.contentRepository.count({
                where: { projectId: In(projectIds), publishStatus: PublishStatus.PENDING },
            });
            const draftContent = await this.contentRepository.count({
                where: { projectId: In(projectIds), publishStatus: PublishStatus.DRAFT },
            });
            const failedContent = await this.contentRepository.count({
                where: { projectId: In(projectIds), publishStatus: PublishStatus.FAILED },
            });

            const activeJobs = await this.publishJobRepository.count({
                where: [
                    { projectId: In(projectIds), status: JobStatus.PENDING },
                    { projectId: In(projectIds), status: JobStatus.PROCESSING },
                    { projectId: In(projectIds), status: JobStatus.PAUSED },
                ]
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const completedJobsToday = await this.publishJobRepository.count({
                where: {
                    projectId: In(projectIds),
                    status: JobStatus.COMPLETED,
                    completedAt: MoreThanOrEqual(today),
                },
            });

            return {
                totalProjects,
                totalContent,
                publishedContent,
                pendingContent,
                draftContent,
                failedContent,
                activeJobs,
                completedJobsToday,
            };
        }

        // No organization filter
        const totalProjects = await this.projectRepository.count();
        const totalContent = await this.contentRepository.count();
        const publishedContent = await this.contentRepository.count({
            where: { publishStatus: PublishStatus.PUBLISHED },
        });
        const pendingContent = await this.contentRepository.count({
            where: { publishStatus: PublishStatus.PENDING },
        });
        const draftContent = await this.contentRepository.count({
            where: { publishStatus: PublishStatus.DRAFT },
        });
        const failedContent = await this.contentRepository.count({
            where: { publishStatus: PublishStatus.FAILED },
        });

        const activeJobs = await this.publishJobRepository.count({
            where: [
                { status: JobStatus.PENDING },
                { status: JobStatus.PROCESSING },
                { status: JobStatus.PAUSED },
            ],
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completedJobsToday = await this.publishJobRepository.count({
            where: {
                status: JobStatus.COMPLETED,
                completedAt: MoreThanOrEqual(today),
            },
        });

        return {
            totalProjects,
            totalContent,
            publishedContent,
            pendingContent,
            draftContent,
            failedContent,
            activeJobs,
            completedJobsToday,
        };
    }

    /**
     * Public API status filter: drafts are never exposed.
     * Returns null when the requested status can never match (status=draft).
     */
    private publicStatusFilter(status?: string): any {
        if (!status) {
            return Not(PublishStatus.DRAFT);
        }
        if (status === PublishStatus.DRAFT) {
            return null;
        }
        return status as PublishStatus;
    }

    private generateDefaultTitle(data: Record<string, string>): string {
        const firstValue = Object.values(data)[0];
        return firstValue || 'Untitled';
    }

    private generateSlug(title: string, suffix: string): string {
        const slugified = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (suffix) {
            return `${slugified}-${suffix}`;
        }
        return slugified;
    }

    /**
     * Find contents by project for public API (with pagination)
     */
    async findContentsByProject(
        projectId: string,
        status?: string,
        skip: number = 0,
        take: number = 50,
    ): Promise<[GeneratedContent[], number]> {
        const where: any = { projectId };

        const statusFilter = this.publicStatusFilter(status);
        if (statusFilter === null) {
            return [[], 0];
        }
        where.publishStatus = statusFilter;

        return await this.contentRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take,
        });
    }

    /**
     * Find one content for public API
     */
    async findOnePublic(id: string): Promise<GeneratedContent> {
        const content = await this.contentRepository.findOne({
            where: { id, publishStatus: Not(PublishStatus.DRAFT) },
        });

        if (!content) {
            throw new Error('Content not found');
        }

        return content;
    }

    /**
     * Find one content by slug and organization for public API
     */
    async findBySlugPublic(slug: string, organizationId: string): Promise<GeneratedContent> {
        const content = await this.contentRepository
            .createQueryBuilder('content')
            .innerJoin('content.project', 'project')
            .where('content.slug = :slug', { slug })
            .andWhere('project.organizationId = :organizationId', { organizationId })
            .andWhere('content.publishStatus != :draft', { draft: PublishStatus.DRAFT })
            .getOne();

        if (!content) {
            throw new Error('Content not found');
        }

        return content;
    }

    /**
     * Find contents by organization for public API (with pagination and optional project filter)
     */
    async findContentsByOrganization(
        organizationId: string,
        projectId?: string,
        status?: string,
        skip: number = 0,
        take: number = 50,
    ): Promise<[GeneratedContent[], number]> {
        // First, get all project IDs for this organization
        const projects = await this.projectRepository.find({
            where: { organizationId },
            select: ['id'],
        });

        const projectIds = projects.map(p => p.id);

        if (projectIds.length === 0) {
            return [[], 0];
        }

        // If a specific project is requested, filter to only that project (and verify it belongs to org)
        let targetProjectIds = projectIds;
        if (projectId) {
            if (!projectIds.includes(projectId)) {
                return [[], 0]; // Project doesn't belong to this organization
            }
            targetProjectIds = [projectId];
        }

        const where: any = { projectId: In(targetProjectIds) };

        const statusFilter = this.publicStatusFilter(status);
        if (statusFilter === null) {
            return [[], 0];
        }
        where.publishStatus = statusFilter;

        return await this.contentRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take,
        });
    }

    /**
     * Find all projects for an organization (for public API)
     */
    async findProjectsByOrganization(organizationId: string): Promise<Project[]> {
        return await this.projectRepository.find({
            where: { organizationId },
            relations: ['categories'],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Find contents by category (for public API)
     * Returns all contents from projects that have the specified category
     */
    async findContentsByCategory(
        categoryId: string,
        organizationId: string,
        status?: string,
        skip: number = 0,
        take: number = 50,
    ): Promise<[GeneratedContent[], number]> {
        // Find all projects that have this category and belong to the organization
        const projects = await this.projectRepository
            .createQueryBuilder('project')
            .innerJoin('project.categories', 'category', 'category.id = :categoryId', { categoryId })
            .where('project.organizationId = :organizationId', { organizationId })
            .select(['project.id'])
            .getMany();

        const projectIds = projects.map(p => p.id);

        if (projectIds.length === 0) {
            return [[], 0];
        }

        const where: any = { projectId: In(projectIds) };

        const statusFilter = this.publicStatusFilter(status);
        if (statusFilter === null) {
            return [[], 0];
        }
        where.publishStatus = statusFilter;

        return await this.contentRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take,
        });
    }

    /**
     * Search and filter contents by organization (for internal use with advanced filters)
     */
    async searchContentsByOrganization(
        organizationId: string,
        options: {
            projectId?: string;
            categoryId?: string;
            status?: string;
            search?: string;
            skip?: number;
            take?: number;
        } = {},
    ): Promise<{ contents: GeneratedContent[]; total: number; projects: Project[] }> {
        const { projectId, categoryId, status, search, skip = 0, take = 20 } = options;

        // Get all projects for the organization (with categories for reference)
        let projectsQuery = this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.categories', 'categories')
            .where('project.organizationId = :organizationId', { organizationId });

        // If category filter is applied, only get projects with that category
        if (categoryId) {
            projectsQuery = projectsQuery
                .innerJoin('project.categories', 'filterCategory', 'filterCategory.id = :categoryId', { categoryId });
        }

        const allProjects = await projectsQuery.getMany();

        // If no projects found, return empty
        if (allProjects.length === 0) {
            return { contents: [], total: 0, projects: [] };
        }

        let targetProjectIds = allProjects.map(p => p.id);

        // If specific project filter
        if (projectId) {
            if (!targetProjectIds.includes(projectId)) {
                return { contents: [], total: 0, projects: allProjects };
            }
            targetProjectIds = [projectId];
        }

        // Build contents query
        const contentsQuery = this.contentRepository
            .createQueryBuilder('content')
            .where('content.projectId IN (:...projectIds)', { projectIds: targetProjectIds });

        // Status filter
        if (status && status !== 'all') {
            contentsQuery.andWhere('content.publishStatus = :status', { status });
        }

        // Search filter (title)
        if (search && search.trim()) {
            contentsQuery.andWhere('content.title LIKE :search', { search: `%${search.trim()}%` });
        }

        // Get total count first
        const total = await contentsQuery.getCount();

        // Get paginated results
        const contents = await contentsQuery
            .orderBy('content.createdAt', 'DESC')
            .skip(skip)
            .take(take)
            .getMany();

        return { contents, total, projects: allProjects };
    }
}


