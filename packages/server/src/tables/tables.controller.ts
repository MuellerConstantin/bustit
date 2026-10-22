import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  type ListTablesQuery,
  type TablePage,
  listTablesQuerySchema,
} from '@bustit/shared';
import { InvalidFilterError } from '../infrastructure/filtering/index.js';
import { pageOf } from '../infrastructure/pagination/index.js';
import { ZodValidationPipe } from '../infrastructure/validation/index.js';
import { toTableResponse } from './table-response.js';
import { TablesService } from './tables.service.js';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  /** The open tables, newest first; closed ones are left out. */
  @Get()
  async list(
    @Query(new ZodValidationPipe(listTablesQuerySchema))
    query: ListTablesQuery,
  ): Promise<TablePage> {
    try {
      const { tables, totalElements } = await this.tablesService.list(query, {
        openOnly: true,
      });
      return pageOf(tables.map(toTableResponse), totalElements, query);
    } catch (error) {
      if (error instanceof InvalidFilterError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
