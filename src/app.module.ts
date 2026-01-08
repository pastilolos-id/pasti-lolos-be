// src/app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CoursesModule } from './courses/courses.module';
import { ExamsModule } from './exams/exams.module';

@Module({
  imports: [
    // 1. Module untuk membaca file .env
    ConfigModule.forRoot({
      isGlobal: true, // Agar bisa diakses di semua module tanpa import ulang
    }),
    
    // 2. Module Database kita
    PrismaModule, 
    
    // 3. Module Autentikasi kita
    AuthModule, CoursesModule, ExamsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}