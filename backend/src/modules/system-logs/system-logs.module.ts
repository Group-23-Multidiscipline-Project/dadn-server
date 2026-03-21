import { Module } from '@nestjs/common';
import { SystemLogsService } from './system-logs.service';

@Module({
  providers: [SystemLogsService],
  exports: [SystemLogsService],
})
export class SystemLogsModule {}
