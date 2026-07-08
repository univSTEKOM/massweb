import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Project } from './project.entity';

@Index('idx_csvcol_project_order', ['projectId', 'columnOrder'])
@Entity('csv_columns')
export class CsvColumn {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column()
    columnName: string;

    @Column({ default: 'text' })
    columnType: string;

    @Column({ type: 'int' })
    columnOrder: number;

    @ManyToOne(() => Project, (project) => project.csvColumns, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'projectId' })
    project: Project;
}
