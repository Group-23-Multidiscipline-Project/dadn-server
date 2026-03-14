import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChainState } from '../../schemas/device-state.schema';

interface RealtimePayload {
  deviceId: string;
  state: ChainState;
  action: string;
  durationSeconds: number;
  timestamp: string;
}

interface EventServer {
  emit(event: string, payload: RealtimePayload): void;
}

@WebSocketGateway({
  namespace: '/events',
  cors: { origin: '*' },
})
export class EventChainingGateway {
  @WebSocketServer()
  server: EventServer;

  publishState(payload: RealtimePayload) {
    this.server.emit('state_change', payload);

    if (payload.action === 'start_pump') {
      this.server.emit('event_update', payload);
      return;
    }

    if (payload.action === 'stop_pump') {
      this.server.emit('pump_stopped', payload);
      return;
    }

    if (payload.state === ChainState.MONITOR) {
      this.server.emit('monitoring', payload);
    }
  }
}
