// src/exams/exams.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  // --- CRUD EXAMS ---
  async createExam(data: any, userId: number) {
    const { passingScore, price, ...rest } = data;

    return this.prisma.exams.create({
      data: {
        ...rest,
        passingScore: passingScore ? parseFloat(passingScore) : null,
        price: price ? parseFloat(price) : 0,
        createdByUserId: userId, 
      },
    });
  }

  // Get Exam Lengkap (Exams -> ExamQuestions -> Questions -> Answers)
  async findOneExam(id: number) {
    const exam = await this.prisma.exams.findUnique({
      where: { id },
      include: {
        examQuestions: { // CamelCase
          orderBy: { 
            orderInExam: 'asc' // CamelCase
          },
          include: {
            question: { 
              include: {
                answers: true, 
              },
            },
          },
        },
      },
    });

    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');
    return exam;
  }

  // --- CRUD QUESTIONS ---
  async createQuestion(data: any, userId: number) {
    return this.prisma.questions.create({
      data: {
        ...data,
        points: data.points ? parseInt(data.points) : 0,
        timeLimitPerQuestion: data.timeLimitPerQuestion ? parseInt(data.timeLimitPerQuestion) : null,
        createdByUserId: userId,
        isActive: data.isActive ?? true,
      },
    });
  }

  // --- MENGHUBUNGKAN SOAL KE UJIAN (ExamQuestions) ---
  async addQuestionToExam(data: any) {
    const existing = await this.prisma.examQuestions.findFirst({
      where: {
        examId: parseInt(data.examId),
        questionId: parseInt(data.questionId),
      },
    });

    if (existing) {
      throw new BadRequestException('Soal ini sudah terdaftar di dalam ujian ini!');
    }

    return this.prisma.examQuestions.create({
      data: {
        examId: parseInt(data.examId),
        questionId: parseInt(data.questionId),
        orderInExam: data.orderInExam ? parseInt(data.orderInExam) : 1,
        pointsForQuestion: data.pointsForQuestion ? parseFloat(data.pointsForQuestion) : 1.0,
      },
    });
  }

  // --- CRUD ANSWERS ---
  async createAnswer(data: any, userId: number) {
    const answer = await this.prisma.answers.create({
      data: {
        ...data,
        orderNumber: data.orderNumber ? parseInt(data.orderNumber) : 1,
        pointsIfSelected: data.pointsIfSelected ? parseInt(data.pointsIfSelected) : 0,
        lastModifiedBy: userId,
        isActive: data.isActive ?? true,
      },
    });

    if (data.isCorrect === true) {
      await this.prisma.questions.update({
        where: { id: data.questionId },
        data: { correctAnswerId: answer.id },
      });
    }

    return answer;
  }

  // --- Mekanisme Ujian (User Exam Attempt) ---
  async startExam(examId: number, userId: number) {
    return this.prisma.userExams.create({
      data: {
        examId: examId,
        userId: userId,
        startTime: new Date(),
        status: 'in_progress',
      },
    });
  }

  async submitAnswer(userExamId: number, questionId: number, answerId: number) {
    const existingAnswer = await this.prisma.userExamAnswers.findFirst({
      where: {
        userExamId: userExamId,
        questionId: questionId
      }
    });

    if (existingAnswer) {
      return this.prisma.userExamAnswers.update({
        where: { id: existingAnswer.id },
        data: { 
          selectedAnswerId: answerId,
          updatedAt: new Date()
        }
      });
    } else {
      return this.prisma.userExamAnswers.create({
        data: {
          userExamId: userExamId,
          questionId: questionId,
          selectedAnswerId: answerId,
          attemptNumber: 1, 
        },
      });
    }
  }

  async finishExam(userExamId: number) {
    const userExam = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      select: { id: true, examId: true }
    });

    if (!userExam) {
      throw new NotFoundException(`Sesi ujian ID ${userExamId} tidak ditemukan`);
    }

    const userAnswers = await this.prisma.userExamAnswers.findMany({
      where: { userExamId: userExamId },
      include: {
        selectedAnswer: {
          select: { isCorrect: true }
        },
        question: {
          include: {
            examQuestions: {
              where: { examId: userExam.examId }
            }
          }
        }
      }
    });

    if (!userAnswers.length) {
      throw new NotFoundException('Tidak ada jawaban yang ditemukan untuk sesi ini');
    }

    const totalScore = userAnswers.reduce((acc, curr) => {
      const isCorrect = curr.selectedAnswer?.isCorrect || false;
      
      if (isCorrect) {
        const point = Number(curr.question.examQuestions[0]?.pointsForQuestion || 0);
        return acc + point;
      }
      
      return acc;
    }, 0);

    return this.prisma.userExams.update({
      where: { id: userExamId },
      data: {
        endTime: new Date(),
        submissionTime: new Date(),
        score: totalScore,
        isCompleted: true,
        status: 'submitted'
      }
    });
  }
}