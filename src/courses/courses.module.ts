import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [CoursesService],
  controllers: [CoursesController],
  imports: [CloudinaryModule, NotificationsModule],
})
export class CoursesModule {}
