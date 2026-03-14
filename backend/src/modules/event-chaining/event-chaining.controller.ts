import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { EventChainingService } from './event-chaining.service';
import { SensorDataDto } from './dto/sensor-data.dto';
import { ConfirmWateringDto } from './dto/confirm-watering.dto';

@Controller()
export class EventChainingController {
  constructor(private readonly eventChainingService: EventChainingService) {}

  @Get()
  getHello() {
    return 'Server is runnning';
  }

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

  @Get('state/:deviceId')
  @HttpCode(HttpStatus.OK)
  async getDeviceState(@Param('deviceId') deviceId: string) {
    return this.eventChainingService.getDeviceState(deviceId);
  }
}
