import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamsModule } from '../exams/exams.module'; // Import jika butuh logic dari ExamsService
import { CertificatesService } from './certificates.service';

// @Module({
//   imports: [
//     PrismaModule, 
//     // Jika lo mau pake fungsi startExam/submitAnswer dari ExamsService di modul ini, 
//     // pastikan ExamsModule sudah di-export dan di-import di sini.
//   ],
//   controllers: [StudentsController],
//   providers: [StudentsService],
//   exports: [StudentsService], // Export jika service ini mau dipake modul lain
// })
// export class StudentsModule {}

@Module({
  imports: [PrismaModule], // Pastikan ada PrismaModule juga
  controllers: [StudentsController],
  providers: [StudentsService, CertificatesService], // TAMBAHKAN CertificatesService di sini
})
export class StudentsModule {}