import { Controller, Get, Query } from '@nestjs/common';
import {
  type PageQuery,
  type TablePage,
  pageQuerySchema,
} from '@bustit/shared';
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
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<TablePage> {
    const { tables, totalElements } = await this.tablesService.list({
      ...query,
      filter: 'status==open',
    });
    return pageOf(tables.map(toTableResponse), totalElements, query);
  }
}
