import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventBusModule } from '../event-bus/event-bus.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { DeviceState, DeviceStateSchema } from '../../schemas/device-state.schema';
import { EventLog, EventLogSchema } from '../../schemas/event-log.schema';
import { EventChainingService } from './event-chaining.service';
import { EventChainingController } from './event-chaining.controller';
import { EventChainingGateway } from './event-chaining.gateway';

@Module({
  imports: [
    EventBusModule,
    SystemLogsModule,
    MongooseModule.forFeature([
      { name: DeviceState.name, schema: DeviceStateSchema },
      { name: EventLog.name, schema: EventLogSchema },
    ]),
  ],
  controllers: [EventChainingController],
  providers: [EventChainingService, EventChainingGateway],
  exports: [EventChainingService],
})
export class EventChainingModule {}
