// src/exams/exams.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  UnauthorizedException,
  FileTypeValidator,
  Patch,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamReviewService } from './exam-review.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { AddQuestionToExamDto } from './dto/add-question-to-exam.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import type { JwtRequestUser } from 'src/types/express';

// Interface untuk Type-Safety Request
interface RequestWithUser extends Request {
  user?: JwtRequestUser;
}

@Controller('exams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExamsController {
  // prisma: any;
  constructor(
    private readonly examsService: ExamsService,
    private readonly examReviewService: ExamReviewService,
  ) {}

  private requireUserId(req: RequestWithUser): number {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User tidak valid');
    }
    return userId;
  }

  // --- CRUD EXAMS ---
  @Post('create')
  @Roles('2', '3') // 3 = admin, 4 = kontributor
  createExam(@Body() body: CreateExamDto, @Req() req: RequestWithUser) {
    return this.examsService.createExam(body, this.requireUserId(req));
  }

  @Get('package-detail/:id')
  @Roles('1', '2', '3')
  async getPackage(@Param('id') id: string, @Req() req: RequestWithUser) {
    const user = req.user;
    if (!user?.userId) throw new UnauthorizedException('User tidak valid');
    return this.examsService.getPackageDetail(+id, user.userId);
  }
  // async getPackageDetail(@Param('id') id: string) {
  //   return this.examsService.getPackageDetail(+id);
  // }

  @Patch('update/:id')
  @Roles('2', '3') // Admin (3) & Kontributor (4)
  update(
    @Param('id') id: string,
    @Body() body: Partial<CreateExamDto>,
    @Req() req: RequestWithUser,
  ) {
    return this.examsService.updateExam(+id, this.requireUserId(req), body);
  }

  // Soft Delete Exam
  @Delete('delete/:id')
  @Roles('2') // Biasanya cuma Admin (3) yang boleh hapus
  remove(@Param('id') id: string) {
    return this.examsService.softDeleteExam(+id);
  }

  @Get('')
  @Roles('1', '2', '3') // Murid, Admin, Guru tetep bisa akses list ini
  // async findAll(
  //   @Query('category') subjectName: string,
  //   @Query('page') page: string = '1',
  //   @Query('limit') limit: string = '10',
  //   @Req() req: any
  // ) {
  //   return this.examsService.findAllPublished(
  //     subjectName,
  //     +page || 1,
  //     +limit || 10,
  //     req.user.userId // Ambil dari JWT payload
  //   );
  // }
  findAllPublished(@Query('category') category?: string) {
    // Ubah di sini
    return this.examsService.findAllPublished(category);
  }

  @Get('get/:id')
  findOne(
    @Param('id') id: string,
    @Req() req: RequestWithUser, // Gunakan interface yang tadi sudah lo buat
  ) {
    // Masukkan argumen kedua yaitu userId dari request
    return this.examsService.findOneExam(+id, this.requireUserId(req));
  }

  // --- QUESTIONS & ANSWERS ---
  @Post('questions')
  @Roles('3', '4') // 3 = admin, 4 = kontributor
  createQuestion(@Body() body: CreateQuestionDto, @Req() req: RequestWithUser) {
    // Fungsi ini sekarang menjalankan transaksi: simpan soal + konek ke exam
    return this.examsService.createQuestion(body, this.requireUserId(req));
  }

  @Post('answers')
  @Roles('2', '3')
  createAnswer(@Body() body: CreateAnswerDto, @Req() req: RequestWithUser) {
    return this.examsService.createAnswer(body, this.requireUserId(req));
  }

  @Get(':id/get-exams')
  @Roles('1', '2', '3')
  async getFullDetails(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.examsService.getExamWithQuestions(+id, this.requireUserId(req));
  }

  @Post('add-question')
  addQuestionToExam(@Body() body: AddQuestionToExamDto) {
    return this.examsService.addQuestionToExam(body);
  }

  // --- MEKANISME UJIAN (Attempts) ---
  @Post('start/:examId')
  @Roles('1') // 1 = murid, 2 = guru/kon
  start(@Param('examId') examId: string, @Req() req: RequestWithUser) {
    return this.examsService.startExam(+examId, this.requireUserId(req));
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
      this.requireUserId(req),
    );
  }

  // @Post('finish/:userExamId')
  // @Roles('1')
  // finish(@Param('userExamId') userExamId: string, @Req() req: RequestWithUser) {
  //   return this.examsService.finishExam(+userExamId, req.user.userId);
  // }
  @Post('finish')
  @Roles('1') // Pastikan role murid bisa akses
  async finish(
    @Body() body: { userExamId: number },
    @Req() req: RequestWithUser,
  ) {
    // 1. Ambil userId sesuai interface (userId)
    const userId = req.user?.userId;

    // 2. Pastikan userExamId adalah number
    const userExamId = Number(body.userExamId);

    console.log(
      'DEBUG: Memproses finishExam untuk userExamId:',
      userExamId,
      'userId:',
      userId,
    );

    if (!userId) {
      throw new UnauthorizedException('User ID tidak ditemukan dalam session.');
    }

    return this.examsService.finishExam(userExamId, userId);
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
      this.requireUserId(req),
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
    return this.examsService.getRemainingTime(+id, this.requireUserId(req));
  }

  // Update urutan atau poin soal di dalam ujian
  @Patch('questions-relation/:id')
  async updateRelation(
    @Param('id') id: string,
    @Body()
    data: {
      orderInExam?: string | number;
      pointsForQuestion?: string | number;
      sectionName?: string;
    },
  ) {
    return this.examsService.updateExamQuestion(+id, data);
  }

  // Hapus soal dari ujian tertentu
  @Delete(':examId/questions/:questionId')
  async removeQuestion(
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.examsService.removeQuestionFromExam(+examId, +questionId);
  }

  // Ganti status ujian (Draft/Published/Archived)
  @Patch(':id/status')
  async changeStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.examsService.updateExamStatus(+id, status);
  }

  @Post('questions/bulk')
  @Roles('2', '3') // Admin & Contributor
  async bulkCreate(
    @Body() dto: BulkCreateQuestionsDto,
    @Req() req: RequestWithUser,
  ) {
    // Ambil userId sesuai dengan struktur payload JWT lo (req.user.userId)
    return this.examsService.bulkCreateQuestions(dto, this.requireUserId(req));
  }

  @Post('submit')
  async submitExam(@Body() dto: SubmitExamDto, @Req() req: RequestWithUser) {
    return this.examsService.submitExam(dto, this.requireUserId(req));
  }

  /** Review pembahasan soal per exam (attempt submitted terbaru user ini). */
  @Get('review/by-exam/:examId')
  @Roles('1', '2', '3')
  async getQuestionReviewByExam(
    @Param('examId', ParseIntPipe) examId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.examReviewService.getReviewByExam(
      examId,
      this.requireUserId(req),
    );
  }

  /** Review pembahasan untuk satu sesi (user_exams.id). */
  @Get('review/by-attempt/:userExamId')
  @Roles('1', '2', '3')
  async getQuestionReviewByAttempt(
    @Param('userExamId', ParseIntPipe) userExamId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.examReviewService.getReviewByUserExam(
      userExamId,
      this.requireUserId(req),
    );
  }

  // Di ExamsController
  @Get('checkout-preview/:id')
  @Roles('1', '2', '3')
  async getCheckoutPreview(@Param('id') id: string) {
    return this.examsService.getExamCheckoutPreview(+id);
  }

  @Get(':id/get-score') // Endpoint: /exams/7/get-score
  async getExamScore(
    @Param('id', ParseIntPipe) examId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.examsService.getScoreByExam(examId, this.requireUserId(req));
  }

  @Get('package/:id/get-score') // Endpoint: /exams/package/5/get-score
  async getPackageScore(
    @Param('id', ParseIntPipe) packageId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.examsService.getScoreByPackage(
      packageId,
      this.requireUserId(req),
    );
  }
}
