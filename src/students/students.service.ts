import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  // 1. Fitur "Ujian Saya" (Purchased Exams)
  async getMyExams(userId: number) {
    const orders = await this.prisma.orders.findMany({
      where: {
        userId,
        orderStatus: 'completed', // Hanya yang sudah dibayar
      },
      include: {
        orderItems: {
          where: { itemType: 'exam' },
        },
      },
    });

    // Ambil ID ujian dari item order
    const examIds = orders.flatMap(order => 
      order.orderItems.map(item => item.itemId)
    );

    return this.prisma.exams.findMany({
      where: { id: { in: examIds } },
      include: { subject: true },
    });
  }

  // 2. Riwayat Ujian (Exam Attempts)
  async getMyAttempts(userId: number) {
    return this.prisma.userExams.findMany({
      where: { userId },
      include: {
        exam: { select: { examName: true, durationMinutes: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  // 3. Profil & Progres Stats
  async getProfileStats(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
      },
    });

    const totalAttempts = await this.prisma.userExams.count({
      where: { userId, status: 'submitted' },
    });

    return {
      profile: user,
      stats: {
        totalExamsTaken: totalAttempts,
      },
    };
  }

  async getExamReview(userExamId: number, userId: number) {
    const attempt = await this.prisma.userExams.findUnique({
        where: { id: userExamId },
        include: {
        exam: {
            include: {
            examQuestions: {
                include: {
                question: {
                    include: {
                    answers: true 
                    }
                }
                }
            }
            }
        },
        userExamAnswers: true 
        }
    });

    if (!attempt) throw new NotFoundException('Data ujian tidak ditemukan');
    if (attempt.userId !== userId) throw new ForbiddenException('Akses ditolak');

    const reviewData = attempt.exam.examQuestions.map((eq) => {
        // SESUAIKAN: Pakai 'selectedAnswerId' sesuai skema tabel lo
        const userAnswer = attempt.userExamAnswers.find(ua => ua.questionId === eq.questionId);
        
        return {
        questionId: eq.questionId,
        questionText: eq.question.questionText,
        explanation: eq.question.explanationText, 
        order: eq.orderInExam,
        points: eq.pointsForQuestion,
        answers: eq.question.answers.map(a => ({
            id: a.id,
            text: a.answerText,
            isCorrect: a.isCorrect, 
        })),
        userChoice: {
            // Ganti answerId jadi selectedAnswerId
            answerId: userAnswer?.selectedAnswerId || null, 
            isCorrect: userAnswer?.isCorrect || false
        }
        };
    });

    return {
        examName: attempt.exam.examName,
        score: attempt.score,
        // totalPoints dihapus karena tidak ada di tabel UserExams
        submittedAt: attempt.endTime,
        questions: reviewData
    };
    }

    async getLeaderboard(examId: number) {
        return this.prisma.userExams.findMany({
            where: { 
            examId, 
            status: 'submitted' 
            },
            take: 10,
            orderBy: { score: 'desc' },
            select: {
            score: true,
            startTime: true,
            endTime: true,
            user: {
                select: { username: true, firstName: true }
            }
            }
        });
    }

    async updateProfile(userId: number, data: UpdateProfileDto) {
    return this.prisma.users.update({
        where: { id: userId },
        data: data, // Hanya kolom yang ada di DTO yang akan terupdate
    });
    }

}