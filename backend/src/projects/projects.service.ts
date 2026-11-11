import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project, ProjectType } from '../entities/project.entity';
import { OrganizationMember } from '../entities/organization-member.entity';
import { GeneratedContent } from '../entities/generated-content.entity';
import { Category } from '../entities/category.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(OrganizationMember)
        private orgMemberRepository: Repository<OrganizationMember>,
        @InjectRepository(GeneratedContent)
        private generatedContentRepository: Repository<GeneratedContent>,
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
    ) { }

    async create(createProjectDto: CreateProjectDto, userId: string): Promise<Project> {
        // Verify user is member of the organization
        await this.checkOrgMembership(createProjectDto.organizationId, userId);

        // Extract categoryIds from DTO
        const { categoryIds, ...projectData } = createProjectDto;
        const type = projectData.type ?? ProjectType.MASS;

        if (type === ProjectType.MASS && !projectData.template?.trim()) {
            throw new BadRequestException('Template is required for mass projects');
        }

        const project = this.projectRepository.create({
            ...projectData,
            type,
            // Manual projects have no templates; the column is NOT NULL
            template: type === ProjectType.MASS ? projectData.template : '',
            ...(type === ProjectType.MANUAL
                ? { titleTemplate: undefined, metaDescriptionTemplate: undefined, tagsTemplate: undefined, slugTemplate: undefined }
                : {}),
            createdById: userId,
        });

        // If category IDs are provided, fetch and assign them
        if (categoryIds && categoryIds.length > 0) {
            const categories = await this.categoryRepository.find({
                where: {
                    id: In(categoryIds),
                    organizationId: createProjectDto.organizationId,
                },
            });
            project.categories = categories;
        }

        return await this.projectRepository.save(project);
    }

    async findAll(userId: string, organizationId?: string): Promise<Project[]> {
        // Get all organizations user belongs to
        const memberships = await this.orgMemberRepository.find({
            where: { userId },
        });

        const organizationIds = memberships.map(m => m.organizationId);

        if (organizationIds.length === 0) {
            return [];
        }

        // Don't eagerly load csvColumns and csvRows - this causes performance issues
        // with large datasets. Frontend should fetch CSV data separately when needed.
        const query = this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.categories', 'categories')
            .where('project.organizationId IN (:...organizationIds)', { organizationIds })
            .loadRelationCountAndMap('project.csvRowCount', 'project.csvRows')
            .loadRelationCountAndMap('project.csvColumnCount', 'project.csvColumns')
            .loadRelationCountAndMap('project.generatedContentCount', 'project.generatedContents')
            .orderBy('project.createdAt', 'DESC');

        // If organizationId is provided, filter by it
        if (organizationId) {
            query.andWhere('project.organizationId = :organizationId', { organizationId });
        }

        return await query.getMany();
    }

    async findOne(id: string, userId: string): Promise<Project> {
        // DO NOT load csvRows or generatedContents - they can be huge!
        // Only load organization and publishJobs for the project detail view
        const project = await this.projectRepository.findOne({
            where: { id },
            relations: ['csvColumns', 'publishJobs', 'organization', 'categories'],
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        // Verify user has access to this project's organization
        await this.checkOrgMembership(project.organizationId, userId);

        return project;
    }

    async update(id: string, updateProjectDto: UpdateProjectDto, userId: string): Promise<Project> {
        // Load project with categories for update
        const project = await this.projectRepository.findOne({
            where: { id },
            relations: ['categories'],
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        await this.checkOrgMembership(project.organizationId, userId);

        // Handle category update if categoryIds provided
        const { categoryIds, type: _ignoredType, ...updateData } = updateProjectDto as any;

        if (categoryIds !== undefined) {
            if (categoryIds.length > 0) {
                const categories = await this.categoryRepository.find({
                    where: {
                        id: In(categoryIds),
                        organizationId: project.organizationId,
                    },
                });
                project.categories = categories;
            } else {
                project.categories = [];
            }
        }

        Object.assign(project, updateData);
        return await this.projectRepository.save(project);
    }

    async remove(id: string, userId: string): Promise<void> {
        // Use a lightweight query for delete - don't load relations
        const project = await this.projectRepository.findOne({
            where: { id },
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        await this.checkOrgMembership(project.organizationId, userId);
        await this.projectRepository.remove(project);
    }

    async getProjectStats(id: string, userId: string): Promise<{
        totalContents: number;
        publishedContents: number;
        pendingContents: number;
        draftContents: number;
        failedContents: number;
    }> {
        // Verify project exists and user has access (lightweight query)
        const project = await this.projectRepository.findOne({
            where: { id },
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        await this.checkOrgMembership(project.organizationId, userId);

        // Single grouped COUNT (uses the projectId/publishStatus index) instead of loading content
        const rows: { status: string; count: string }[] = await this.generatedContentRepository
            .createQueryBuilder('content')
            .select('content.publishStatus', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('content.projectId = :id', { id })
            .groupBy('content.publishStatus')
            .getRawMany();

        const byStatus: Record<string, number> = {};
        for (const row of rows) {
            byStatus[row.status] = Number(row.count) || 0;
        }

        const publishedContents = byStatus['published'] ?? 0;
        const pendingContents = byStatus['pending'] ?? 0;
        const draftContents = byStatus['draft'] ?? 0;
        const failedContents = byStatus['failed'] ?? 0;

        return {
            totalContents: publishedContents + pendingContents + draftContents + failedContents,
            publishedContents,
            pendingContents,
            draftContents,
            failedContents,
        };
    }

    private async checkOrgMembership(organizationId: string, userId: string): Promise<void> {
        const membership = await this.orgMemberRepository.findOne({
            where: {
                organizationId,
                userId,
            },
        });

        if (!membership) {
            throw new ForbiddenException('You do not have access to this organization');
        }
    }
}
