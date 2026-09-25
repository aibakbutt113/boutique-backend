// Runs the compiled NestJS app (dist/) as a single Netlify Function.
// Requests to /api/* are routed here by the redirect in netlify.toml.
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/setup.js';

let cached;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  return serverless(app.getHttpAdapter().getInstance());
}

export const handler = async (event, context) => {
  cached ??= bootstrap();
  const run = await cached;

  // Depending on how the request was routed, the path arrives either as the original
  // "/api/..." or as "/.netlify/functions/api/...". Normalise to what Nest expects.
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
  event.path = path.startsWith('/api') || path.startsWith('/uploads') ? path : `/api${path}`;

  return run(event, context);
};
