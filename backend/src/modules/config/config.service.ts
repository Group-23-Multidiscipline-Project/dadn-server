import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { AppConfig } from './interfaces/config.interface';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService<AppConfig>) {}

  get<K extends keyof AppConfig>(key: K): undefined | AppConfig[K] {
    return this.configService.get<AppConfig[K]>(key);
  }

  get nodeEnv() {
    return this.get('NODE_ENV') ?? 'local';
  }

  get port() {
    return this.get('PORT') ?? '3000';
  }

  get databaseConfig() {
    return {
      mongoUri: this.get('MONGO_URI'),
    };
  }
}
