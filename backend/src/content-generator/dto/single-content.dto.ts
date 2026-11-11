import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PublishStatus } from '../../entities/generated-content.entity';

const MANUAL_STATUSES = [PublishStatus.DRAFT, PublishStatus.PENDING, PublishStatus.PUBLISHED];

export class RenderTemplateDto {
    /** Values for the project's template variables, e.g. { kota: 'Semarang' } */
    @IsObject()
    variables: Record<string, string>;
}

/**
 * Create one article by hand inside a project, outside mass generation.
 * Fields left empty are filled by rendering the project templates with `variables`.
 */
export class CreateSingleContentDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    title?: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    metaDescription?: string;

    @IsOptional()
    @IsString()
    tags?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    slug?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    thumbnailUrl?: string;

    @IsOptional()
    @IsIn(MANUAL_STATUSES)
    status?: PublishStatus;

    @IsOptional()
    @IsObject()
    variables?: Record<string, string>;
}
