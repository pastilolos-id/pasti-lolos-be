// src/app.module.ts
import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CoursesModule } from './courses/courses.module';
import { ExamsModule } from './exams/exams.module';
import { BankSoalModule } from './questions-bank/questions.module';
import { StudentsModule } from './students/students.module';
import { PaymentsModule } from './payments/payments.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time to live (dalam milidetik) = 60 detik
        limit: 20, // Maksimal 10 request per TTL
      },
    ]),
    // 1. Module untuk membaca file .env
    ConfigModule.forRoot({
      isGlobal: true, // Agar bisa diakses di semua module tanpa import ulang
    }),

    // 2. Module Database kita
    PrismaModule,

    // 3. Module Autentikasi kita
    AuthModule,
    CoursesModule,
    ExamsModule,
    BankSoalModule,
    AdminModule,
    StudentsModule,
    PaymentsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Pasang satpam secara Global
    },
  ],
})
export class AppModule {}
