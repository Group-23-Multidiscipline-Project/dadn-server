export interface AppConfig {
  PORT: number;
  MONGO_URI: string;
  HIVEMQ_USERNAME: string;
  HIVEMQ_PASSWORD: string;
  MQTT_URL: string;
  NODE_ENV: 'local' | 'staging' | 'production';
}
