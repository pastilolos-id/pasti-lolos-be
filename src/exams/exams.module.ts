import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';

@Module({
  providers: [
    ExamsService,
    PrismaService,
    CloudinaryService, // <-- WAJIB ADA DI SINI
  ],
  controllers: [ExamsController],
})
export class ExamsModule {}
