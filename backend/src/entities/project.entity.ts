import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, Index } from 'typeorm';
import { CsvColumn } from './csv-column.entity';
import { CsvRow } from './csv-row.entity';
import { GeneratedContent } from './generated-content.entity';
import { PublishJob } from './publish-job.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Category } from './category.entity';

export enum ProjectType {
    // Articles are mass-generated from an uploaded CSV/Excel file + templates
    MASS = 'mass',
    // No import or templates: every article is written one by one
    MANUAL = 'manual',
}

// Projects are listed/counted by organizationId, ordered by createdAt.
@Index('idx_project_org_created', ['organizationId', 'createdAt'])
@Entity('projects')
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    organizationId: string;

    @Column({ nullable: true })
    createdById: string;

    @Column()
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'longtext' })
    template: string;

    @Column({ type: 'text', nullable: true })
    metaDescriptionTemplate: string;

    @Column({ type: 'text', nullable: true })
    tagsTemplate: string;

    @Column({ type: 'text', nullable: true })
    titleTemplate: string;

    @Column({ type: 'text', nullable: true })
    slugTemplate: string;

    @Column({ default: 5 })
    publishDelaySeconds: number;

    @Column({ nullable: true })
    thumbnailUrl: string;

    // Set at creation, never changed afterwards
    @Column({ type: 'enum', enum: ProjectType, default: ProjectType.MASS })
    type: ProjectType;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => CsvColumn, (column) => column.project, { cascade: true })
    csvColumns: CsvColumn[];

    @OneToMany(() => CsvRow, (row) => row.project, { cascade: true })
    csvRows: CsvRow[];

    @OneToMany(() => GeneratedContent, (content) => content.project, { cascade: true })
    generatedContents: GeneratedContent[];

    @OneToMany(() => PublishJob, (job) => job.project, { cascade: true })
    publishJobs: PublishJob[];

    @ManyToOne(() => Organization, org => org.projects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organizationId' })
    organization: Organization;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'createdById' })
    createdBy: User;

    @ManyToMany(() => Category, category => category.projects)
    @JoinTable({
        name: 'project_categories',
        joinColumn: { name: 'projectId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
    })
    categories: Category[];
}
