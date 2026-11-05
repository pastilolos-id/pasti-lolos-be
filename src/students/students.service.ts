import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ExamReviewService } from '../exams/exam-review.service';

type LeaderboardResult = {
  topTen: Array<{
    score: number | null;
    user: { username: string; firstName: string | null };
  }>;
  totalParticipants: number;
  myRank: number | null;
  myScore: number;
};

export interface ActivityMeta {
  total: number;
  page: number;
  lastPage: number;
  limit: number;
}

type UserExamActivityRow = Prisma.UserExamsGetPayload<{
  include: {
    exam: {
      include: {
        subject: { select: { subjectName: true } };
        examPackage: {
          include: {
            subject: { select: { subjectName: true } };
            exams: {
              select: { _count: { select: { examQuestions: true } } };
            };
          };
        };
        _count: { select: { examQuestions: true } };
      };
    };
  };
}>;

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private readonly examReviewService: ExamReviewService,
  ) {}

  async getDashboardData(category: string = 'BUMN') {
    const [banners, flashSaleItems, bumnLeaderboard, cpnsLeaderboard] =
      await Promise.all([
        // 1) Banner/hero
        this.prisma.assets.findMany({
          where: { isPublic: true },
          orderBy: { uploadDate: 'asc' },
          take: 5,
          select: {
            id: true,
            assetName: true,
            filePath: true,
            cdnUrl: true,
            tags: true,
          },
        }),
        // 2) Flash sale cards (exam packages published)
        this.prisma.examPackages.findMany({
          where: { status: 'published' },
          take: 3,
          select: {
            id: true,
            examName: true,
            price: true,
            examType: true,
          },
        }),

        // 3) Ranking tab BUMN
        this.prisma.userExams.findMany({
          where: {
            status: 'submitted',
            exam: {
              subject: { subjectName: { equals: 'BUMN', mode: 'insensitive' } },
            },
          },
          select: {
            userId: true,
            startTime: true,
            score: true,
            user: { select: { username: true, firstName: true } },
            metadataJson: true,
            exam: {
              select: {
                id: true,
                examName: true,
                examPackageId: true,
                examPackage: { select: { id: true, examName: true } },
              },
            },
          },
        }),

        // 4) Ranking tab CPNS
        this.prisma.userExams.findMany({
          where: {
            status: 'submitted',
            exam: {
              subject: { subjectName: { equals: 'CPNS', mode: 'insensitive' } },
            },
          },
          select: {
            userId: true,
            startTime: true,
            score: true,
            user: { select: { username: true, firstName: true } },
            metadataJson: true,
            exam: {
              select: {
                id: true,
                examName: true,
                examPackageId: true,
                examPackage: { select: { id: true, examName: true } },
              },
            },
          },
        }),
      ]);

    const extractScoreColumn = (examName: string) => {
      const sanitized = examName
        .replace(/[()]/g, ' ')
        .replace(/[^a-zA-Z0-9\s.]/g, ' ')
        .trim();
      const firstWord = sanitized.split(/\s+/)[0] || 'nilai';
      return firstWord.toUpperCase();
    };

    const buildPackageLeaderboard = (
      rows: Array<{
        userId: number;
        startTime: Date;
        score: unknown;
        user: { username: string; firstName: string | null };
        metadataJson: unknown;
        exam: {
          id: number;
          examName: string;
          examPackageId: number;
          examPackage: { id: number; examName: string };
        };
      }>,
    ) => {
      const byUserAndPackage = new Map<
        string,
        {
          name: string;
          bySubExam: Map<
            number,
            {
              score: number;
              startTime: Date;
              columnKey: string;
            }
          >;
        }
      >();
      const columnOrder = new Map<string, number>();
      let seenColumnCounter = 0;

      for (const entry of rows) {
        const packageId = entry.exam.examPackageId;
        const mapKey = `${entry.userId}:${packageId}`;
        const existing = byUserAndPackage.get(mapKey);
        const group = existing ?? {
          name: entry.user.firstName || entry.user.username,
          bySubExam: new Map<
            number,
            {
              score: number;
              startTime: Date;
              columnKey: string;
            }
          >(),
        };

        const score = entry.score ? Number(entry.score) : 0;
        const columnKey = extractScoreColumn(entry.exam.examName);
        if (!columnOrder.has(columnKey)) {
          columnOrder.set(columnKey, seenColumnCounter++);
        }

        const prev = group.bySubExam.get(entry.exam.id);
        if (!prev || prev.startTime < entry.startTime) {
          group.bySubExam.set(entry.exam.id, {
            score,
            startTime: entry.startTime,
            columnKey,
          });
        }
        byUserAndPackage.set(mapKey, group);
      }

      const columns = [...columnOrder.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([key]) => key);

      const rowsData = [...byUserAndPackage.values()]
        .map((item) => {
          let totalScore = 0;
          const scores: Record<string, number> = {};
          for (const col of columns) scores[col] = 0;

          for (const sub of item.bySubExam.values()) {
            scores[sub.columnKey] = (scores[sub.columnKey] ?? 0) + sub.score;
            totalScore += sub.score;
          }

          return {
            name: item.name,
            scores,
            totalScore,
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10)
        .map((row, index) => ({
          rank: index + 1,
          name: row.name,
          scores: {
            ...row.scores,
            TOTAL_SKOR: row.totalScore,
          },
        }));

      return {
        columns: [...columns, 'TOTAL SKOR'],
        rows: rowsData,
      };
    };

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setHours(23, 59, 59, 999);
    const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());

    const activeCategory = category.toUpperCase() === 'CPNS' ? 'CPNS' : 'BUMN';

    return {
      heroBanner: banners[0] ?? null,
      banners,
      flashSale: {
        title: 'Flash Sale',
        endsAt,
        remainingMs,
        items: flashSaleItems.map((item) => {
          const salePrice = Number(item.price ?? 0);
          const originalPrice = Math.round(salePrice * 1.2);
          return {
            id: item.id,
            title: item.examName,
            label: item.examType,
            originalPrice,
            salePrice,
            ctaText: 'Beli Sekarang',
          };
        }),
      },
      rankingTryout: {
        activeCategory,
        tabs: ['BUMN', 'CPNS'],
        bumn: buildPackageLeaderboard(bumnLeaderboard),
        cpns: buildPackageLeaderboard(cpnsLeaderboard),
      },
    };
  }

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
        message:
          'Anda belum memiliki ujian. Silakan beli paket ujian terlebih dahulu.',
        data: [],
      };
    }

    const packageIds = [
      ...new Set(
        orders.flatMap((order) => order.orderItems.map((item) => item.itemId)),
      ),
    ];

    const packages = await this.prisma.examPackages.findMany({
      where: { id: { in: packageIds } },
      include: { subject: true },
    });

    if (packages.length === 0) {
      return {
        message: 'Belum ada ujian yang tersedia untuk akun Anda.',
        data: [],
      };
    }

    return {
      message: 'Success.',
      data: packages,
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
            durationMinutes: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Cek jika belum ada riwayat pengerjaan
    if (attempts.length === 0) {
      return {
        message:
          'Anda belum pernah mengerjakan ujian. Ayo mulai ujian pertama Anda!',
        data: [],
      };
    }

    return {
      message: 'Berhasil mengambil riwayat ujian.',
      data: attempts,
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
        profilePictureUrl: true,
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
                    answers: true,
                  },
                },
              },
            },
          },
        },
        userExamAnswers: true,
      },
    });

    if (!attempt) throw new NotFoundException('Data ujian tidak ditemukan');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Akses ditolak');

    const reviewData = attempt.exam.examQuestions.map((eq) => {
      // SESUAIKAN: Pakai 'selectedAnswerId' sesuai skema tabel lo
      const userAnswer = attempt.userExamAnswers.find(
        (ua) => ua.questionId === eq.questionId,
      );

      return {
        questionId: eq.questionId,
        questionText: eq.question.questionText,
        explanation: eq.question.explanationText,
        order: eq.orderInExam,
        points: eq.pointsForQuestion,
        answers: eq.question.answers.map((a) => ({
          id: a.id,
          text: a.answerText,
          isCorrect: a.isCorrect,
        })),
        userChoice: {
          // Ganti answerId jadi selectedAnswerId
          answerId: userAnswer?.selectedAnswerId || null,
          isCorrect: userAnswer?.isCorrect || false,
        },
      };
    });

    return {
      examName: attempt.exam.examName,
      score: attempt.score,
      // totalPoints dihapus karena tidak ada di tabel UserExams
      submittedAt: attempt.endTime,
      questions: reviewData,
    };
  }

  async getLeaderboard(
    examId: number,
    userId: number,
  ): Promise<LeaderboardResult> {
    // 1. Ambil Top 10 seperti biasa
    const topTen = await this.prisma.userExams.findMany({
      where: { examId, status: 'submitted' },
      take: 10,
      orderBy: { score: 'desc' },
      select: {
        score: true,
        user: { select: { username: true, firstName: true } },
      },
    });

    // 2. Hitung total peserta
    const totalParticipants = await this.prisma.userExams.count({
      where: { examId, status: 'submitted' },
    });

    // 3. Cari peringkat user saat ini
    const userAttempt = await this.prisma.userExams.findFirst({
      where: { examId, userId, status: 'submitted' },
      orderBy: { score: 'desc' },
    });

    let myRank: number | null = null;
    if (userAttempt && userAttempt.score !== null) {
      const higherScores = await this.prisma.userExams.count({
        where: {
          examId,
          status: 'submitted',
          score: { gt: userAttempt.score }, // Hitung berapa orang yang skornya lebih tinggi
        },
      });
      myRank = higherScores + 1;
    }

    return {
      topTen: topTen.map((item) => ({
        score: item.score !== null ? Number(item.score) : null,
        user: item.user,
      })),
      totalParticipants,
      myRank,
      myScore: userAttempt?.score ? Number(userAttempt.score) : 0,
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
      select: { score: true, status: true },
    });

    const completed = attempts.filter((a) => a.status === 'submitted');
    const totalScore = completed.reduce(
      (acc, curr) => acc + Number(curr.score || 0),
      0,
    );

    return {
      totalExamsTaken: completed.length,
      averageScore:
        completed.length > 0 ? (totalScore / completed.length).toFixed(2) : 0,
      recentAttempts: await this.prisma.userExams.findMany({
        where: { userId },
        include: { exam: { select: { examName: true } } },
        orderBy: { startTime: 'desc' },
        take: 5,
      }),
    };
  }

  async getPurchaseHistory(userId: number, type?: string) {
    return await this.prisma.orders.findMany({
      where: {
        userId: userId,
        // Filter berdasarkan tipe item jika ada (Tryout/Materi)
        ...(type && type !== 'Semua'
          ? {
              orderItems: {
                some: {
                  itemType: type.toLowerCase() === 'tryout' ? 'exam' : 'course',
                },
              },
            }
          : {}),
      },
      include: {
        orderItems: true, // Untuk ambil nama exam/materi
        payments: {
          select: {
            paymentMethod: true,
            receiptUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Yang terbaru di atas sesuai gambar lo
      },
    });
  }

  async getAttemptReview(userExamId: number, userId: number) {
    const data = await this.examReviewService.getReviewByUserExam(
      userExamId,
      userId,
    );
    return {
      examName: data.examName,
      score: data.score,
      isCompleted: data.isCompleted,
      reviewData: data.questions.map((q) => ({
        question: q.questionText,
        explanation: q.explanation,
        userAnswer: q.userAnswerText,
        isCorrect: q.isCorrect,
        points: q.pointsEarned,
        options: q.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
      })),
    };
  }
  async getUserActivity(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const allUserExams: UserExamActivityRow[] =
      await this.prisma.userExams.findMany({
        where: { userId },
        include: {
          exam: {
            include: {
              subject: { select: { subjectName: true } },
              examPackage: {
                include: {
                  subject: { select: { subjectName: true } },
                  exams: {
                    select: { _count: { select: { examQuestions: true } } },
                  },
                },
              },
              _count: { select: { examQuestions: true } },
            },
          },
        },
        orderBy: { startTime: 'desc' },
      });

    const latestByPackageAndExam = new Map<string, UserExamActivityRow>();
    for (const ue of allUserExams) {
      const key = `${ue.exam.examPackageId}:${ue.exam.id}`;
      if (!latestByPackageAndExam.has(key)) {
        latestByPackageAndExam.set(key, ue);
      }
    }

    const byPackageId = new Map<number, UserExamActivityRow[]>();
    for (const ue of allUserExams) {
      const pid = ue.exam.examPackageId;
      const list = byPackageId.get(pid) ?? [];
      if (!list.some((x) => x.examId === ue.examId)) {
        list.push(ue);
      }
      byPackageId.set(pid, list);
    }

    const combined = [...byPackageId.entries()]
      .map(([packageId, attempts]) => {
        const parent = attempts[0]?.exam.examPackage;
        if (!parent) return null;

        const dedupedSubs = [...latestByPackageAndExam.values()].filter(
          (ue) => ue.exam.examPackageId === packageId,
        );

        const subExams = dedupedSubs.map((sub) => ({
          userExamId: sub.id,
          examName: sub.exam.examName,
          score: sub.score ? Number(sub.score) : 0,
          status: sub.status,
          finishedAt: sub.endTime,
        }));

        const myScore = dedupedSubs.reduce(
          (sum, sub) => sum + (sub.score ? Number(sub.score) : 0),
          0,
        );

        const questionCount = parent.exams.reduce(
          (sum, e) => sum + e._count.examQuestions,
          0,
        );

        return {
          id: parent.id,
          userExamId: null,
          examName: parent.examName,
          description: parent.description,
          examType: parent.examType,
          price: Number(parent.price || 0),
          durationMinutes: parent.durationMinutes,
          subject: {
            subjectName: parent.subject?.subjectName || 'Umum',
          },
          myStatus: this.mergePackageActivityStatus(
            dedupedSubs.map((s) => s.status),
          ),
          myScore,
          date: new Date(
            Math.max(...attempts.map((a) => new Date(a.startTime).getTime())),
          ),
          subExams,
          _count: { examQuestions: questionCount },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = combined.length;
    const data = combined.slice(skip, skip + limit);

    const meta: ActivityMeta = {
      total,
      page,
      lastPage: Math.ceil(total / limit) || 1,
      limit,
    };

    return { data, meta };
  }

  /** Gabung status sub-ujian jadi satu status baris paket. */
  private mergePackageActivityStatus(statuses: (string | null)[]): string {
    if (statuses.length === 0) return 'not_started';
    const normalized = statuses.map((s) => s ?? 'not_started');
    const done = new Set(['submitted', 'graded']);
    if (normalized.every((s) => done.has(s))) return 'submitted';
    if (normalized.some((s) => s !== 'not_started')) return 'in_progress';
    return 'not_started';
  }
}
