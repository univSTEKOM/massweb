import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ContentGeneratorController } from './content-generator.controller';
import { ContentGeneratorService } from './content-generator.service';
import { ExportService } from './export.service';
import { PublishSchedulerService } from './publish-scheduler.service';
import { ContentGenerationProcessor, ContentPublishingProcessor } from './content-generator.processor';
import { GeneratedContent } from '../entities/generated-content.entity';
import { Project } from '../entities/project.entity';
import { CsvRow } from '../entities/csv-row.entity';
import { CsvColumn } from '../entities/csv-column.entity';
import { PublishJob } from '../entities/publish-job.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([GeneratedContent, Project, CsvRow, CsvColumn, PublishJob]),
        BullModule.registerQueue(
            { name: 'content-generation' },
            { name: 'content-publishing' },
        ),
        ScheduleModule.forRoot(),
    ],
    controllers: [ContentGeneratorController],
    providers: [ContentGeneratorService, ExportService, PublishSchedulerService, ContentGenerationProcessor, ContentPublishingProcessor],
    exports: [ContentGeneratorService, ExportService],
})
export class ContentGeneratorModule { }
