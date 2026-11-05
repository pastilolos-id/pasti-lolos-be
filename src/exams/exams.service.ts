// src/exams/exams.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { Answers, ExamQuestions, Prisma, Questions } from '@prisma/client';
import { CreateQuestionDto } from './dto/create-question.dto';
import { AddQuestionToExamDto } from './dto/add-question-to-exam.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import type { RemoteImageUploadResult } from '../common/cloudinary/remote-image-upload.types';
import { NotificationsService } from '../notifications/notifications.service';

type CloudinaryRemoteImageUpload = (
  url: string,
  folder?: string,
) => Promise<RemoteImageUploadResult>;

interface SubmitAnswerResult {
  id: number;
  questionId: number;
  selectedAnswerId: number | null;
  updatedAt: Date;
}

interface VoucherInput {
  couponCode: string;
  discountType: string;
  discountValue: number | string;
  validFrom: string | number | Date;
  validUntil: string | number | Date;
  maxUses: number;
  examIds?: number[];
}

interface ExamScoreSummary {
  totalQuestions?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unanswered?: number;
  result?: string;
}

interface ExamScoreMetadata {
  summary?: ExamScoreSummary;
  details?: unknown[];
}

/** Narik string URL gambar dari body yang sudah divalidasi (aman untuk type-aware ESLint). */
function toOptionalImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

