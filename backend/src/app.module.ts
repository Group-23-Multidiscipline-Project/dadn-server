import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './modules/config/config.module';
import { ConfigService } from './modules/config/config.service';
import { DecisionModule } from './modules/decision/decision.module';
import { EventChainingModule } from './modules/event-chaining/event-chaining.module';

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
    DecisionModule,
    EventChainingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
