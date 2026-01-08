import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- CONFIGURASI CORS ---
  app.enableCors({
    // Masukkan URL frontend lo
    origin: [
      'http://localhost:3000', // Port default Next.js
      'http://127.0.0.1:3000'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Izinkan kirim cookie/header authorization
  });
  // ------------------------

  await app.listen(4000);
  console.log(`Backend "Pasti Lolos" jalan di: http://localhost:4000`);
}
bootstrap();