@Injectable()
export class ExamsService {
  // cloudinary: any;
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private notificationsService: NotificationsService,
  ) {}

  /** URL publik gambar → Cloudinary `secure_url`; kosong/null → null */
  private async resolveQuestionImageUrl(
    imageUrl: string | undefined | null,
  ): Promise<string | null> {
    if (!imageUrl?.trim()) {
      return null;
    }
    const trimmed = imageUrl.trim();
    const cld = this.cloudinaryService as unknown as {
      uploadFromRemoteUrl: CloudinaryRemoteImageUpload;
    };
    const result = await cld.uploadFromRemoteUrl(trimmed);
    return result.secureUrl.length > 0 ? result.secureUrl : null;
  }

  // --- CRUD CHILD EXAMS ---
  async createExam(
    data: CreateExamDto,
    userId: number,
  ): Promise<{ message: string }> {
    if (!userId) {
      throw new BadRequestException('User ID tidak valid');
    }

    const examPackageId = parseInt(data.examPackageId.toString(), 10);
    if (isNaN(examPackageId)) {
      throw new BadRequestException('examPackageId tidak valid');
    }

    const pkg = await this.prisma.examPackages.findUnique({
      where: { id: examPackageId },
    });
    if (!pkg) {
      throw new NotFoundException('Exam package tidak ditemukan');
    }

    await this.prisma.exams.create({
      data: {
        examName: data.examName,
        description: data.description ?? null,
        durationMinutes: parseInt(data.durationMinutes.toString(), 10),
        examType: data.examType,
        status: data.status ?? 'draft',
        examPackageId,
        subjectId: parseInt(data.subjectId.toString(), 10),
        createdByUserId: userId,
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        passingScore: data.passingScore
          ? new Prisma.Decimal(data.passingScore)
          : null,
        attemptsAllowed: data.attemptsAllowed
          ? parseInt(data.attemptsAllowed.toString(), 10)
          : 1,
        randomizeQuestions: data.randomizeQuestions ?? true,
        metadataJson: {
          source: 'admin_panel',
          created_at_iso: new Date().toISOString(),
          ...((data.metadataJson as object) || {}),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message: 'Berhasil insert data exam (child)',
    };
  }

  async updateExam(id: number, userId: number, data: Partial<CreateExamDto>) {
    const exam = await this.prisma.exams.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    // Update data dengan konversi tipe yang sesuai schema (Decimal & Int)
    const examPackageIdUpdate = data.examPackageId
      ? parseInt(data.examPackageId.toString(), 10)
      : undefined;

    return this.prisma.exams.update({
      where: { id },
      data: {
        examName: data.examName,
        description: data.description,
        examPackageId: examPackageIdUpdate,
        durationMinutes: data.durationMinutes
          ? parseInt(data.durationMinutes.toString(), 10)
          : undefined,
        examType: data.examType,
        status: data.status, // Bisa buat ganti status manual
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        passingScore: data.passingScore
          ? new Prisma.Decimal(data.passingScore)
          : undefined,
        attemptsAllowed: data.attemptsAllowed
          ? parseInt(data.attemptsAllowed, 10)
          : undefined,
        randomizeQuestions: data.randomizeQuestions,
        // Update metadata biar ketahuan siapa yang terakhir ngubah
        metadataJson: {
          ...((exam.metadataJson as object) || {}),
          lastUpdatedBy: userId,
          updatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  // --- SOFT DELETE EXAM ---
  async softDeleteExam(id: number) {
    const exam = await this.prisma.exams.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    // Karena di tabel lo (kolom 12) ada kolom 'status',
    // kita set statusnya jadi 'archived' atau 'deleted' sebagai soft delete.
    return this.prisma.exams.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  // Get Exam Lengkap (Exams -> ExamQuestions -> Questions -> Answers)
  async findOneExam(id: number, userId: number) {
    const exam = await this.prisma.exams.findUnique({
      where: { id, status: 'published' }, // Pastikan cuma yang published yang bisa diakses
      include: { subject: true }, // Tarik data basic dulu
    });

    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    // Cek apakah user sudah beli
    const order = await this.prisma.orders.findFirst({
      where: {
        userId,
        orderStatus: 'completed',
        orderItems: {
          some: { itemId: exam.examPackageId, itemType: 'exam' },
        },
      },
    });

    // Jika belum bayar, jangan kasih soal & jawaban
    if (!order) {
      return {
        ...exam,
        examQuestions: [], // Kosongkan soal
        hasAccess: false,
        message: 'Selesaikan pembayaran untuk melihat soal ujian.',
      };
    }

    // Jika sudah bayar, baru tarik data lengkap
    return this.prisma.exams.findUnique({
      where: { id },
      include: {
        subject: true,
        examQuestions: {
          include: {
            question: { include: { answers: true } },
          },
        },
      },
    });
  }

  // --- CRUD QUESTIONS ---
  async createQuestion(
    data: CreateQuestionDto,
    userId: number,
  ): Promise<Questions> {
    if (!userId) {
      throw new BadRequestException(
        'User ID wajib ada untuk mencatat pembuat soal.',
      );
    }

    let resolvedImageUrl: string | null = null;
    try {
      resolvedImageUrl = await this.resolveQuestionImageUrl(
        toOptionalImageUrl((data as { imageUrl?: unknown }).imageUrl),
      );
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Gagal memproses gambar soal',
      );
    }

    // Gunakan Transaction agar pembuatan soal dan koneksi ke ujian aman (atomic)
    return this.prisma.$transaction(async (tx) => {
      // 1. Proses Pembuatan Soal
      const question = await tx.questions.create({
        data: {
          questionText: data.questionText,
          questionType: data.questionType,
          difficultyLevel: data.difficultyLevel ?? 'medium',
          explanationText: data.explanationText ?? null,
          points: data.points ? parseInt(data.points, 10) : 1,
          timeLimitPerQuestion: data.timeLimitPerQuestion
            ? parseInt(data.timeLimitPerQuestion, 10)
            : null,
          isActive: data.isActive ?? true,
          imageUrl: resolvedImageUrl,
          tags: data.tags
            ? (data.tags as Prisma.InputJsonValue)
            : Prisma.JsonNull,

          // Relasi 1: Subject (Wajib)
          subject: {
            connect: { id: parseInt(data.subjectId, 10) },
          },

          // Relasi 2: Creator (Wajib)
          createdByUser: {
            connect: { id: userId },
          },

          // Relasi 3: Topic (Opsional)
          ...(data.topicId
            ? {
                topic: {
                  connect: { id: parseInt(data.topicId, 10) },
                },
              }
            : {}),

          // Relasi 4: QuestionBank (Opsional)
          ...(data.questionBankId
            ? {
                questionBank: {
                  connect: { id: parseInt(data.questionBankId, 10) },
                },
              }
            : {}),

          // Metadata default
          metadataJson: {
            createdAtUi: new Date().toISOString(),
            source: 'fast_create_with_exam',
          } as Prisma.InputJsonValue,
        },
      });

      // 2. Logic Otomatis Konek ke Ujian (Jika examId dikirim)
      if (data.examId) {
        await tx.examQuestions.create({
          data: {
            examId: parseInt(data.examId, 10),
            questionId: question.id,
            orderInExam: data.orderInExam ? parseInt(data.orderInExam, 10) : 1,
            // Poin soal di ujian disamakan dengan poin master soal
            pointsForQuestion: new Prisma.Decimal(data.points || '1.0'),
          },
        });
      }

      return question;
    });
  }

  // --- MENGHUBUNGKAN SOAL KE UJIAN (ExamQuestions) ---
  async addQuestionToExam(data: AddQuestionToExamDto): Promise<ExamQuestions> {
    if (!data.examId) {
      throw new BadRequestException('examId is required');
    }
    const examIdInt = parseInt(data.examId, 10);
    const questionIdInt = parseInt(data.questionId, 10);

    // 1. Cek duplikasi (Type-safe query)
    const existing = await this.prisma.examQuestions.findFirst({
      where: {
        examId: examIdInt,
        questionId: questionIdInt,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Soal ini sudah terdaftar di dalam ujian ini!',
      );
    }

    // 2. Insert data (Gunakan UncheckedCreateInput agar bisa langsung tembak ID)
    return this.prisma.examQuestions.create({
      data: {
        examId: examIdInt,
        questionId: questionIdInt,
        orderInExam: data.orderInExam ? parseInt(data.orderInExam, 10) : 1,
        // Gunakan Prisma.Decimal jika kolomnya Decimal di DB
        pointsForQuestion: new Prisma.Decimal(data.pointsForQuestion || '1.0'),
      },
    });
  }

  // --- CRUD ANSWERS ---
  async createAnswer(data: CreateAnswerDto, userId: number): Promise<Answers> {
    const qId = parseInt(data.questionId, 10);

    // 1. Create Answer-nya dulu
    // Pake UncheckedCreateInput biar bisa tembak FK ID langsung
    const answer = await this.prisma.answers.create({
      data: {
        questionId: qId,
        answerText: data.answerText,
        isCorrect: data.isCorrect ?? false,
        feedbackText: data.feedbackText ?? null,
        orderNumber: data.orderNumber ? parseInt(data.orderNumber, 10) : 1,
        pointsIfSelected: data.pointsIfSelected
          ? parseInt(data.pointsIfSelected, 10)
          : 0,
        lastModifiedBy: userId,
        isActive: data.isActive ?? true,
        // Contoh metadata biar ESLint aman
        metadataJson: data.metadataJson as Prisma.InputJsonValue,
      },
    });

    // 2. Jika ini jawaban benar, update tabel Questions
    if (data.isCorrect === true) {
      await this.prisma.questions.update({
        where: { id: qId },
        data: {
          correctAnswerId: answer.id, // Update FK correctAnswerId di Questions
        },
      });
    }

    return answer;
  }
  async getExamWithQuestions(examId: number, userId: number) {
    // 1. Validasi sesi pengerjaan user
    // Pakai 'in' status biar kalau statusnya pindah ke 'in_progress' pas dikerjain nggak error 403
    const userExam = await this.prisma.userExams.findFirst({
      where: {
        examId: examId,
        userId: userId,
        status: { in: ['not_started', 'in_progress'] },
      },
      select: { id: true },
    });

    if (!userExam) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Ujian telah selesai dikerjakan.',
      });
    }

    // 2. Ambil data Exam sesuai patokan struktur yang lo mau
    const exam = await this.prisma.exams.findUnique({
      where: { id: examId },
      select: {
        id: true,
        examName: true,
        durationMinutes: true,
        passingScore: true,
        examPackageId: true,
        _count: {
          select: { examQuestions: true },
        },
        examQuestions: {
          orderBy: { orderInExam: 'asc' },
          select: {
            orderInExam: true,
            pointsForQuestion: true,
            question: {
              select: {
                id: true,
                questionText: true,
                questionType: true,
                explanationText: true,
                imageUrl: true,
                answers: {
                  where: { isActive: true },
                  orderBy: { orderNumber: 'asc' },
                  select: {
                    id: true,
                    answerText: true,
                    pointsIfSelected: true,
                    metadataJson: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exam)
      throw new NotFoundException(`Ujian dengan ID ${examId} tidak ditemukan`);

    // 3. Return dengan format success wrapper dan inject userExamId ke dalam data
    return {
      success: true,
      message: 'Data soal berhasil diambil',
      userExamId: userExam.id, // ID pengerjaan buat modal submit
      ...exam, // Semua data dari patokan lo (id, examName, dll)
      totalQuestions: exam._count.examQuestions,
      parentExamId: exam.examPackageId,
      // data: {
      // }
    };
  }

  // --- Mekanisme Ujian (User Exam Attempt) ---
  async startExam(examId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. CEK AKSES
      const access = await tx.userExams.findFirst({
        where: { userId, examId },
      });

      if (!access) {
        throw new ForbiddenException(
          'Akses ujian tidak ditemukan. Silakan selesaikan pembayaran.',
        );
      }

      // 2. AMBIL DATA MASTER EXAM (Buat ambil durasi)
      const exam = await tx.exams.findUnique({
        where: { id: examId },
        select: { durationMinutes: true, attemptsAllowed: true },
      });

      if (!exam)
        throw new NotFoundException('Data master ujian tidak ditemukan.');

      // 3. LOGIC RESUME (Jika sudah in_progress, hitung ulang deadline-nya)
      if (access.status === 'in_progress') {
        const startTime = access.startTime;
        const endTime = new Date(
          startTime.getTime() + exam.durationMinutes * 60000,
        );

        return {
          ...access,
          startTime,
          endTime, // Response tambahan buat FE
          durationMinutes: exam.durationMinutes,
        };
      }

      // 4. CEK KUOTA ATTEMPTS
      const completedCount = await tx.userExams.count({
        where: { userId, examId, status: 'submitted' },
      });

      const maxAttempts = exam.attemptsAllowed || 1;
      if (completedCount >= maxAttempts) {
        throw new BadRequestException(`Jatah ujian sudah habis.`);
      }

      // 5. UPDATE STATUS & MULAI TIMER
      const now = new Date();
      const deadline = new Date(now.getTime() + exam.durationMinutes * 60000);

      await tx.userExams.update({
        where: { id: access.id },
        data: {
          startTime: now,
          status: 'in_progress',
        },
      });

      // 6. RETURN DENGAN START & END TIME
      return {
        // ...startedExam,
        startTime: now,
        endTime: deadline, // Ini jam selesainya
        durationMinutes: exam.durationMinutes,
      };
    });
  }

  async submitAnswer(
    userExamId: number,
    questionId: number,
    answerId: number,
    userId: number,
  ) {
    // 1. VALIDASI KEPEMILIKAN & STATUS SESI
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: {
        exam: { select: { durationMinutes: true } },
      },
    });

    if (!attempt || attempt.userId !== userId) {
      throw new ForbiddenException('Akses ditolak. Sesi ujian tidak valid.');
    }

    if (attempt.status !== 'in_progress') {
      throw new BadRequestException(
        'Ujian sudah berakhir. Jawaban tidak bisa diubah.',
      );
    }

    // 2. LOGIC TIMER
    const now = new Date().getTime();
    const startTime = attempt.startTime.getTime();
    const durationMs = attempt.exam.durationMinutes * 60000;
    const deadline = startTime + durationMs;

    if (now > deadline) {
      await this.finishExam(userExamId, userId);
      throw new BadRequestException(
        'Waktu habis! Sesi ujian telah ditutup secara otomatis.',
      );
    }

    // 3. LOGIC UPDATE ATAU INSERT
    const existingAnswer = await this.prisma.userExamAnswers.findFirst({
      where: {
        userExamId: userExamId,
        questionId: questionId,
      },
    });

    let result: SubmitAnswerResult;
    let message: string;

    if (existingAnswer) {
      // Update jawaban yang sudah ada
      result = await this.prisma.userExamAnswers.update({
        where: { id: existingAnswer.id },
        data: {
          selectedAnswerId: answerId,
          updatedAt: new Date(),
        },
      });
      message = 'Jawaban berhasil diperbarui';
    } else {
      // Simpan jawaban baru
      result = await this.prisma.userExamAnswers.create({
        data: {
          userExamId: userExamId,
          questionId: questionId,
          selectedAnswerId: answerId,
          attemptNumber: 1,
        },
      });
      message = 'Jawaban berhasil disimpan';
    }

    // 4. RETURN RESPONSE SUKSES
    return {
      success: true,
      message: message,
      data: {
        id: result.id,
        questionId: result.questionId,
        selectedAnswerId: result.selectedAnswerId,
        updatedAt: result.updatedAt,
      },
    };
  }
  // async submitAnswer(
  //   userExamId: number,
  //   questionId: number,
  //   answerId: number,
  //   userId: number,
  // ) {
  //   // 1. VALIDASI KEPEMILIKAN & STATUS SESI
  //   const attempt = await this.prisma.userExams.findUnique({
  //     where: { id: userExamId },
  //     include: { exam: { select: { durationMinutes: true } } },
  //   });

  //   // Pastikan sesi ada, milik user yang login, dan statusnya masih in_progress
  //   if (!attempt || attempt.userId !== userId) {
  //     throw new ForbiddenException('Akses ditolak. Sesi ujian tidak valid.');
  //   }

  //   if (attempt.status !== 'in_progress') {
  //     throw new BadRequestException('Ujian sudah berakhir, Bal.');
  //   }

  //   // 2. LOGIC TIMER (SINGLE SOURCE OF TRUTH)
  //   const now = new Date().getTime();
  //   const startTime = attempt.startTime.getTime();
  //   const durationMs = attempt.exam.durationMinutes * 60000;
  //   const deadline = startTime + durationMs;

  //   // Jika waktu habis, langsung paksa finish dan blokir simpan jawaban
  //   if (now > deadline) {
  //     await this.finishExam(userExamId, userId);
  //     throw new BadRequestException('Waktu habis! Sesi ujian telah ditutup secara otomatis.');
  //   }

  //   // 3. SIMPAN ATAU UPDATE JAWABAN
  //   // Kita pakai findFirst karena user mungkin sudah pernah jawab soal ini sebelumnya
  //   const existingAnswer = await this.prisma.userExamAnswers.findFirst({
  //     where: { userExamId, questionId },
  //   });

  //   if (existingAnswer) {
  //     return this.prisma.userExamAnswers.update({
  //       where: { id: existingAnswer.id },
  //       data: {
  //         selectedAnswerId: answerId,
  //         updatedAt: new Date()
  //       },
  //     });
  //   } else {
  //     return this.prisma.userExamAnswers.create({
  //       data: {
  //         userExamId,
  //         questionId,
  //         selectedAnswerId: answerId,
  //         attemptNumber: 1, // Sesuai schema
  //       },
  //     });
  //   }
  // }
  async finishExam(userExamId: number, userId: number) {
    console.log(
      `Memproses finishExam untuk userExamId: ${userExamId}, userId: ${userId}`,
    );

    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: {
                question: {
                  include: { answers: true },
                },
              },
            },
          },
        },
        userExamAnswers: true,
      },
    });

    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Data ujian tidak ditemukan.');
    }

    // Jika sudah pernah submit, langsung return data yang ada
    if (attempt.status === 'submitted') {
      return {
        success: true,
        message: 'Ujian ini sudah diselesaikan sebelumnya.',
        data: attempt,
      };
    }

    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let emptyCount = 0;

    const questionsRelation = attempt.exam.examQuestions || [];

    if (questionsRelation.length === 0) {
      throw new BadRequestException('Ujian ini tidak memiliki soal.');
    }

    const evaluation = questionsRelation.map((eq) => {
      const question = eq.question;
      const userAns = attempt.userExamAnswers.find(
        (ans) => ans.questionId === question.id,
      );

      // Hitung jawaban kosong
      if (!userAns?.selectedAnswerId) {
        emptyCount++;
      }

      const isCorrect =
        question.answers.find(
          (a) => Number(a.id) === Number(userAns?.selectedAnswerId),
        )?.isCorrect || false;

      if (isCorrect) {
        totalScore += Number(eq.pointsForQuestion || 0);
        correctCount++;
      } else if (userAns?.selectedAnswerId) {
        wrongCount++;
      }

      return {
        questionId: question.id,
        selectedAnswerId: userAns?.selectedAnswerId || null,
        isCorrect,
      };
    });

    const passingScore = Number(attempt.exam.passingScore || 0);
    const isPassed = totalScore >= passingScore;
    const passingStatus = isPassed ? 'passed' : 'failed';

    // Update ke Database
    const updatedResult = await this.prisma.userExams.update({
      where: { id: userExamId },
      data: {
        score: totalScore.toString(),
        status: 'submitted',
        isCompleted: true,
        endTime: new Date(),
        submissionTime: new Date(),
        metadataJson: {
          summary: {
            totalQuestions: questionsRelation.length,
            correctAnswers: correctCount,
            wrongAnswers: wrongCount,
            unanswered: emptyCount,
            finalScore: totalScore,
            passingScore: passingScore,
            result: passingStatus,
          },
          details: evaluation,
        } as Prisma.InputJsonValue,
      },
    });

    await this.notificationsService.notifyByEvent({
      event: 'exam_submitted_student',
      userId,
      itemName: attempt.exam.examName,
      score: totalScore,
      passed: isPassed,
    });

    // RETURN RESPONSE UNTUK FRONTEND
    return {
      success: true,
      message: 'Ujian berhasil diselesaikan! Lihat hasil Anda.',
      data: {
        userExamId: updatedResult.id,
        examName: attempt.exam.examName,
        finalScore: totalScore,
        passingScore: passingScore,
        status: passingStatus, // 'passed' atau 'failed'
        summary: {
          totalQuestions: questionsRelation.length,
          correct: correctCount,
          wrong: wrongCount,
          empty: emptyCount,
        },
        submittedAt: updatedResult.submissionTime,
        // Lo bisa include details kalau FE butuh buat nampilin pembahasan langsung
        // details: evaluation
      },
    };
  }
  // async finishExam(userExamId: number, userId: number) {
  //   console.log(`Memproses finishExam untuk userExamId: ${userExamId}, userId: ${userId}`);
  //   const attempt = await this.prisma.userExams.findUnique({
  //     where: { id: userExamId },
  //     include: {
  //       exam: {
  //         include: {
  //           examQuestions: {
  //             include: {
  //               question: {
  //                 include: { answers: true }
  //               },
  //             },
  //           },
  //         },
  //       },
  //       userExamAnswers: true,
  //     },
  //   });

  //   if (!attempt || attempt.userId !== userId) {
  //     throw new NotFoundException("Data ujian tidak ditemukan.");
  //   }

  //   if (attempt.status === 'submitted') return attempt;

  //   let totalScore = 0;
  //   const questionsRelation = attempt.exam.examQuestions || [];

  //   if (questionsRelation.length === 0) {
  //     throw new BadRequestException("Ujian ini tidak memiliki soal.");
  //   }

  //   const evaluation = questionsRelation.map((eq) => {
  //     const question = eq.question;
  //     const userAns = attempt.userExamAnswers.find(
  //       (ans) => ans.questionId === question.id
  //     );

  //     const isCorrect = question.answers.find(
  //       (a) => Number(a.id) === Number(userAns?.selectedAnswerId)
  //     )?.isCorrect || false;

  //     if (isCorrect) {
  //       totalScore += Number(eq.pointsForQuestion || 0);
  //     }

  //     return {
  //       questionId: question.id,
  //       selectedAnswerId: userAns?.selectedAnswerId || null,
  //       isCorrect,
  //     };
  //   });

  //   // LOGIC TAMBAHAN: Cek Lulus/Tidak Lulus
  //   const passingScore = Number(attempt.exam.passingScore || 0);
  //   const passingStatus = totalScore >= passingScore ? 'passed' : 'failed';

  //   return await this.prisma.userExams.update({
  //     where: { id: userExamId },
  //     data: {
  //       score: totalScore.toString(),
  //       status: "submitted",
  //       isCompleted: true,
  //       // passingStatus, // Simpan status kelulusan
  //       endTime: new Date(),
  //       submissionTime: new Date(),
  //       metadataJson: {
  //         summary: {
  //           totalQuestions: questionsRelation.length,
  //           finalScore: totalScore,
  //           passingScore: passingScore,
  //           result: passingStatus
  //         },
  //         details: evaluation,
  //       } as any,
  //     },
  //   });
  // }

  // async getRemainingTime(userExamId: number, userId: number) {
  //   const attempt = await this.prisma.userExams.findUnique({
  //     where: { id: userExamId },
  //     include: {
  //       exam: { select: { durationMinutes: true } },
  //     },
  //   });

  //   if (!attempt) throw new NotFoundException('Sesi ujian tidak ditemukan');
  //   if (attempt.userId !== userId) throw new ForbiddenException('Akses ditolak');

  //   const now = new Date().getTime();
  //   const startTime = attempt.startTime.getTime();
  //   const durationMinutes = attempt.exam.durationMinutes;
  //   const deadline = startTime + durationMinutes * 60000;
  //   const remaining = Math.max(0, Math.floor((deadline - now) / 1000));

  //   return {
  //     remainingSeconds: remaining,
  //     isExpired: remaining <= 0,
  //   };
  // }

  // Tambahkan kurung kurawal tutup untuk menutup class ExamsService
  // }
  // async finishExam(userExamId: number, userId: number) {
  //   const attempt = await this.prisma.userExams.findUnique({
  //     where: { id: userExamId },
  //     include: { exam: true },
  //   });

  //   if (!attempt || attempt.userId !== userId)
  //     throw new NotFoundException('Sesi tidak ditemukan');
  //   if (attempt.status === 'submitted') return attempt;
  //   if (!attempt || attempt.status !== 'in_progress') {
  //     throw new BadRequestException('Ujian tidak aktif atau sudah selesai');
  //   }

  //   const now = new Date();
  //   const durationInMs = attempt.exam.durationMinutes * 60000;
  //   const deadline = new Date(attempt.startTime.getTime() + durationInMs);

  //   if (now > deadline) {
  //     // Jika lewat waktu, kita paksa submit apa adanya
  //     console.log("Waktu habis! Auto-submitting...");
  //   }

  //   const userAnswers = await this.prisma.userExamAnswers.findMany({
  //     where: { userExamId },
  //     include: {
  //       selectedAnswer: { select: { isCorrect: true } },
  //       question: {
  //         include: { examQuestions: { where: { examId: attempt.examId } } },
  //       },
  //     },
  //   });

  //   const totalScore = userAnswers.reduce((acc, curr) => {
  //     const isCorrect = curr.selectedAnswer?.isCorrect || false;
  //     const point = Number(
  //       curr.question.examQuestions[0]?.pointsForQuestion || 0,
  //     );
  //     return isCorrect ? acc + point : acc;
  //   }, 0);
  //   const endTime = new Date();
  //   // Hitung selisih dalam menit
  //   const timeTakenMinutes = Math.floor(
  //     (endTime.getTime() - attempt.startTime.getTime()) / 60000,
  //   );

  //   return this.prisma.userExams.update({
  //     where: { id: userExamId },
  //     data: {
  //       endTime: new Date(),
  //       submissionTime: new Date(),
  //       score: totalScore,
  //       isCompleted: true,
  //       status: 'submitted',
  //       metadataJson: {
  //         ...((attempt.metadataJson as object) || {}),
  //         timeTakenMinutes: timeTakenMinutes,
  //       } as Prisma.InputJsonValue,
  //     },
  //   });
  // }

  async getRemainingTime(userExamId: number, userId: number) {
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: {
        exam: {
          select: { durationMinutes: true },
        },
      },
    });

    // Pengecekan ini wajib supaya TypeScript tau 'attempt' bukan null/any
    if (!attempt) {
      throw new NotFoundException('Sesi ujian tidak ditemukan');
    }

    if (attempt.userId !== userId) {
      throw new ForbiddenException('Akses ditolak');
    }

    const now = new Date().getTime();
    const startTime = attempt.startTime.getTime();
    const durationMinutes = attempt.exam.durationMinutes;
    const deadline = startTime + durationMinutes * 60000;
    const remaining = Math.max(0, Math.floor((deadline - now) / 1000));

    return {
      remainingSeconds: remaining,
      isExpired: remaining <= 0,
    };
  }
  // async finishExam(userExamId: number, userId: number) {
  //   const userExam = await this.prisma.userExams.findUnique({
  //     where: { id: userExamId },
  //     include: { exam: true },
  //   });
  //   const attempt = await this.prisma.userExams.findUnique({
  //     where: { id: userExamId },
  //     include: {
  //       exam: {
  //         select: { durationMinutes: true },
  //       },
  //     },
  //   });

  //   if (!attempt) throw new NotFoundException('Sesi tidak ditemukan');

  //   if (!userExam || userExam.userId !== userId)
  //     throw new NotFoundException('Sesi tidak ditemukan');
  //   if (userExam.status === 'submitted')
  //     throw new BadRequestException('Ujian ini sudah lo kumpulin sebelumnya.');

  //   // Ambil semua jawaban user
  //   const userAnswers = await this.prisma.userExamAnswers.findMany({
  //     where: { userExamId },
  //     include: {
  //       selectedAnswer: { select: { isCorrect: true } },
  //       question: {
  //         include: {
  //           examQuestions: { where: { examId: userExam.examId } },
  //         },
  //       },
  //     },
  //   });

  //   // Hitung Skor
  //   const totalScore = userAnswers.reduce((acc, curr) => {
  //     const isCorrect = curr.selectedAnswer?.isCorrect || false;
  //     const points = Number(
  //       curr.question?.examQuestions[0]?.pointsForQuestion || 0,
  //     );
  //     return isCorrect ? acc + points : acc;
  //   }, 0);

  //   const endTime = new Date();
  //   // Kalkulasi durasi pengerjaan (dalam menit)
  //   const timeTaken = Math.round(
  //     (endTime.getTime() - attempt.startTime.getTime()) / 60000,
  //   );
  //   // Update Status & Skor Final
  //   return this.prisma.userExams.update({
  //     where: { id: userExamId },
  //     data: {
  //       endTime: new Date(),
  //       score: totalScore,
  //       status: 'submitted',
  //       isCompleted: true,
  //       submissionTime: new Date(),
  //       metadataJson: {
  //         timeTakenMinutes: timeTaken,
  //       },
  //     },
  //   });
  // }

  async updateExamQuestion(
    id: number,
    data: {
      orderInExam?: string | number;
      pointsForQuestion?: string | number;
      sectionName?: string;
    },
  ) {
    const existing = await this.prisma.examQuestions.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Relasi soal dan ujian tidak ditemukan');

    // Tambahkan pengecekan data
    if (!data) throw new BadRequestException('Payload data tidak boleh kosong');

    return this.prisma.examQuestions.update({
      where: { id },
      data: {
        // Menggunakan optional chaining atau pengecekan null
        orderInExam: data?.orderInExam ? Number(data.orderInExam) : undefined,
        pointsForQuestion: data?.pointsForQuestion
          ? new Prisma.Decimal(data.pointsForQuestion)
          : undefined,
        sectionName: data?.sectionName ?? undefined,
      },
    });
  }

  // --- 2. REMOVE QUESTION FROM EXAM ---
  async removeQuestionFromExam(examId: number, questionId: number) {
    // Cukup hapus record di tabel jembatan (ExamQuestions)
    // Soal asli di tabel Questions tetap aman (tidak terhapus)
    const record = await this.prisma.examQuestions.findFirst({
      where: { examId, questionId },
    });

    if (!record)
      throw new NotFoundException('Soal tidak ditemukan di ujian ini');

    return this.prisma.examQuestions.delete({
      where: { id: record.id },
    });
  }

  // --- 3. TOGGLE STATUS UJIAN (PUBLISH/DRAFT) ---
  async updateExamStatus(id: number, status: string) {
    const exam = await this.prisma.exams.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    return this.prisma.exams.update({
      where: { id },
      data: { status },
    });
  }

  // Tambahkan ini di ExamsService (src/exams/exams.service.ts)
  async getExamReview(userExamId: number, userId: number) {
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: {
                question: {
                  include: { answers: true },
                },
              },
            },
          },
        },
        userExamAnswers: true,
      },
    });

    if (!attempt || attempt.userId !== userId) throw new NotFoundException();

    // Return data beserta ExplanationText untuk pembahasan
    return attempt;
  }

  async bulkCreateQuestions(dto: BulkCreateQuestionsDto, userId: number) {
    if (!dto.questions || dto.questions.length === 0) {
      throw new BadRequestException(
        'Questions array is required and cannot be empty',
      );
    }

    const resolvedImageUrls: (string | null)[] = [];
    for (let i = 0; i < dto.questions.length; i++) {
      try {
        resolvedImageUrls.push(
          await this.resolveQuestionImageUrl(
            toOptionalImageUrl(
              (dto.questions[i] as { imageUrl?: unknown }).imageUrl,
            ),
          ),
        );
      } catch (err: unknown) {
        const base =
          err instanceof BadRequestException
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Gagal mengunggah gambar dari URL';
        throw new BadRequestException(`Soal ke-${i + 1}: ${base}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const results: Questions[] = [];

      for (let i = 0; i < dto.questions.length; i++) {
        const q = dto.questions[i];
        const imageUrlFinal = resolvedImageUrls[i];

        // Validasi manual lo tetap gue jaga di sini
        if (!q.questionText || q.questionText.trim() === '') {
          throw new BadRequestException(
            'questionText is required and cannot be empty',
          );
        }
        if (!q.answers || q.answers.length === 0) {
          throw new BadRequestException(
            'Answers are required for each question',
          );
        }
        if (dto.examId === undefined)
          throw new BadRequestException('examId wajib diisi');
        if (q.orderInExam === undefined)
          throw new BadRequestException('orderInExam wajib diisi');
        if (dto.subjectId === undefined)
          throw new BadRequestException('subjectId wajib diisi');
        if (q.answers.length < 2)
          throw new BadRequestException('Minimal 2 jawaban');

        // 1. Buat Soal
        const question = await tx.questions.create({
          data: {
            questionText: q.questionText,
            explanationText: q.explanationText || null,
            subjectId: dto.subjectId,
            questionType: 'multiple_choice',
            points: q.points || 5,
            difficultyLevel: q.difficultyLevel || 'medium',
            createdByUserId: userId,
            isActive: true,
            imageUrl: imageUrlFinal,
            answers: {
              create: q.answers.map((a, j) => {
                // Validasi jawaban
                if (!a.label || !a.answerText || a.isCorrect === undefined) {
                  throw new BadRequestException(
                    `Answer ke-${j + 1} tidak lengkap`,
                  );
                }

                return {
                  answerText: a.answerText,
                  isCorrect: a.isCorrect,
                  // KARENA GAK ADA KOLOM LABEL DI DB, KITA TARUH DI SINI:
                  metadataJson: { label: a.label },
                };
              }),
            },
          },
        });

        // 2. Hubungkan ke ExamQuestions
        await tx.examQuestions.create({
          data: {
            examId: dto.examId,
            questionId: question.id,
            orderInExam: q.orderInExam,
            pointsForQuestion: new Prisma.Decimal(q.points || 5),
          },
        });

        results.push(question);
      }

      return {
        message: `${results.length} soal berhasil di-import dengan Subject ID: ${dto.subjectId}`,
        count: results.length,
      };
    });
  }

  async submitExam(dto: SubmitExamDto, userId: number) {
    const { userExamId, answers } = dto;
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: { exam: true },
    });

    if (!attempt || attempt.userId !== userId)
      throw new NotFoundException('Data ujian tidak ditemukan');
    if (attempt.status === 'submitted')
      throw new BadRequestException('Ujian sudah dikumpulkan');

    return this.prisma.$transaction(async (tx) => {
      let totalScore = 0;
      const subjectScores: Record<string, number> = {}; // Objek penampung skor per subjek

      for (const ans of answers) {
        const question = await tx.questions.findUnique({
          where: { id: ans.questionId },
          include: { subject: true }, // Ambil nama subjeknya (TWK/TIU/TKP)
        });

        const correctOption = await tx.answers.findFirst({
          where: { questionId: ans.questionId, isCorrect: true },
        });

        const isCorrect = correctOption?.id === ans.selectedAnswerId;
        const examQuestion = await tx.examQuestions.findFirst({
          where: { examId: attempt.examId, questionId: ans.questionId },
        });

        const points = Number(examQuestion?.pointsForQuestion || 0);
        const subjectName = question?.subject?.subjectName || 'Umum';

        if (isCorrect) {
          totalScore += points;
          subjectScores[subjectName] =
            (subjectScores[subjectName] || 0) + points;
        } else {
          subjectScores[subjectName] = subjectScores[subjectName] || 0;
        }

        await tx.userExamAnswers.create({
          data: {
            userExamId,
            questionId: ans.questionId,
            selectedAnswerId: ans.selectedAnswerId,
            isCorrect,
            metadataJson: {},
          },
        });
      }

      // Simpan analisis subjek ke dalam metadataJson
      return tx.userExams.update({
        where: { id: userExamId },
        data: {
          status: 'submitted',
          endTime: new Date(),
          score: totalScore,
          metadataJson: {
            analysisPerSubject: subjectScores, // Contoh: { "TIU": 80, "TWK": 95 }
          },
        },
      });
    });
  }

  async monitorActiveAttempts() {
    const activeAttempts = await this.prisma.userExams.findMany({
      where: { status: 'in_progress' }, //
      include: {
        user: { select: { firstName: true, email: true } },
        exam: { select: { examName: true, durationMinutes: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return activeAttempts.map((attempt) => {
      const now = new Date().getTime();
      const deadline =
        attempt.startTime.getTime() + attempt.exam.durationMinutes * 60000;
      const remainingSeconds = Math.max(0, Math.floor((deadline - now) / 1000));

      return {
        ...attempt,
        remainingTime: `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`,
        isExpired: remainingSeconds <= 0,
      };
    });
  }

  async createVoucher(data: VoucherInput) {
    return this.prisma.coupons.create({
      data: {
        couponCode: data.couponCode,
        discountType: data.discountType, // 'percentage' atau 'fixed'
        discountValue: new Prisma.Decimal(data.discountValue),
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        maxUses: data.maxUses,
        isActive: true,
        appliesToEntityType: 'exam', // Default buat launching lo[cite: 5]
        appliesToEntityIds: data.examIds || [], // Array ID exam yang boleh pake voucher ini[cite: 5]
      },
    });
  }

  async autoSubmitExpiredExams() {
    const now = new Date();

    // Cari semua attempt yang statusnya in_progress tapi sudah lewat deadline
    // deadline = startTime + durationMinutes
    const expiredExams = await this.prisma.userExams.findMany({
      where: {
        status: 'in_progress',
      },
      include: { exam: true },
    });

    const toSubmit = expiredExams.filter((attempt) => {
      const deadline = new Date(
        attempt.startTime.getTime() + attempt.exam.durationMinutes * 60000,
      );
      return now > deadline;
    });

    // Proses bulk update status ke 'submitted'
    if (toSubmit.length > 0) {
      const ids = toSubmit.map((a) => a.id);
      await this.prisma.userExams.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'submitted',
          endTime: now,
          // Skor tetap dihitung berdasarkan jawaban yang sempat tersimpan[cite: 5]
        },
      });
    }

    return { processed: toSubmit.length };
  }

  async getScoreByExam(examId: number, userId: number) {
    // 1. Cari data pengerjaan yang sudah submitted
    const result = await this.prisma.userExams.findFirst({
      where: {
        examId: examId,
        userId: userId,
        status: 'submitted', // Pastikan hanya ambil yang sudah selesai
      },
      include: {
        exam: {
          select: {
            examName: true,
            passingScore: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(
        'Data hasil ujian tidak ditemukan. Mungkin Anda belum menyelesaikan ujian ini.',
      );
    }

    // 2. Mapping output biar FE gampang nampilinnya
    // Kita ambil summary yang lo simpan di metadataJson pas finishExam tadi
    const metadata = (result.metadataJson ?? {}) as ExamScoreMetadata;
    const summary = metadata.summary ?? {};

    return {
      success: true,
      message: 'Data skor berhasil diambil',
      data: {
        userExamId: result.id,
        examName: result.exam.examName,
        finalScore: Number(result.score),
        passingScore: Number(result.exam.passingScore),
        status:
          summary.result ||
          (Number(result.score) >= Number(result.exam.passingScore)
            ? 'passed'
            : 'failed'),
        statistics: {
          totalQuestions: summary.totalQuestions || 0,
          correctAnswers: summary.correctAnswers || 0,
          wrongAnswers: summary.wrongAnswers || 0,
          unanswered: summary.unanswered || 0,
        },
        submittedAt: result.submissionTime,
        // Jika lo mau nampilin pembahasan (details), ambil dari metadataJson.details
        details: metadata.details ?? [],
      },
    };
  }
}
