import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { ConfigService } from './modules/config/config.service';
import { ConfigModule } from './modules/config/config.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          uri:
            configService.databaseConfig?.mongoUri ??
            'mongodb://localhost:27017/yolofarm',
        };
      },
    }),
    MqttModule,
    ConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
