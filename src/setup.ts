import { ValidationPipe, type INestApplication } from '@nestjs/common';

/** Configuration shared by the long-running server (main.ts) and the Netlify function. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api', { exclude: ['uploads/{*path}'] });
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      process.env.ADMIN_URL ?? 'http://localhost:3001',
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
