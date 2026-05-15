import { Module } from '@nestjs/common';
import { BankSoalService } from './questions-bank.service';
import { BankSoalController } from './questions-bank.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, CloudinaryModule, NotificationsModule],
  controllers: [BankSoalController],
  providers: [BankSoalService],
  exports: [BankSoalService],
})
export class BankSoalModule {}
