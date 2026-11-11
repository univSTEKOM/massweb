import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Project, ProjectType } from '../entities/project.entity';
import { CsvColumn } from '../entities/csv-column.entity';
import { CsvRow } from '../entities/csv-row.entity';

@Injectable()
export class CsvService {
    constructor(
        @InjectRepository(CsvColumn)
        private csvColumnRepository: Repository<CsvColumn>,
        @InjectRepository(CsvRow)
        private csvRowRepository: Repository<CsvRow>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
    ) { }

    async parseAndSaveFile(projectId: string, file: Express.Multer.File): Promise<{
        columns: CsvColumn[];
        rowCount: number;
        totalCombinations: number;
    }> {
        const project = await this.projectRepository.findOne({ where: { id: projectId }, select: ['id', 'type'] });
        if (project?.type === ProjectType.MANUAL) {
            throw new BadRequestException('Manual projects do not use CSV/Excel import');
        }

        const fileName = file.originalname.toLowerCase();
        let data: Record<string, string>[];
        let headers: string[];

        // Parse based on file type
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            // Parse Excel file
            const result = this.parseExcelFile(file.buffer);
            data = result.data;
            headers = result.headers;
        } else {
            // Parse CSV file
            const result = this.parseCsvFile(file.buffer);
            data = result.data;
            headers = result.headers;
        }

        if (!headers || headers.length === 0) {
            throw new BadRequestException('File must have headers');
        }

        if (data.length === 0) {
            throw new BadRequestException('File must have at least one row of data');
        }

        // Delete existing data for this project
        await this.csvColumnRepository.delete({ projectId });
        await this.csvRowRepository.delete({ projectId });

        // Save columns
        const columnEntities: CsvColumn[] = headers.map((header, i) =>
            this.csvColumnRepository.create({
                projectId,
                columnName: header,
                columnType: 'text',
                columnOrder: i,
            })
        );
        const savedColumns = await this.csvColumnRepository.save(columnEntities);

        // STREAMING BATCH SAVE - process in chunks without holding all entities in memory
        const BATCH_SIZE = 200;
        let rowCount = 0;
        const uniqueValuesByColumn: Map<string, Set<string>> = new Map();

        // Initialize sets for combination calculation
        headers.forEach(header => {
            uniqueValuesByColumn.set(header, new Set());
        });

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batchData = data.slice(i, i + BATCH_SIZE);

            // Create entities for this batch only
            const batchEntities = batchData.map((rowData, idx) => {
                // Track unique values for combinations while processing
                headers.forEach(header => {
                    if (rowData[header]) {
                        uniqueValuesByColumn.get(header)?.add(rowData[header]);
                    }
                });

                return this.csvRowRepository.create({
                    projectId,
                    rowData,
                    rowOrder: i + idx,
                });
            });

            // Save batch and discard from memory
            await this.csvRowRepository.save(batchEntities);
            rowCount += batchEntities.length;
        }

        // Calculate total combinations
        let totalCombinations = 1;
        uniqueValuesByColumn.forEach(valueSet => {
            totalCombinations *= Math.max(valueSet.size, 1);
        });

        // Clear the parsed data from memory
        data.length = 0;

        return {
            columns: savedColumns,
            rowCount,
            totalCombinations,
        };
    }

    private parseCsvFile(buffer: Buffer): { data: Record<string, string>[]; headers: string[] } {
        const csvContent = buffer.toString('utf-8');

        const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
        });

        if (parsed.errors && parsed.errors.length > 0) {
            throw new BadRequestException(`CSV parsing error: ${parsed.errors[0].message}`);
        }

        return {
            data: parsed.data as Record<string, string>[],
            headers: parsed.meta.fields || [],
        };
    }

    private parseExcelFile(buffer: Buffer): { data: Record<string, string>[]; headers: string[] } {
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });

            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                throw new BadRequestException('Excel file has no sheets');
            }

            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON with header row
            const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
                raw: false,  // Get formatted strings instead of raw values
                defval: '',  // Default value for empty cells
            });

            if (jsonData.length === 0) {
                return { data: [], headers: [] };
            }

            // Get headers from first row keys
            const headers = Object.keys(jsonData[0]).map(h => h.trim());

            // Convert all values to strings
            const data = jsonData.map(row => {
                const stringRow: Record<string, string> = {};
                for (const key of Object.keys(row)) {
                    stringRow[key.trim()] = String(row[key] ?? '');
                }
                return stringRow;
            });

            return { data, headers };
        } catch (error: any) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(`Excel parsing error: ${error.message}`);
        }
    }


    async getCsvData(projectId: string): Promise<{
        columns: CsvColumn[];
        rows: CsvRow[];
    }> {
        const columns = await this.csvColumnRepository.find({
            where: { projectId },
            order: { columnOrder: 'ASC' },
        });

        const rows = await this.csvRowRepository.find({
            where: { projectId },
            order: { rowOrder: 'ASC' },
        });

        return { columns, rows };
    }
}
