import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    Res,
    ValidationPipe,
    UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { ContentGeneratorService } from './content-generator.service';
import { ExportService } from './export.service';
import { GeneratedContent } from '../entities/generated-content.entity';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Controller('content-generator')
export class ContentGeneratorController {
    constructor(
        private readonly contentGeneratorService: ContentGeneratorService,
        private readonly exportService: ExportService,
        @InjectQueue('content-generation') private generationQueue: Queue,
        @InjectQueue('content-publishing') private publishQueue: Queue,
    ) { }

    @Post('projects/:projectId/generate')
    async generateContent(@Param('projectId') projectId: string) {
        return await this.contentGeneratorService.generateContent(projectId);
    }

    @Post('projects/:projectId/generate-sync')
    async generateContentSync(@Param('projectId') projectId: string) {
        return await this.contentGeneratorService.generateContentSync(projectId);
    }

    @Get('projects/:projectId/contents')
    async getContents(
        @Param('projectId') projectId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('status') status?: string,
        @Query('search') search?: string,
    ) {
        return await this.contentGeneratorService.getGeneratedContents(
            projectId,
            Number(page),
            Number(limit),
            status as any,
            search,
        );
    }

    @Get('contents/:id')
    async getContent(@Param('id') id: string) {
        return await this.contentGeneratorService.getContentById(id);
    }

    @Put('contents/:id')
    @UsePipes(new ValidationPipe({ transform: true }))
    async updateContent(@Param('id') id: string, @Body() updates: Partial<GeneratedContent>) {
        return await this.contentGeneratorService.updateContent(id, updates);
    }

    @Delete('contents/:id')
    async deleteContent(@Param('id') id: string) {
        await this.contentGeneratorService.deleteContent(id);
        return { message: 'Content deleted successfully' };
    }

    @Post('projects/:projectId/publish')
    async startPublish(
        @Param('projectId') projectId: string,
        @Body('delaySeconds') delaySeconds?: number,
    ) {
        return await this.contentGeneratorService.startPublishJob(projectId, delaySeconds);
    }

    @Post('projects/:projectId/publish-sync')
    async publishSync(
        @Param('projectId') projectId: string,
        @Body('delaySeconds') delaySeconds?: number,
    ) {
        return await this.contentGeneratorService.publishContentSync(projectId, delaySeconds);
    }

    @Post('contents/unpublish')
    async unpublishContent(@Body('contentIds') contentIds: string[]) {
        return await this.contentGeneratorService.unpublishContent(contentIds);
    }

    @Post('projects/:projectId/publish-async')
    async publishAsync(
        @Param('projectId') projectId: string,
        @Body('delaySeconds') delaySeconds?: number,
    ) {
        return await this.contentGeneratorService.startPublishJobAsync(projectId, delaySeconds);
    }

    @Get('publish-jobs/:jobId')
    async getPublishJobStatus(@Param('jobId') jobId: string) {
        return await this.contentGeneratorService.getPublishJobStatus(jobId);
    }

    @Post('publish-jobs/:jobId/pause')
    async pausePublishJob(@Param('jobId') jobId: string) {
        return await this.contentGeneratorService.pausePublishJob(jobId);
    }

    @Post('publish-jobs/:jobId/resume')
    async resumePublishJob(@Param('jobId') jobId: string) {
        return await this.contentGeneratorService.resumePublishJob(jobId);
    }

    @Post('publish-jobs/:jobId/cancel')
    async cancelPublishJob(@Param('jobId') jobId: string) {
        return await this.contentGeneratorService.cancelPublishJob(jobId);
    }

    @Get('projects/:projectId/active-publish-job')
    async getActivePublishJob(@Param('projectId') projectId: string) {
        return await this.contentGeneratorService.getActivePublishJob(projectId);
    }

    @Get('overall-stats')
    async getOverallStats(@Query('organizationId') organizationId?: string) {
        return await this.contentGeneratorService.getOverallStats(organizationId);
    }

    @Get('organizations/:organizationId/contents')
    async searchOrganizationContents(
        @Param('organizationId') organizationId: string,
        @Query('projectId') projectId?: string,
        @Query('categoryId') categoryId?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const result = await this.contentGeneratorService.searchContentsByOrganization(
            organizationId,
            {
                projectId,
                categoryId,
                status,
                search,
                skip,
                take: Number(limit),
            },
        );

        return {
            contents: result.contents,
            projects: result.projects.map(p => ({
                id: p.id,
                name: p.name,
                categories: p.categories,
            })),
            total: result.total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(result.total / Number(limit)),
        };
    }

    @Get('projects/:projectId/export')
    async exportContent(
        @Param('projectId') projectId: string,
        @Query('format') format: 'csv' | 'json' | 'html-zip',
        @Res() res: Response,
    ) {
        if (format === 'csv') {
            const csv = await this.exportService.exportAsCSV(projectId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="content-export-${projectId}.csv"`);
            return res.send(csv);
        } else if (format === 'json') {
            const json = await this.exportService.exportAsJSON(projectId);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="content-export-${projectId}.json"`);
            return res.json(json);
        } else if (format === 'html-zip') {
            const zipBuffer = await this.exportService.exportAsHTMLZip(projectId);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="content-export-${projectId}.zip"`);
            return res.send(zipBuffer);
        }
        return res.status(400).json({ message: 'Invalid format. Use csv, json, or html-zip' });
    }

    @Get('jobs/:jobId/status')
    async getJobStatus(@Param('jobId') jobId: string) {
        // Try generation queue first
        let job = await this.generationQueue.getJob(jobId);
        let type = 'generation';

        // If not found, try publish queue
        if (!job) {
            job = await this.publishQueue.getJob(jobId);
            type = 'publishing';
        }

        if (!job) {
            throw new Error('Job not found');
        }

        const state = await job.getState();
        const progress = job.progress();

        return {
            jobId,
            type,
            state,
            progress,
            data: job.data,
        };
    }
}
