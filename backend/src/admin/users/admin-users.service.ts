import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { OrganizationMember } from '../../entities/organization-member.entity';
import { Organization } from '../../entities/organization.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class AdminUsersService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(OrganizationMember)
        private orgMemberRepository: Repository<OrganizationMember>,
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
    ) { }

    async findAll(page: number = 1, limit: number = 20, search?: string, isActive?: boolean, isSuperAdmin?: boolean) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.email = Like(`%${search}%`);
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        if (isSuperAdmin !== undefined) {
            where.isSuperAdmin = isSuperAdmin;
        }

        const [users, total] = await this.userRepository.findAndCount({
            where,
            take: limit,
            skip,
            order: { createdAt: 'DESC' },
        });

        // Aggregate membership counts in one grouped query instead of one per user (avoids N+1).
        const userIds = users.map((user) => user.id);
        const orgCountMap = new Map<string, number>();

        if (userIds.length > 0) {
            const orgCounts = await this.orgMemberRepository
                .createQueryBuilder('member')
                .select('member.userId', 'userId')
                .addSelect('COUNT(*)', 'count')
                .where('member.userId IN (:...userIds)', { userIds })
                .groupBy('member.userId')
                .getRawMany();
            orgCounts.forEach((r) => orgCountMap.set(r.userId, Number(r.count)));
        }

        const usersWithCounts = users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin,
            isActive: user.isActive,
            createdAt: user.createdAt,
            organizationCount: orgCountMap.get(user.id) ?? 0,
        }));

        return {
            data: usersWithCounts,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async create(createUserDto: CreateUserDto) {
        // Check if email already exists
        const existing = await this.userRepository.findOne({
            where: { email: createUserDto.email },
        });
        if (existing) {
            throw new BadRequestException('Email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

        const user = this.userRepository.create({
            email: createUserDto.email,
            name: createUserDto.name,
            password: hashedPassword,
            isSuperAdmin: createUserDto.isSuperAdmin || false,
        });

        const savedUser = await this.userRepository.save(user);

        // Return without password
        const { password, ...result } = savedUser;
        return result;
    }

    async update(id: string, updateDto: UpdateUserDto) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check if email is being changed and if it's already taken
        if (updateDto.email && updateDto.email !== user.email) {
            const existing = await this.userRepository.findOne({
                where: { email: updateDto.email },
            });
            if (existing) {
                throw new BadRequestException('Email already exists');
            }
        }

        Object.assign(user, updateDto);
        const savedUser = await this.userRepository.save(user);

        const { password, ...result } = savedUser;
        return result;
    }

    async getUserOrganizations(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const memberships = await this.orgMemberRepository.find({
            where: { userId },
            relations: ['organization'],
        });

        return memberships.map(membership => ({
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
            role: membership.role,
            joinedAt: membership.joinedAt,
        }));
    }

    async addUserToOrganization(userId: string, organizationId: string, role: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        // Check if already a member
        const existing = await this.orgMemberRepository.findOne({
            where: { userId, organizationId },
        });
        if (existing) {
            throw new BadRequestException('User is already a member of this organization');
        }

        const membership = this.orgMemberRepository.create({
            userId,
            organizationId,
            role: role as any,
        });

        return await this.orgMemberRepository.save(membership);
    }

    async removeUserFromOrganization(userId: string, organizationId: string) {
        const membership = await this.orgMemberRepository.findOne({
            where: { userId, organizationId },
        });
        if (!membership) {
            throw new NotFoundException('Membership not found');
        }

        await this.orgMemberRepository.remove(membership);
        return { message: 'User removed from organization' };
    }
}
