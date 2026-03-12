// src/bank-soal/bank-soal.module.ts
import { Module } from '@nestjs/common';
import { BankSoalService } from './questions-bank.service';
import { BankSoalController } from './questions-bank.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [BankSoalController],
  providers: [BankSoalService],
  exports: [BankSoalService], // Export kalo sewaktu-waktu dipake module lain
})
export class BankSoalModule {}
