import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './setup.js';

const app = await NestFactory.create(AppModule);
configureApp(app);

const doc = SwaggerModule.createDocument(
  app,
  new DocumentBuilder().setTitle('Boutique API').addBearerAuth().build(),
);
SwaggerModule.setup('api/docs', app, doc);

await app.listen(process.env.PORT ?? 4000);
