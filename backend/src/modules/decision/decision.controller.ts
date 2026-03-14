import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DecisionService } from './decision.service';
import { SensorPushDto } from './dto/sensor-push.dto';
import { GetDecisionLogsDto } from './dto/get-decision-logs.dto';

@Controller()
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  /**
   * POST /sensor-push
   * Called by the IoT device to submit a sensor reading.
   * Triggers the full decision pipeline and updates the simulation state.
   */
  @Post('sensor-push')
  @HttpCode(HttpStatus.CREATED)
  async sensorPush(@Body() dto: SensorPushDto) {
    const result = await this.decisionService.processSensorPush(dto);
    return {
      readingId: result.reading._id,
      logId: result.log._id,
      decisions: result.decisions,
    };
  }

  /**
   * GET /dashboard
   * Returns the current simulation state (relay status + latest readings).
   * Frontend polls this endpoint periodically.
   */
  @Get('dashboard')
  async getDashboard() {
    const state = await this.decisionService.getSimulationState();
    if (!state) {
      throw new NotFoundException(
        'Chưa có dữ liệu — hãy gửi ít nhất một sensor reading trước.',
      );
    }
    return state;
  }

  /**
   * GET /decision-logs?page=1&limit=20&status=pending
   * Returns paginated decision logs.
   */
  @Get('decision-logs')
  async getDecisionLogs(@Query() query: GetDecisionLogsDto) {
    return this.decisionService.getDecisionLogs({
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }

  /**
   * PATCH /decision-logs/:id/acknowledge
   * Marks a decision log as acknowledged (frontend has displayed it).
   */
  @Patch('decision-logs/:id/acknowledge')
  async acknowledgeLog(@Param('id') id: string) {
    return this.decisionService.acknowledgeDecisionLog(id);
  }
}
