export interface AppConfig {
  PORT: number;
  MONGO_URI: string;
  HIVEMQ_USERNAME: string;
  HIVEMQ_PASSWORD: string;
  MQTT_HOST: string;
  MQTT_PORT: number;
  NODE_ENV: 'local' | 'staging' | 'production';
}
