import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ExamReviewService } from './exam-review.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [
    ExamsService,
    ExamReviewService,
    PrismaService,
    CloudinaryService, // <-- WAJIB ADA DI SINI
  ],
  controllers: [ExamsController],
  exports: [ExamReviewService],
})
export class ExamsModule {}
