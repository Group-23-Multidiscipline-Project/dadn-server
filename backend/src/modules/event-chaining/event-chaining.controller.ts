import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventChainingService } from './event-chaining.service';
import { EventLogQueryDto } from './dto/event-log-query.dto';

@ApiTags('Event Chaining')
@Controller()
export class EventChainingController {
  constructor(private readonly eventChainingService: EventChainingService) {}

  @Get()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Health check' })
  getHello() {
    return 'Server is runnning';
  }

  @Get('state/:deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current device state snapshot' })
  @ApiParam({ name: 'deviceId', example: 'node_01' })
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
