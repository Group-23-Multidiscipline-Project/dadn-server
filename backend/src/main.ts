import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MqttOptions } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const mqttOptions: MqttOptions = {
  transport: 3,
  options: {
    url: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    subscribeOptions: {
      qos: 1,
    },
  },
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.connectMicroservice<MqttOptions>(mqttOptions);

  await app.startAllMicroservices();

  const config = new DocumentBuilder()
    .setTitle('Smart Agri API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addTag('api')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
void bootstrap();
