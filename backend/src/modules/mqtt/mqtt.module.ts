import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import {
  IrrigationEvent,
  IrrigationEventSchema,
} from './schemas/irrigation-event.schema';
import {
  SensorReading,
  SensorReadingSchema,
} from './schemas/sensor-reading.schema';
import {
  MqttSystemLog,
  MqttSystemLogSchema,
} from './schemas/system-log.schema';
import { ConfigModule } from '../config/config.module';
import { EventChainingModule } from '../event-chaining/event-chaining.module';
import { MqttSensorPayloadAdapterService } from './mqtt-sensor-payload-adapter.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SensorReading.name, schema: SensorReadingSchema },
      { name: IrrigationEvent.name, schema: IrrigationEventSchema },
      { name: MqttSystemLog.name, schema: MqttSystemLogSchema },
    ]),
    ConfigModule,
    EventChainingModule,
  ],
  exports: [MqttService],
  controllers: [MqttController],
  providers: [MqttService, MqttSensorPayloadAdapterService],
})
export class MqttModule {}
