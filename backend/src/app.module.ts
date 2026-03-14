import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from './app.service';
import { ConfigModule } from './modules/config/config.module';
import { ConfigService } from './modules/config/config.service';
import { EventChainingModule } from './modules/event-chaining/event-chaining.module';
import { MqttModule } from './modules/mqtt/mqtt.module';

@Module({
  imports: [
    ConfigModule,
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
    EventChainingModule,
    MqttModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
