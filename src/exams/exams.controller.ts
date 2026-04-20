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
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Patch,
  Delete,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
// import { Request } from 'express';
import { Request as ExpressRequest } from 'express';
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
  // prisma: any;
  constructor(private readonly examsService: ExamsService) {}

  // --- CRUD EXAMS ---
  @Post('create')
  @Roles('3', '4') // 3 = admin, 4 = kontributor
  createExam(@Body() body: CreateExamDto, @Req() req: RequestWithUser) {
    return this.examsService.createExam(body, req.user.userId);
  }

  @Patch('update/:id')
  @Roles('3', '4') // Admin (3) & Kontributor (4)
  update(
    @Param('id') id: string,
    @Body() body: Partial<CreateExamDto>,
    @Req() req: RequestWithUser,
  ) {
    return this.examsService.updateExam(+id, req.user.userId, body);
  }

  // Soft Delete Exam
  @Delete('delete/:id')
  @Roles('3') // Biasanya cuma Admin (3) yang boleh hapus
  remove(@Param('id') id: string) {
    return this.examsService.softDeleteExam(+id);
  }

  @Get('get-all')
  @Roles('1', '3', '4') // Murid, Admin, Guru tetep bisa akses list ini
  findAllPublished() {
    return this.examsService.findAllPublished();
  }

  @Get('get/:id')
  findOne(
    @Param('id') id: string,
    @Req() req: RequestWithUser, // Gunakan interface yang tadi sudah lo buat
  ) {
    // Masukkan argumen kedua yaitu userId dari request
    return this.examsService.findOneExam(+id, req.user.userId);
  }

  // --- QUESTIONS & ANSWERS ---
  @Post('questions')
  @Roles('3', '4') // 3 = admin, 4 = kontributor
  createQuestion(@Body() body: CreateQuestionDto, @Req() req: RequestWithUser) {
    // Fungsi ini sekarang menjalankan transaksi: simpan soal + konek ke exam
    return this.examsService.createQuestion(body, req.user.userId);
  }

  @Post('answers')
  @Roles('3', '4') 
  createAnswer(@Body() body: CreateAnswerDto, @Req() req: RequestWithUser) {
    return this.examsService.createAnswer(body, req.user.userId);
  }

  @Get(':id/get-exams')
  @Roles('1', '3', '4') 
  async getFullDetails(@Param('id') id: string) {
    return this.examsService.getExamWithQuestions(+id);
  }

  @Post('add-question')
  addQuestionToExam(@Body() body: AddQuestionToExamDto) {
    return this.examsService.addQuestionToExam(body);
  }

  // --- MEKANISME UJIAN (Attempts) ---
  @Post('start/:examId')
  @Roles('1') // 1 = murid, 2 = guru/kon
  start(@Param('examId') examId: string, @Req() req: RequestWithUser) {
    return this.examsService.startExam(+examId, req.user.userId);
  }

  @Post('submit-answer')
  @Roles('1')
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
  @Roles('1')
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
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
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

  // Update urutan atau poin soal di dalam ujian
  @Patch('questions-relation/:id')
  async updateRelation(
    @Param('id') id: string, 
    @Body() data: any // <--- Bagian ini WAJIB ada
  ) {
    return this.examsService.updateExamQuestion(+id, data);
  }

  // Hapus soal dari ujian tertentu
  @Delete(':examId/questions/:questionId')
  async removeQuestion(
    @Param('examId') examId: string,
    @Param('questionId') questionId: string
  ) {
    return this.examsService.removeQuestionFromExam(+examId, +questionId);
  }

  // Ganti status ujian (Draft/Published/Archived)
  @Patch(':id/status')
  async changeStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.examsService.updateExamStatus(+id, status);
  }

  // Bulk Create
  // @Post(':id/questions/bulk')
  // async bulkCreate(
  //   @Param('id') id: string,
  //   @Body('questions') questions: any[],
  //   @Request() req
  // ) {
  //   return this.examsService.bulkCreateQuestions(+id, req.user.id, questions);
  // }
}
