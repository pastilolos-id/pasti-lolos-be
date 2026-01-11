// src/exams/exams.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('exams')
@UseGuards(AuthGuard('jwt'))
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  createExam(@Body() body: any, @Req() req) {
    return this.examsService.createExam(body, req.user.userId);
  }
@Post('answers')
createAnswer(@Body() body: any, @Req() req) {
  return this.examsService.createAnswer(body, req.user.userId);
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOneExam(+id);
  }

  // @Post('questions')
  // createQuestion(@Body() body: any, @Req() req) {
  //   return this.examsService.createQuestion(body, req.user.userId);
  // }
  @Post('questions')
  createQuestion(@Body() body: any, @Req() req) {
    return this.examsService.createQuestion(body, req.user.userId);
  }

  // Endpoint baru untuk menghubungkan soal ke exam 
  @Post('add-question')
  addQuestionToExam(@Body() body: any) {
    return this.examsService.addQuestionToExam(body);
  }

    @Post('start/:examId')
    start(@Param('examId') examId: string, @Req() req) {
    return this.examsService.startExam(+examId, req.user.userId);
    }

    @Post('submit-answer')
    submit(@Body() body: { userExamId: number; questionId: number; answerId: number }) {
    return this.examsService.submitAnswer(body.userExamId, body.questionId, body.answerId);
    }

    @Post('finish/:userExamId')
    finish(@Param('userExamId') userExamId: string) {
    return this.examsService.finishExam(+userExamId);
    }

  
}