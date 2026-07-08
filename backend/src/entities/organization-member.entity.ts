import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

export enum OrganizationRole {
    ORG_ADMIN = 'org_admin',
    ORG_MEMBER = 'org_member',
}

// (userId, organizationId): membership lookups; its leading column also serves
// userId-only queries. organizationId indexed for per-org member counts.
// Kept non-unique so index creation can't fail on any pre-existing duplicate rows.
@Index('idx_orgmember_user_org', ['userId', 'organizationId'])
@Index('idx_orgmember_org', ['organizationId'])
@Entity('organization_members')
export class OrganizationMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    organizationId: string;

    @Column({
        type: 'enum',
        enum: OrganizationRole,
        default: OrganizationRole.ORG_MEMBER,
    })
    role: OrganizationRole;

    @CreateDateColumn()
    joinedAt: Date;

    // Relations
    @ManyToOne(() => User, user => user.organizationMemberships, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Organization, org => org.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organizationId' })
    organization: Organization;
}
