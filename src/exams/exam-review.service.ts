import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const attemptReviewInclude = Prisma.validator<Prisma.UserExamsInclude>()({
  exam: {
    select: {
      id: true,
      examName: true,
      examQuestions: {
        orderBy: { orderInExam: 'asc' },
        select: {
          orderInExam: true,
          questionId: true,
          pointsForQuestion: true,
          question: {
            select: {
              id: true,
              questionText: true,
              explanationText: true,
              answers: {
                orderBy: { orderNumber: 'asc' },
                select: {
                  id: true,
                  answerText: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },
    },
  },
  userExamAnswers: {
    include: {
      selectedAnswer: {
        select: { id: true, answerText: true },
      },
    },
  },
});

type AttemptWithReview = Prisma.UserExamsGetPayload<{
  include: typeof attemptReviewInclude;
}>;

@Injectable()
export class ExamReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /** Review soal untuk attempt tertentu (1 sesi ujian). */
  async getReviewByUserExam(userExamId: number, userId: number) {
    const attempt = await this.prisma.userExams.findFirst({
      where: { id: userExamId, userId },
      include: attemptReviewInclude,
    });

    if (!attempt) {
      throw new NotFoundException('Data review ujian tidak ditemukan');
    }

    return this.buildReviewPayload(attempt);
  }

  /**
   * Review soal per exam: ambil attempt terbaru yang sudah submitted untuk user ini.
   */
  async getReviewByExam(examId: number, userId: number) {
    const attempt = await this.prisma.userExams.findFirst({
      where: {
        examId,
        userId,
        status: 'submitted',
      },
      orderBy: { startTime: 'desc' },
      include: attemptReviewInclude,
    });

    if (!attempt) {
      throw new NotFoundException(
        'Belum ada hasil ujian yang bisa direview untuk exam ini',
      );
    }

    return this.buildReviewPayload(attempt);
  }

  private buildReviewPayload(attempt: AttemptWithReview) {
    const answersByQuestionId = new Map(
      attempt.userExamAnswers.map((ua) => [ua.questionId, ua]),
    );

    const questions = attempt.exam.examQuestions.map((eq) => {
      const ua = answersByQuestionId.get(eq.questionId);
      const pointsEarned =
        ua?.pointsEarned !== undefined && ua?.pointsEarned !== null
          ? Number(ua.pointsEarned)
          : null;

      return {
        order: eq.orderInExam,
        questionId: eq.questionId,
        questionText: eq.question.questionText,
        explanation: eq.question.explanationText,
        pointsForQuestion:
          eq.pointsForQuestion !== undefined && eq.pointsForQuestion !== null
            ? Number(eq.pointsForQuestion)
            : null,
        pointsEarned,
        isCorrect: ua?.isCorrect ?? null,
        selectedAnswerId: ua?.selectedAnswerId ?? null,
        userAnswerText:
          ua?.selectedAnswer?.answerText ?? ua?.userAnswer ?? null,
        options: eq.question.answers.map((opt) => ({
          id: opt.id,
          text: opt.answerText,
          isCorrect: opt.isCorrect,
        })),
      };
    });

    return {
      examId: attempt.exam.id,
      examName: attempt.exam.examName,
      userExamId: attempt.id,
      score:
        attempt.score !== null && attempt.score !== undefined
          ? Number(attempt.score)
          : null,
      isCompleted: attempt.isCompleted ?? false,
      submittedAt: attempt.endTime ?? attempt.submissionTime,
      questions,
    };
  }
}
