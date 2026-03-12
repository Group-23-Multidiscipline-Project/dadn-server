export interface AppConfig {
  PORT: number;
  MONGO_URI: string;
  MQTT_URL: string;
  NODE_ENV: 'local' | 'staging' | 'production';
}
