import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.enableCors();
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: false,
      whitelist: true, // Hacker kirim field aneh? Langsung dihapus/diabaikan.
      forbidNonWhitelisted: true, // Kalo ada field siluman, kirim error 400.
      transform: true, // Otomatis ubah string ke number (sangat membantu).
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        return new BadRequestException({
          statusCode: 400,
          // error: 'Bad Request',
          message:
            'Error validation. Pastikan semua data sudah benar dan lengkap.',
          errors: validationErrors.reduce((acc, error) => {
            // Ambil semua pesan error dari constraints validator (IsNotEmpty, Matches, dll)
            acc[error.property] = Object.values(error.constraints || {});
            return acc;
          }, {}),
          // errors: validationErrors, // Sertakan array error lengkap untuk debugging (opsional)
        });
      },
    }),
  );
  // --- CONFIGURASI CORS ---
  app.enableCors({
    // Masukkan URL frontend lokal dan production (Vercel) lo di sini
    origin: [
      // URL Production Vercel lo:
      'https://pastilolos.id',
      'https://admn.pastilolos.id',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Wajib true kalau nanti mainan cookie / session / @UseGuards jwt
  });
  // ------------------------

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pasti Lolos API')
    .setDescription('API documentation for Pasti Lolos')
    .setVersion('1.0')
    .addCookieAuth('token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(4000, '0.0.0.0');
  console.log(`Backend "Pasti Lolos" jalan di: http://localhost:4000`);
  console.log(`Swagger UI: http://localhost:4000/api-docs`);
}
void bootstrap();
