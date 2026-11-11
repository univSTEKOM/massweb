import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PublishStatus } from '../../entities/generated-content.entity';

export class GenerateContentDto {
    @IsOptional()
    @IsBoolean()
    asDraft?: boolean;
}

export class BulkStatusDto {
    @IsArray()
    @ArrayMaxSize(10000)
    @IsString({ each: true })
    contentIds: string[];

    @IsEnum(PublishStatus)
    status: PublishStatus;
}

export class ProjectBulkStatusDto {
    @IsEnum(PublishStatus)
    from: PublishStatus;

    @IsEnum(PublishStatus)
    to: PublishStatus;
}

export class BulkDeleteDto {
    @IsArray()
    @ArrayMaxSize(10000)
    @IsString({ each: true })
    contentIds: string[];
}
