// Runs the compiled NestJS app (dist/) as a single Netlify Function.
// Requests to /api/* are routed here by the redirect in netlify.toml.
import serverless from 'serverless-http';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

let cached;

async function bootstrap() {
  // Loaded lazily so that a failure while importing the app is caught and reported by the
  // handler below, instead of crashing the whole runtime before any request is answered.
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  const { configureApp } = await import('../dist/setup.js');
  // abortOnError:false makes a startup failure throw instead of killing the process
  // (Netlify would otherwise just show "exit status 1").
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

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * GET /api/_diag: reports what the deployed function can see, without starting Nest.
 * Never returns secret values, only whether they exist. Remove once the deploy is confirmed healthy.
 */
async function diagnose() {
  const out = {
    build: process.env.BUILD_COMMIT ?? 'unknown',
    node: process.version,
    lambda: Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME),
    env: Object.fromEntries(
      ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_URL', 'FRONTEND_URL'].map((k) => [k, Boolean(process.env[k])]),
    ),
  };
  try {
    out.prismaFiles = readdirSync(join(process.cwd(), 'node_modules', '.prisma', 'client')).filter((f) =>
      /engine|schema\.prisma|^index\.js$/.test(f),
    );
  } catch (e) {
    out.prismaFiles = `unreadable (${e.code ?? e.message})`;
  }
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('database query timed out after 8s')), 8000));
    await Promise.race([prisma.$queryRaw`select 1`, timeout]);
    out.database = 'ok';
    await prisma.$disconnect();
  } catch (e) {
    out.database = describe(e);
  }
  return json(200, out);
}

export const handler = async (event, context) => {
  if (event.path.endsWith('/_diag')) return diagnose();

  let run;
  try {
    cached ??= bootstrap();
    run = await cached;
  } catch (err) {
    cached = undefined; // let the next request try again
    console.error('API failed to start:', err);
    return json(500, { message: 'API failed to start', detail: describe(err) });
  }

  // Depending on how the request was routed, the path arrives either as the original
  // "/api/..." or as "/.netlify/functions/api/...". Normalise to what Nest expects.
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '') || '/';
  event.path = path.startsWith('/api') || path.startsWith('/uploads') ? path : `/api${path}`;

  return run(event, context);
};
