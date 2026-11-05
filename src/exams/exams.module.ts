import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ExamPackagesService } from './exam-packages.service';
import { ExamPackagesController } from './exam-packages.controller';
import { ExamReviewService } from './exam-review.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [
    ExamsService,
    ExamPackagesService,
    ExamReviewService,
    PrismaService,
    CloudinaryService,
  ],
  controllers: [ExamsController, ExamPackagesController],
  exports: [ExamReviewService, ExamPackagesService],
})
export class ExamsModule {}
