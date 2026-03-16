import { Injectable } from '@nestjs/common';

type EventChainingSensorKey = 'humidity' | 'light';

@Injectable()
export class MqttSensorPayloadAdapterService {
  private readonly sensorAliasMap = new Map<string, EventChainingSensorKey>([
    ['humidity', 'humidity'],
    ['soil_moisture', 'humidity'],
    ['soil-moisture', 'humidity'],
    ['moisture', 'humidity'],
    ['light', 'light'],
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
    if (normalizedSensor === 'humidity' || normalizedSensor === 'light') {
      return normalizedSensor;
    }

    return null;
  }
}