// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'; // <-- Tambahkan NestModule & MiddlewareConsumer
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
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ForceHttpsMiddleware } from './common/middleware/force-https.middleware';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, 
        limit: 200, 
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    PrismaModule,
    AuthModule,
    CoursesModule,
    ExamsModule,
    BankSoalModule,
    AdminModule,
    StudentsModule,
    PaymentsModule,
    OrdersModule,
    NotificationsModule,
    DashboardModule,
    TransactionsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, 
    },
  ],
})
export class AppModule implements NestModule { // <-- Tambahkan implements NestModule
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ForceHttpsMiddleware)
      .forRoutes('*'); // Menerapkan middleware ke seluruh rute aplikasi
  }
}