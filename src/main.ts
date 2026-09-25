import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api', { exclude: ['uploads/(.*)'] });
app.enableCors({
  origin: [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
    process.env.ADMIN_URL ?? 'http://localhost:3001',
  ],
});
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

const doc = SwaggerModule.createDocument(
  app,
  new DocumentBuilder().setTitle('Boutique API').addBearerAuth().build(),
);
SwaggerModule.setup('api/docs', app, doc);

await app.listen(process.env.PORT ?? 4000);
