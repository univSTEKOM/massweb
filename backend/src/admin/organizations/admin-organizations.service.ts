import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Organization } from '../../entities/organization.entity';
import { OrganizationMember } from '../../entities/organization-member.entity';
import { User } from '../../entities/user.entity';
import { Project } from '../../entities/project.entity';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { AddOrgMemberDto } from '../dto/add-org-member.dto';

@Injectable()
export class AdminOrganizationsService {
    constructor(
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
        @InjectRepository(OrganizationMember)
        private orgMemberRepository: Repository<OrganizationMember>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
    ) { }

    async findAll(page: number = 1, limit: number = 20, search?: string, isActive?: boolean) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.name = Like(`%${search}%`);
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        const [organizations, total] = await this.organizationRepository.findAndCount({
            where,
            take: limit,
            skip,
            order: { createdAt: 'DESC' },
        });

        // Aggregate member/project counts in two grouped queries instead of two per org (avoids N+1).
        const orgIds = organizations.map((org) => org.id);
        const memberCountMap = new Map<string, number>();
        const projectCountMap = new Map<string, number>();

        if (orgIds.length > 0) {
            const memberCounts = await this.orgMemberRepository
                .createQueryBuilder('member')
                .select('member.organizationId', 'organizationId')
                .addSelect('COUNT(*)', 'count')
                .where('member.organizationId IN (:...orgIds)', { orgIds })
                .groupBy('member.organizationId')
                .getRawMany();
            memberCounts.forEach((r) => memberCountMap.set(r.organizationId, Number(r.count)));

            const projectCounts = await this.projectRepository
                .createQueryBuilder('project')
                .select('project.organizationId', 'organizationId')
                .addSelect('COUNT(*)', 'count')
                .where('project.organizationId IN (:...orgIds)', { orgIds })
                .groupBy('project.organizationId')
                .getRawMany();
            projectCounts.forEach((r) => projectCountMap.set(r.organizationId, Number(r.count)));
        }

        const orgsWithCounts = organizations.map((org) => ({
            ...org,
            memberCount: memberCountMap.get(org.id) ?? 0,
            projectCount: projectCountMap.get(org.id) ?? 0,
        }));

        return {
            data: orgsWithCounts,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, updateDto: UpdateOrganizationDto) {
        const organization = await this.organizationRepository.findOne({ where: { id } });
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        Object.assign(organization, updateDto);
        return await this.organizationRepository.save(organization);
    }

    async getMembers(organizationId: string) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        const members = await this.orgMemberRepository.find({
            where: { organizationId },
            relations: ['user'],
        });

        return members.map(member => ({
            id: member.id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            user: {
                id: member.user.id,
                email: member.user.email,
                name: member.user.name,
                isActive: member.user.isActive,
            },
        }));
    }

    async addMember(organizationId: string, addMemberDto: AddOrgMemberDto) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        const user = await this.userRepository.findOne({
            where: { email: addMemberDto.email },
        });
        if (!user) {
            throw new NotFoundException('User not found with this email');
        }

        // Check if already a member
        const existingMember = await this.orgMemberRepository.findOne({
            where: { organizationId, userId: user.id },
        });
        if (existingMember) {
            throw new NotFoundException('User is already a member of this organization');
        }

        const member = this.orgMemberRepository.create({
            organizationId,
            userId: user.id,
            role: addMemberDto.role,
        });

        return await this.orgMemberRepository.save(member);
    }

    async removeMember(organizationId: string, userId: string) {
        const member = await this.orgMemberRepository.findOne({
            where: { organizationId, userId },
        });
        if (!member) {
            throw new NotFoundException('Member not found');
        }

        await this.orgMemberRepository.remove(member);
        return { message: 'Member removed successfully' };
    }
}
