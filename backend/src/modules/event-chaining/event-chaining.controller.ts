import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { EventChainingService } from './event-chaining.service';
import { SensorDataDto } from './dto/sensor-data.dto';
import { ConfirmWateringDto } from './dto/confirm-watering.dto';

@Controller()
export class EventChainingController {
  constructor(private readonly eventChainingService: EventChainingService) {}

  @Post('sensor-data')
  @HttpCode(HttpStatus.OK)
  async processSensorData(@Body() dto: SensorDataDto) {
    return this.eventChainingService.processSensorData(dto);
  }

  @Post('sensor-data/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmWatering(@Body() dto: ConfirmWateringDto) {
    return this.eventChainingService.confirmWatering(dto);
  }
}
