export interface AppConfig {
  PORT: number;
  MONGO_URI: string;
  NODE_ENV: 'local' | 'staging' | 'production';
}
