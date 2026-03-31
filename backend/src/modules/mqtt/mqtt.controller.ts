import { Controller, Get, LOG_LEVELS, Query } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  MqttContext,
  Payload,
} from '@nestjs/microservices';
import { IrrigationStatusQueryDto } from './dto/irrigation-status-query.dto';
import { SensorHistoryQueryDto } from './dto/sensor-history-query.dto';
import { SystemLogQueryDto } from './dto/system-log-query.dto';
import { MqttService } from './mqtt.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SensorValueDto } from './dto/sensor.dto';

@ApiTags('mqtt')
@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @MessagePattern('#')
  async handleIncomingMessage(
    @Payload() payload: SensorValueDto,
    @Ctx() context: MqttContext,
  ): Promise<void> {
    await this.mqttService.handleIncomingMessage(payload, context);
  }

  @Get('sensors/history')
  @ApiOperation({ summary: 'Get sensor history' })
  @ApiQuery({ name: 'nodeId', required: false, type: String })
  @ApiQuery({ name: 'sensor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  getSensorHistory(@Query() query: SensorHistoryQueryDto) {
    return this.mqttService.getSensorHistory(query);
  }

  @Get('irrigation/status')
  @ApiOperation({ summary: 'Get irrigation status' })
  @ApiQuery({ name: 'nodeId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  getIrrigationStatus(@Query() query: IrrigationStatusQueryDto) {
    return this.mqttService.getIrrigationStatus(query);
  }

  @Get('system/logs')
  @ApiOperation({ summary: 'Get system logs' })
  @ApiQuery({
    name: 'level',
    required: false,
    enum: LOG_LEVELS,
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  getSystemLogs(@Query() query: SystemLogQueryDto) {
    return this.mqttService.getSystemLogs(query);
  }
}
