import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Project } from './project.entity';

// Rows are fetched/counted by projectId and read in rowOrder during generation.
@Index('idx_csvrow_project_order', ['projectId', 'rowOrder'])
@Entity('csv_rows')
export class CsvRow {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column({ type: 'json' })
    rowData: Record<string, string>;

    @Column({ type: 'int' })
    rowOrder: number;

    @ManyToOne(() => Project, (project) => project.csvRows, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'projectId' })
    project: Project;
}
