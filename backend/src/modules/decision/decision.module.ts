import { Module } from '@nestjs/common';

import {
  SensorReading,
  SensorReadingSchema,
} from '../../schemas/sensor-reading.schema';
import {
  DecisionLog,
  DecisionLogSchema,
} from '../../schemas/decision-log.schema';
import {
  SpeciesThreshold,
  SpeciesThresholdSchema,
} from '../../schemas/species-threshold.schema';
import {
  SimulationState,
  SimulationStateSchema,
} from '../../schemas/simulation-state.schema';
import { EventBusModule } from '../event-bus/event-bus.module';

import { DecisionService } from './decision.service';
import { DecisionController } from './decision.controller';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    EventBusModule,
    MongooseModule.forFeature([
      { name: SensorReading.name, schema: SensorReadingSchema },
      { name: DecisionLog.name, schema: DecisionLogSchema },
      { name: SpeciesThreshold.name, schema: SpeciesThresholdSchema },
      { name: SimulationState.name, schema: SimulationStateSchema },
    ]),
  ],
  controllers: [DecisionController],
  providers: [DecisionService],
})
export class DecisionModule {}
