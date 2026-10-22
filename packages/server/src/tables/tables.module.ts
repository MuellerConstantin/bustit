import { Module } from '@nestjs/common';
import { TablesBocController } from './tables.boc.controller.js';
import { TablesController } from './tables.controller.js';
import { TablesService } from './tables.service.js';

@Module({
  controllers: [TablesController, TablesBocController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
