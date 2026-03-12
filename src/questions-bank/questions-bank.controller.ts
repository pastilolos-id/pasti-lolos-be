// src/bank-soal/bank-soal.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { BankSoalService } from './questions-bank.service';

@Controller('bank-soal')
@UseGuards(AuthGuard('jwt'))
export class BankSoalController {
  constructor(private readonly bankSoalService: BankSoalService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File harus berupa PDF');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.bankSoalService.uploadBankSoal(file, body, req.user.userId);
  }

  @Get()
  async getBankSoal(
    @Query('category') category?: string,
    @Query('sub_category') subCategory?: string,
  ) {
    return this.bankSoalService.getBankSoal(category, subCategory);
  }
}
