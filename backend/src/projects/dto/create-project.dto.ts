import { IsString, IsOptional, IsInt, Min, IsArray, IsEnum } from 'class-validator';
import { ProjectType } from '../../entities/project.entity';

export class CreateProjectDto {
    @IsString()
    organizationId: string;

    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    // 'mass' (default): CSV import + templates. 'manual': articles written one by one.
    @IsOptional()
    @IsEnum(ProjectType)
    type?: ProjectType;

    // Required for mass projects, ignored for manual projects
    @IsString()
    @IsOptional()
    template?: string;

    @IsString()
    @IsOptional()
    titleTemplate?: string;

    @IsString()
    @IsOptional()
    metaDescriptionTemplate?: string;

    @IsString()
    @IsOptional()
    tagsTemplate?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    publishDelaySeconds?: number = 5;

    // Array of category IDs to associate with the project
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categoryIds?: string[];
}
