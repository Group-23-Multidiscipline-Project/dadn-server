import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SystemLogsService } from './system-logs.service';
import { SystemLogsQueryDto } from './dto/system-logs-query.dto';

@ApiTags('system-logs')
@Controller('system/logs')
export class SystemLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get state-machine system logs' })
  @ApiQuery({ name: 'deviceId', required: false, type: String })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'traceId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 200 })
  getLogs(@Query() query: SystemLogsQueryDto) {
    return this.systemLogsService.getLogs(query);
  }
}
