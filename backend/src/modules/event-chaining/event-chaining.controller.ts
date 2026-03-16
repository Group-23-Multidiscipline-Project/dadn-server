import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EventChainingService } from './event-chaining.service';
import { SensorDataDto } from './dto/sensor-data.dto';
import { ConfirmWateringDto } from './dto/confirm-watering.dto';
import { EventLogQueryDto } from './dto/event-log-query.dto';

@ApiTags('Event Chaining')
@Controller()
export class EventChainingController {
  constructor(private readonly eventChainingService: EventChainingService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  getHello() {
    return 'Server is runnning';
  }

  @Post('sensor-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Push sensor data',
    description:
      'Nhận dữ liệu cảm biến (humidity, light) và chạy state machine.\n\n' +
      'MONITOR → WATERING khi humidity < 20 **và** light > 500.\n' +
      'WATERING → RECOVER sau 5 phút (300 s).\n' +
      'RECOVER → MONITOR sau 2 phút (120 s).',
  })
  async processSensorData(@Body() dto: SensorDataDto) {
    return this.eventChainingService.processSensorData(dto);
  }

  @Post('sensor-data/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm watering done (device ACK)',
    description:
      'Device xác nhận đã tưới xong. Chỉ có tác dụng khi state=WATERING và timer đã hết.',
  })
  async confirmWatering(@Body() dto: ConfirmWateringDto) {
    return this.eventChainingService.confirmWatering(dto);
  }

  @Get('state/:deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current device state snapshot' })
  @ApiParam({ name: 'deviceId', example: 'device_01' })
  async getDeviceState(@Param('deviceId') deviceId: string) {
    return this.eventChainingService.getDeviceState(deviceId);
  }

  @Get('event-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get event logs history' })
  @ApiQuery({ name: 'deviceId', required: false, type: String })
  @ApiQuery({ name: 'topic', required: false, type: String })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: ['MONITOR', 'WATERING', 'RECOVER'],
  })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 200 })
  async getEventLogs(@Query() query: EventLogQueryDto) {
    return this.eventChainingService.getEventLogs(query);
  }
}
