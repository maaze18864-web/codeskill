import { Module } from '@nestjs/common';
import { SqlEngineService } from './sql-engine.service';
@Module({ providers: [SqlEngineService], exports: [SqlEngineService] })
export class SqlModule {}
