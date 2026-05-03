import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
        orderStatus: 'completed',
      },
      include: {
        orderItems: {
          where: { itemType: 'exam' },
        },
      },
    });

    // 1. Cek kalau ternyata user belum pernah beli apapun
    if (orders.length === 0) {
      return {
        message: "Anda belum memiliki ujian. Silakan beli paket ujian terlebih dahulu.",
        data: []
      };
    }

    const examIds = orders.flatMap(order => 
      order.orderItems.map(item => item.itemId)
    );

    const exams = await this.prisma.exams.findMany({
      where: { id: { in: examIds } },
      include: { subject: true },
    });

    // 2. Cek lagi kalau record order ada tapi link ke exams-nya bermasalah (jarang tapi jaga-jaga)
    if (exams.length === 0) {
      return {
        message: "Belum ada ujian yang tersedia untuk akun Anda.",
        data: []
      };
    }

    return {
      message: "Success.",
      data: exams
    };
  }

  // 2. Riwayat Ujian (Exam Attempts)
  async getMyAttempts(userId: number) {
    const attempts = await this.prisma.userExams.findMany({
      where: { userId },
      include: {
        exam: { 
          select: { 
            examName: true, 
            durationMinutes: true 
          } 
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Cek jika belum ada riwayat pengerjaan
    if (attempts.length === 0) {
      return {
        message: "Anda belum pernah mengerjakan ujian. Ayo mulai ujian pertama Anda!",
        data: []
      };
    }

    return {
      message: "Berhasil mengambil riwayat ujian.",
      data: attempts
    };
  }

  // 3. Profil & Progres Stats
  async getProfileStats(userId: number) {
    if (!userId) {
      throw new BadRequestException('User ID tidak ditemukan dalam token');
    }
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        profilePictureUrl: true
      },
    });

    if (!user) throw new NotFoundException('User tidak ditemukan');

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

    async getLeaderboard(examId: number, userId: number) {
      // 1. Ambil Top 10 seperti biasa
      const topTen = await this.prisma.userExams.findMany({
        where: { examId, status: 'submitted' },
        take: 10,
        orderBy: { score: 'desc' },
        select: {
          score: true,
          user: { select: { username: true, firstName: true } }
        }
      });

      // 2. Hitung total peserta
      const totalParticipants = await this.prisma.userExams.count({
        where: { examId, status: 'submitted' }
      });

      // 3. Cari peringkat user saat ini
      const userAttempt = await this.prisma.userExams.findFirst({
        where: { examId, userId, status: 'submitted' },
        orderBy: { score: 'desc' }
      });

      let myRank: number | null = null;
      if (userAttempt && userAttempt.score !== null) {
        const higherScores = await this.prisma.userExams.count({
          where: {
            examId,
            status: 'submitted',
            score: { gt: userAttempt.score } // Hitung berapa orang yang skornya lebih tinggi
          }
        });
        myRank = higherScores + 1;
      }

      return {
        topTen,
        totalParticipants,
        myRank,
        myScore: userAttempt?.score || 0
      };
    }

    async updateProfile(userId: number, data: UpdateProfileDto) {
      return this.prisma.users.update({
          where: { id: userId },
          data: data, // Hanya kolom yang ada di DTO yang akan terupdate
      });
    }

    async getStudentStats(userId: number) {
      const attempts = await this.prisma.userExams.findMany({
        where: { userId },
        select: { score: true, status: true }
      });

      const completed = attempts.filter(a => a.status === 'submitted');
      const totalScore = completed.reduce((acc, curr) => acc + Number(curr.score || 0), 0);

      return {
        totalExamsTaken: completed.length,
        averageScore: completed.length > 0 ? (totalScore / completed.length).toFixed(2) : 0,
        recentAttempts: await this.prisma.userExams.findMany({
          where: { userId },
          include: { exam: { select: { examName: true } } },
          orderBy: { startTime: 'desc' },
          take: 5
        })
      };
    }

}