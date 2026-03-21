import { Injectable } from '@nestjs/common';

type EventChainingSensorKey = 'moisture' | 'light' | 'humidity' | 'temperature';

@Injectable()
export class MqttSensorPayloadAdapterService {
  private readonly sensorAliasMap = new Map<string, EventChainingSensorKey>([
    ['air_humidity', 'humidity'],
    ['soil_moisture', 'moisture'],
    ['light', 'light'],
    ['temperature', 'temperature'],
    ['light_intensity', 'light'],
    ['light-intensity', 'light'],
    ['lux', 'light'],
    ['ldr', 'light'],
  ]);

  normalizeSensorKey(sensor: string): string {
    const normalized = sensor.trim().toLowerCase();
    return this.sensorAliasMap.get(normalized) ?? normalized;
  }

  mapValueToReading(sensor: string, value: number): Record<string, number> {
    const normalizedSensor = this.normalizeSensorKey(sensor);
    return {
      [normalizedSensor]: value,
    };
  }

  getEventChainingSensorKey(sensor: string): EventChainingSensorKey | null {
    const normalizedSensor = this.normalizeSensorKey(sensor);
    if (normalizedSensor === 'moisture' || normalizedSensor === 'light') {
      return normalizedSensor;
    }

    return null;
  }
}
