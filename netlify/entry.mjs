// Runs the compiled NestJS app (dist/) as a single Netlify Function.
// Requests to /api/* are routed here by the redirect in netlify.toml.
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/setup.js';

let cached;

async function bootstrap() {
  // abortOnError:false makes a startup failure throw instead of killing the process,
  // so the handler below can report it (Netlify would otherwise just show "exit status 1").
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], abortOnError: false });
  configureApp(app);
  await app.init();
  return serverless(app.getHttpAdapter().getInstance());
}

/** First line of an error, with any connection string credentials removed. */
const describe = (err) =>
  String(err?.message ?? err)
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('Invalid `'))
    ?.replace(/[a-z]+:\/\/\S+/gi, '<url>') ?? 'unknown error';

export const handler = async (event, context) => {
  let run;
  try {
    cached ??= bootstrap();
    run = await cached;
  } catch (err) {
    cached = undefined; // let the next request try again
    console.error('API failed to start:', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'API failed to start', detail: describe(err) }),
    };
  }

  // Depending on how the request was routed, the path arrives either as the original
  // "/api/..." or as "/.netlify/functions/api/...". Normalise to what Nest expects.
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
  event.path = path.startsWith('/api') || path.startsWith('/uploads') ? path : `/api${path}`;

  return run(event, context);
};
