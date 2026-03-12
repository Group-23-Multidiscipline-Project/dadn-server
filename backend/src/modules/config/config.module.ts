import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config.validation';
import { ConfigService } from './config.service';

@Module({
  exports: [ConfigService],
  providers: [ConfigService],
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: configValidationSchema,
    }),
  ],
})
export class ConfigModule {}
