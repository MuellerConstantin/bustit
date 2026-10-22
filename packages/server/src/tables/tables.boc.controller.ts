import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  type BocTable,
  type BocTablePage,
  type CreateTableRequest,
  type ListTablesQuery,
  createTableRequestSchema,
  listTablesQuerySchema,
} from '@bustit/shared';
import { z } from 'zod';
import { Roles } from '../auth/index.js';
import { InvalidFilterError } from '../infrastructure/filtering/index.js';
import { pageOf } from '../infrastructure/pagination/index.js';
import { ZodValidationPipe } from '../infrastructure/validation/index.js';
import { toBocTable } from './table-response.js';
import { TableNameTakenError, TableNotFoundError } from './tables.errors.js';
import { TablesService } from './tables.service.js';

/** Tables in the operations console. */
@Roles('admin')
@Controller('boc/tables')
export class TablesBocController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTableRequestSchema))
    body: CreateTableRequest,
  ): Promise<BocTable> {
    try {
      const table = await this.tablesService.create(body);
      return toBocTable({ ...table, status: 'open' });
    } catch (error) {
      if (error instanceof TableNameTakenError) {
        throw new ConflictException('The table name is taken');
      }

      throw error;
    }
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listTablesQuerySchema))
    query: ListTablesQuery,
  ): Promise<BocTablePage> {
    try {
      const { tables, totalElements } = await this.tablesService.list(query);
      return pageOf(tables.map(toBocTable), totalElements, query);
    } catch (error) {
      if (error instanceof InvalidFilterError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  /** Closing keeps the table listed, so this isn't a DELETE. */
  @Post(':id/close')
  @HttpCode(HttpStatus.NO_CONTENT)
  async close(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
  ): Promise<void> {
    try {
      await this.tablesService.close(id);
    } catch (error) {
      if (error instanceof TableNotFoundError) {
        throw new NotFoundException('No such table');
      }

      throw error;
    }
  }
}
