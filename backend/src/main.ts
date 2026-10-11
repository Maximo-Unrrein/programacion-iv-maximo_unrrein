import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  const allowed = (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(',').map((o) => o.trim());
  // En desarrollo se acepta cualquier puerto de localhost (por si el frontend corre en 4201, 4300, etc.)
  const localDev = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || allowed.includes(origin) || (!isProd && localDev.test(origin))),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
