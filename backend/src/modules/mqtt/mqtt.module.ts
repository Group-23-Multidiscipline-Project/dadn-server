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
import { SystemLog, SystemLogSchema } from './schemas/system-log.schema';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SensorReading.name, schema: SensorReadingSchema },
      { name: IrrigationEvent.name, schema: IrrigationEventSchema },
      { name: SystemLog.name, schema: SystemLogSchema },
    ]),
    ConfigModule,
  ],
  exports: [MqttService],
  controllers: [MqttController],
  providers: [MqttService],
})
export class MqttModule {}
