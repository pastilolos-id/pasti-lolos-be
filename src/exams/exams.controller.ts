// src/exams/exams.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  // Patch,
  // Delete,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { AddQuestionToExamDto } from './dto/add-question-to-exam.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';

// Interface untuk Type-Safety Request
interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    roles: string[];
  };
}

@Controller('exams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExamsController {
  prisma: any;
  constructor(private readonly examsService: ExamsService) {}

  // --- CRUD EXAMS ---
  @Post()
  @Roles('admin', 'kontributor')
  createExam(@Body() body: CreateExamDto, @Req() req: RequestWithUser) {
    return this.examsService.createExam(body, req.user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: RequestWithUser, // Gunakan interface yang tadi sudah lo buat
  ) {
    // Masukkan argumen kedua yaitu userId dari request
    return this.examsService.findOneExam(+id, req.user.userId);
  }

  // --- QUESTIONS & ANSWERS ---
  @Post('questions')
  @Roles('admin', 'kontributor')
  createQuestion(@Body() body: CreateQuestionDto, @Req() req: RequestWithUser) {
    return this.examsService.createQuestion(body, req.user.userId);
  }

  @Post('answers')
  createAnswer(@Body() body: CreateAnswerDto, @Req() req: RequestWithUser) {
    return this.examsService.createAnswer(body, req.user.userId);
  }

  @Post('add-question')
  addQuestionToExam(@Body() body: AddQuestionToExamDto) {
    return this.examsService.addQuestionToExam(body);
  }

  // --- MEKANISME UJIAN (Attempts) ---
  @Post('start/:examId')
  @Roles('murid')
  start(@Param('examId') examId: string, @Req() req: RequestWithUser) {
    return this.examsService.startExam(+examId, req.user.userId);
  }

  @Post('submit-answer')
  @Roles('murid')
  submit(
    @Body() body: { userExamId: number; questionId: number; answerId: number },
    @Req() req: RequestWithUser,
  ) {
    // Kita tambahin req.user.userId buat validasi kepemilikan sesi di service
    return this.examsService.submitAnswer(
      body.userExamId,
      body.questionId,
      body.answerId,
      req.user.userId,
    );
  }

  @Post('finish/:userExamId')
  @Roles('murid')
  finish(@Param('userExamId') userExamId: string, @Req() req: RequestWithUser) {
    return this.examsService.finishExam(+userExamId, req.user.userId);
  }

  // --- CHECKOUT EXAM ---
  @Get('checkout-preview/:examId')
  async getPreview(@Param('examId') examId: string) {
    return this.examsService.getExamCheckoutPreview(+examId);
  }

  @Post('checkout')
  @UseInterceptors(FileInterceptor('file'))
  async checkout(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { examId: string; paymentMethod: string; discountCode?: string },
    @Req() req: RequestWithUser,
  ) {
    if (!file) throw new BadRequestException('Bukti pembayaran wajib diunggah');

    return this.examsService.processExamCheckout(
      +body.examId,
      req.user.userId,
      body.paymentMethod,
      file,
      body.discountCode,
    );
  }
  @Get('remaining-time/:userExamId')
  async getRemainingTime(
    @Param('userExamId') id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.examsService.getRemainingTime(+id, req.user.userId);
  }
}
