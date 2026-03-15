import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MqttOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import 'dotenv/config';

const mqttOptions: MqttOptions = {
  transport: Transport.MQTT,
  options: {
    host: process.env.MQTT_HOST,
    port: Number(process.env.MQTT_PORT ?? 8883),
    protocol: 'mqtts',
    username: process.env.HIVEMQ_USERNAME ?? 'admin',
    password: process.env.HIVEMQ_PASSWORD,
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
    .setTitle('DADN API')
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
