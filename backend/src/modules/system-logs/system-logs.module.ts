import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemLog, SystemLogSchema } from '../../schemas/system-log.schema';
import { SystemLogsService } from './system-logs.service';
import { SystemLogsController } from './system-logs.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemLog.name, schema: SystemLogSchema },
    ]),
  ],
  controllers: [SystemLogsController],
  providers: [SystemLogsService],
  exports: [SystemLogsService],
})
export class SystemLogsModule {}
