import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { OrganizationMember, OrganizationRole } from '../entities/organization-member.entity';
import { User } from '../entities/user.entity';

export interface CreateOrganizationDto {
    name: string;
    slug?: string;
}

export interface UpdateOrganizationDto {
    name?: string;
}

export interface AddMemberDto {
    email: string;
    role?: OrganizationRole;
}

@Injectable()
export class OrganizationsService {
    constructor(
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
        @InjectRepository(OrganizationMember)
        private orgMemberRepository: Repository<OrganizationMember>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async create(userId: string, createDto: CreateOrganizationDto): Promise<Organization> {
        const slug = createDto.slug || this.generateSlug(createDto.name);

        // Check if slug already exists
        const existing = await this.organizationRepository.findOne({ where: { slug } });
        if (existing) {
            throw new BadRequestException('Organization slug already exists');
        }

        const organization = this.organizationRepository.create({
            name: createDto.name,
            slug,
            ownerId: userId,
        });

        const saved = await this.organizationRepository.save(organization);

        // Add creator as OrgAdmin
        const membership = this.orgMemberRepository.create({
            userId,
            organizationId: saved.id,
            role: OrganizationRole.ORG_ADMIN,
        });
        await this.orgMemberRepository.save(membership);

        return saved;
    }

    async findAllForUser(userId: string): Promise<Organization[]> {
        const memberships = await this.orgMemberRepository.find({
            where: { userId },
            relations: ['organization'],
        });

        return memberships.map(m => m.organization);
    }

    async findOne(id: string): Promise<Organization> {
        const organization = await this.organizationRepository.findOne({
            where: { id },
            relations: ['members', 'members.user'],
        });

        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        return organization;
    }

    async update(id: string, userId: string, updateDto: UpdateOrganizationDto): Promise<Organization> {
        const organization = await this.findOne(id);

        // Check if user is OrgAdmin
        await this.checkOrgAdmin(id, userId);

        if (updateDto.name) {
            organization.name = updateDto.name;
        }

        return await this.organizationRepository.save(organization);
    }

    async remove(id: string, userId: string): Promise<void> {
        const organization = await this.findOne(id);

        // Only owner can delete
        if (organization.ownerId !== userId) {
            throw new ForbiddenException('Only organization owner can delete the organization');
        }

        await this.organizationRepository.delete(id);
    }

    async addMember(organizationId: string, requestUserId: string, addMemberDto: AddMemberDto): Promise<OrganizationMember> {
        // Check if requester is OrgAdmin
        await this.checkOrgAdmin(organizationId, requestUserId);

        // Find user by email
        const user = await this.userRepository.findOne({ where: { email: addMemberDto.email } });
        if (!user) {
            throw new NotFoundException(`User with email ${addMemberDto.email} not found`);
        }

        // Check if already a member
        const existing = await this.orgMemberRepository.findOne({
            where: {
                organizationId,
                userId: user.id,
            },
        });

        if (existing) {
            throw new BadRequestException('User is already a member of this organization');
        }

        const membership = this.orgMemberRepository.create({
            organizationId,
            userId: user.id,
            role: this.normalizeRole(addMemberDto.role),
        });

        return await this.orgMemberRepository.save(membership);
    }

    async removeMember(organizationId: string, requestUserId: string, memberUserId: string): Promise<void> {
        // Allow users to remove themselves, or require admin permission
        if (requestUserId !== memberUserId) {
            await this.checkOrgAdmin(organizationId, requestUserId);
        }

        const membership = await this.orgMemberRepository.findOne({
            where: {
                organizationId,
                userId: memberUserId,
            },
        });

        if (!membership) {
            throw new NotFoundException('Member not found');
        }

        await this.orgMemberRepository.delete(membership.id);
    }

    async updateMemberRole(
        organizationId: string,
        requestUserId: string,
        memberUserId: string,
        role: OrganizationRole,
    ): Promise<OrganizationMember> {
        // Check if requester is OrgAdmin
        await this.checkOrgAdmin(organizationId, requestUserId);

        const membership = await this.orgMemberRepository.findOne({
            where: {
                organizationId,
                userId: memberUserId,
            },
        });

        if (!membership) {
            throw new NotFoundException('Member not found');
        }

        membership.role = this.normalizeRole(role);
        return await this.orgMemberRepository.save(membership);
    }

    /**
     * Accept roles case-insensitively ('ORG_ADMIN' or 'org_admin') and reject unknown values,
     * instead of letting an invalid value hit the MySQL enum column.
     */
    private normalizeRole(role?: string | null): OrganizationRole {
        if (!role) {
            return OrganizationRole.ORG_MEMBER;
        }
        const value = String(role).toLowerCase() as OrganizationRole;
        if (!Object.values(OrganizationRole).includes(value)) {
            throw new BadRequestException(`Invalid role. Use one of: ${Object.values(OrganizationRole).join(', ')}`);
        }
        return value;
    }

    async getMembers(organizationId: string): Promise<OrganizationMember[]> {
        return await this.orgMemberRepository.find({
            where: { organizationId },
            relations: ['user'],
        });
    }

    async checkOrgAdmin(organizationId: string, userId: string): Promise<void> {
        const membership = await this.orgMemberRepository.findOne({
            where: {
                organizationId,
                userId,
            },
        });

        if (!membership || membership.role !== OrganizationRole.ORG_ADMIN) {
            throw new ForbiddenException('Only organization admins can perform this action');
        }
    }

    async isMember(organizationId: string, userId: string): Promise<boolean> {
        const membership = await this.orgMemberRepository.findOne({
            where: {
                organizationId,
                userId,
            },
        });

        return !!membership;
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
}
