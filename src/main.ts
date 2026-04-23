import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors()
  app.useGlobalFilters(new PrismaExceptionFilter())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Hacker kirim field aneh? Langsung dihapus/diabaikan.
      forbidNonWhitelisted: true, // Kalo ada field siluman, kirim error 400.
      transform: true, // Otomatis ubah string ke number (sangat membantu).
    }),
  );
  // --- CONFIGURASI CORS ---
  app.enableCors({
    // Masukkan URL frontend lo
    origin: [
      'http://localhost:3000', // Port default Next.js
      'http://127.0.0.1:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Izinkan kirim cookie/header authorization
  });
  // ------------------------

  await app.listen(4000);
  console.log(`Backend "Pasti Lolos" jalan di: http://localhost:4000`);
}
void bootstrap();
