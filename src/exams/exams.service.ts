// src/exams/exams.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import {
  Answers,
  ExamQuestions,
  Exams,
  Prisma,
  Questions,
} from '@prisma/client';
import { CreateQuestionDto } from './dto/create-question.dto';
import { AddQuestionToExamDto } from './dto/add-question-to-exam.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
// import { session } from 'passport';

@Injectable()
export class ExamsService {
  // cloudinary: any;
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // --- CRUD EXAMS ---
  async createExam(data: CreateExamDto, userId: number): Promise<Exams> {
    // Validasi dasar userId
    if (!userId) {
      throw new BadRequestException('User ID tidak valid');
    }

    return this.prisma.exams.create({
      data: {
        examName: data.examName,
        description: data.description ?? null,
        durationMinutes: parseInt(data.durationMinutes, 10),
        examType: data.examType,
        status: data.status ?? 'draft',
        // Handling DateTime
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,

        // Handling Decimal (Prisma.Decimal)
        passingScore: data.passingScore
          ? new Prisma.Decimal(data.passingScore)
          : null,
        price: data.price
          ? new Prisma.Decimal(data.price)
          : new Prisma.Decimal(0),

        // Handling Int
        attemptsAllowed: data.attemptsAllowed
          ? parseInt(data.attemptsAllowed, 10)
          : 1,
        // Handling Boolean (Default di DB sudah ada, tapi ini buat jaga-jaga)
        randomizeQuestions: data.randomizeQuestions ?? true,

        // Relasi 1: Subject (BUMN/CPNS)
        subject: {
          connect: { id: parseInt(data.subjectId, 10) },
        },

        // Relasi 2: Creator
        createdByUser: {
          connect: { id: userId },
        },

        // Metadata JSON (Type-safe casting)
        metadataJson: {
          source: 'admin_panel',
          created_at_iso: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  async updateExam(id: number, userId: number, data: Partial<CreateExamDto>) {
    const exam = await this.prisma.exams.findUnique({ where: { id } });
    
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    // Update data dengan konversi tipe yang sesuai schema (Decimal & Int)
    return this.prisma.exams.update({
      where: { id },
      data: {
        examName: data.examName,
        description: data.description,
        durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes, 10) : undefined,
        examType: data.examType,
        status: data.status, // Bisa buat ganti status manual
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        passingScore: data.passingScore ? new Prisma.Decimal(data.passingScore) : undefined,
        price: data.price ? new Prisma.Decimal(data.price) : undefined,
        attemptsAllowed: data.attemptsAllowed ? parseInt(data.attemptsAllowed, 10) : undefined,
        randomizeQuestions: data.randomizeQuestions,
        // Update metadata biar ketahuan siapa yang terakhir ngubah
        metadataJson: {
          ...(exam.metadataJson as object || {}),
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

  // --- GET EXAM PUBLISHING ---
  async findAllPublished(subjectName?: string, page: number = 1, limit: number = 10) {
    // 1. Validasi: Gak boleh get-all tanpa kategori
    if (!subjectName) {
      throw new BadRequestException('Kategori (BUMN/CPNS) harus dipilih!');
    }

    // 2. Validasi Limit: Cuma boleh 10, 30, atau 50
    const allowedLimits = [10, 30, 50];
    const safeLimit = allowedLimits.includes(Number(limit)) ? Number(limit) : 10;
    
    // 3. Hitung Skip (Offset)
    const skip = (Number(page) - 1) * safeLimit;

    // 4. Query ke Prisma
    const [data, total] = await Promise.all([
      this.prisma.exams.findMany({
        where: {
          status: 'published',
          subject: {
            subjectName: {
              equals: subjectName,
              mode: 'insensitive',
            },
          },
        },
        take: safeLimit,
        skip: skip,
        select: {
          id: true,
          examName: true,
          description: true,
          examType: true,
          subject: {
            select: {
              subjectName: true,
            },
          },
          _count: {
            select: { examQuestions: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      // Hitung total data untuk info pagination di FE
      this.prisma.exams.count({
        where: {
          status: 'published',
          subject: { subjectName: { equals: subjectName, mode: 'insensitive' } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        lastPage: Math.ceil(total / safeLimit),
        limit: safeLimit,
      },
    };
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
        orderItems: { some: { itemId: id, itemType: 'exam' } },
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

  async getExamWithQuestions(examId: number) {
    const exam = await this.prisma.exams.findUnique({
      where: { id: examId },
      select: {
        id: true,
        examName: true,
        durationMinutes: true,
        passingScore: true,
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
                explanationText: true, // Buat pembahasan
                imageUrl: true,
                answers: {
                  where: { isActive: true },
                  orderBy: { orderNumber: 'asc' },
                  select: {
                    id: true,
                    answerText: true,
                    isCorrect: true, // Kunci jawaban
                    pointsIfSelected: true,
                    metadataJson: true, // Label A, B, C, D
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) throw new NotFoundException(`Ujian dengan ID ${examId} tidak ditemukan`);
    return exam;
  }

  // --- Mekanisme Ujian (User Exam Attempt) ---
  async startExam(examId: number, userId: number) {
    // Gunakan findFirst dengan status yang masih aktif[cite: 5]
    const activeAttempt = await this.prisma.userExams.findFirst({
      where: {
        userId,
        examId,
        status: 'in_progress'
      }
    });
    if (activeAttempt) {
      // Bukannya bikin baru, arahkan user balik ke ujian yang sudah ada
      return activeAttempt; 
    }

    // Cek apakah user sudah pernah submit (biar nggak ujian berkali-kali kalau aturannya cuma boleh 1x)
    const completedAttempt = await this.prisma.userExams.findFirst({
      where: { userId, examId, status: 'submitted' }
    });

    if (completedAttempt) {
      throw new BadRequestException('Lo udah nyelesein ujian ini, Bal.');
    }
    // Gunakan transaction untuk memastikan pengecekan kuota aman dari race condition
    return this.prisma.$transaction(async (tx) => {
      const hasAccess = await tx.orders.findFirst({
        where: {
          userId,
          orderStatus: 'completed',
          orderItems: { some: { itemId: examId, itemType: 'exam' } },
        },
      });
      if (!hasAccess)
        throw new ForbiddenException('Beli dulu paket ujiannya, Bang.');

      const exam = await tx.exams.findUnique({ where: { id: examId } });
      // Cek apakah ada ujian yang sedang 'in_progress', kalau ada balikkan yang itu saja
      const existingAttempt = await tx.userExams.findFirst({
        where: { examId, userId, status: 'in_progress' },
      });
      if (existingAttempt) return existingAttempt;

      const count = await tx.userExams.count({
        where: { examId, userId, status: 'submitted' },
      });

      if (count >= (exam?.attemptsAllowed || 1))
        throw new BadRequestException('Jatah ujian sudah habis.');

      return tx.userExams.create({
        data: {
          examId,
          userId,
          startTime: new Date(),
          status: 'in_progress',
        },
      });
    });
  }

  async submitAnswer(
    userExamId: number,
    questionId: number,
    answerId: number,
    userId: number,
  ) {
    // Ambil data attempt beserta durasi dari master exam
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: { exam: { select: { durationMinutes: true } } },
    });

    if (!attempt || attempt.userId !== userId)
      throw new ForbiddenException(
        'Akses ditolak. Silakan login kembali atau hubungi admin.',
      );
    if (attempt.status !== 'in_progress')
      throw new BadRequestException('Ujian sudah selesai.');

    // --- LOGIC TIMER KONSISTEN ---
    const now = new Date().getTime();
    const deadline =
      attempt.startTime.getTime() + attempt.exam.durationMinutes * 60000;

    if (now > deadline) {
      await this.finishExam(userExamId, userId);
      throw new BadRequestException('Waktu habis! Jawaban tidak tersimpan.');
    }

    const existingAnswer = await this.prisma.userExamAnswers.findFirst({
      where: { userExamId, questionId },
    });

    if (existingAnswer) {
      return this.prisma.userExamAnswers.update({
        where: { id: existingAnswer.id },
        data: { selectedAnswerId: answerId, updatedAt: new Date() },
      });
    } else {
      return this.prisma.userExamAnswers.create({
        data: {
          userExamId,
          questionId,
          selectedAnswerId: answerId,
          attemptNumber: 1,
        },
      });
    }
  }

  async finishExam(userExamId: number, userId: number) {
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: { exam: true },
    });

    if (!attempt || attempt.userId !== userId)
      throw new NotFoundException('Sesi tidak ditemukan');
    if (attempt.status === 'submitted') return attempt;
    if (!attempt || attempt.status !== 'in_progress') {
      throw new BadRequestException('Ujian tidak aktif atau sudah selesai');
    }

    const now = new Date();
    const durationInMs = attempt.exam.durationMinutes * 60000;
    const deadline = new Date(attempt.startTime.getTime() + durationInMs);

    if (now > deadline) {
      // Jika lewat waktu, kita paksa submit apa adanya
      console.log("Waktu habis! Auto-submitting...");
    }

    const userAnswers = await this.prisma.userExamAnswers.findMany({
      where: { userExamId },
      include: {
        selectedAnswer: { select: { isCorrect: true } },
        question: {
          include: { examQuestions: { where: { examId: attempt.examId } } },
        },
      },
    });

    const totalScore = userAnswers.reduce((acc, curr) => {
      const isCorrect = curr.selectedAnswer?.isCorrect || false;
      const point = Number(
        curr.question.examQuestions[0]?.pointsForQuestion || 0,
      );
      return isCorrect ? acc + point : acc;
    }, 0);
    const endTime = new Date();
    // Hitung selisih dalam menit
    const timeTakenMinutes = Math.floor(
      (endTime.getTime() - attempt.startTime.getTime()) / 60000,
    );

    return this.prisma.userExams.update({
      where: { id: userExamId },
      data: {
        endTime: new Date(),
        submissionTime: new Date(),
        score: totalScore,
        isCompleted: true,
        status: 'submitted',
        metadataJson: {
          ...((attempt.metadataJson as object) || {}),
          timeTakenMinutes: timeTakenMinutes,
        } as Prisma.InputJsonValue,
      },
    });
  }

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

  // checkout exam
  async getExamCheckoutPreview(examId: number) {
    const exam = await this.prisma.exams.findUnique({
      where: { id: examId },
      include: {
        subject: true,
        _count: { select: { examQuestions: true } }, // Biar tau ada berapa soal
      },
    });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    return {
      examId: exam.id,
      title: exam.examName,
      price: exam.price,
      duration: exam.durationMinutes,
      totalQuestions: exam._count.examQuestions,
      subjectName: exam.subject?.subjectName,
    };
  }

  async processExamCheckout(
    examId: number,
    userId: number,
    paymentMethod: string,
    file: Express.Multer.File,
    discountCode?: string,
  ) {
    // 1. Cari data Exam
    const exam = await this.prisma.exams.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    const totalAmount = exam.price ?? new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let couponId: number | null = null;

    // 2. LOGIC DISKON (Validasi & Perhitungan)
    if (discountCode) {
      const coupon = await this.prisma.coupons.findUnique({
        where: { couponCode: discountCode },
      });

      const now = new Date();

      // Validasi Dasar (Aktif, Tanggal, & Kuota)
      const isValidBasic =
        coupon &&
        coupon.isActive &&
        now >= coupon.validFrom &&
        now <= coupon.validUntil &&
        (coupon.maxUses === null || (coupon.usesCount ?? 0) < coupon.maxUses);

      if (!isValidBasic) {
        throw new BadRequestException(
          'Kupon tidak valid atau sudah kadaluarsa',
        );
      }

      // --- VALIDASI ENTITAS (Khusus Exam) ---
      // Cek apakah kupon ini memang untuk 'exam'
      if (coupon.appliesToEntityType && coupon.appliesToEntityType !== 'exam') {
        throw new BadRequestException(
          'Kupon ini hanya berlaku untuk kursus, bukan ujian.',
        );
      }

      // Cek apakah kupon ini spesifik untuk ID tertentu (jika field appliesToEntityIds diisi)
      if (coupon.appliesToEntityIds) {
        const allowedIds = coupon.appliesToEntityIds as number[];
        if (!allowedIds.includes(examId)) {
          throw new BadRequestException(
            'Kupon tidak berlaku untuk paket ujian ini.',
          );
        }
      }

      // Hitung Diskon
      couponId = coupon.id;
      if (coupon.discountType === 'percentage') {
        discountAmount = totalAmount.mul(Number(coupon.discountValue) / 100);
      } else {
        discountAmount = new Prisma.Decimal(coupon.discountValue);
      }
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);

    // 3. EKSEKUSI TRANSAKSI
    return await this.prisma.$transaction(async (tx) => {
      // A. Buat Order
      const order = await tx.orders.create({
        data: {
          userId: userId,
          totalAmount: totalAmount,
          discountAmount: discountAmount,
          grandTotal: grandTotal,
          couponCode: discountCode || null,
          orderStatus: 'pending',
          paymentStatus: 'pending',
          paymentMethod: paymentMethod,
          orderItems: {
            create: [
              {
                itemType: 'exam',
                itemId: examId,
                itemName: exam.examName,
                pricePerItem: totalAmount,
                totalPrice: grandTotal,
                courseId: 0, // Sesuai schema lo yang minta Int
                metadataJson: { examId: examId } as Prisma.JsonObject,
              },
            ],
          },
        },
      });

      // B. Update kuota kupon jika dipakai
      if (couponId) {
        await tx.coupons.update({
          where: { id: couponId },
          data: { usesCount: { increment: 1 } },
        });
      }

      // C. Upload Bukti & Record Payment
      const upload = await this.cloudinary.uploadFile(
        file,
        'exam_payment_proofs',
      );

      await tx.payments.create({
        data: {
          orderId: order.id,
          userId: userId,
          amount: grandTotal,
          paymentMethod: paymentMethod,
          transactionId: `EXTX-${Date.now()}-${userId}`,
          paymentStatus: 'pending',
          receiptUrl: upload.secure_url,
        },
      });

      return {
        message: 'Pembayaran ujian berhasil diupload. Tunggu verifikasi admin.',
        success: true,
        orderId: order.id,
        grandTotal: grandTotal,
      };
    });
  }

  async updateExamQuestion(id: number, data: any) {
    const existing = await this.prisma.examQuestions.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Relasi soal dan ujian tidak ditemukan');

    // Tambahkan pengecekan data
    if (!data) throw new BadRequestException('Payload data tidak boleh kosong');

    return this.prisma.examQuestions.update({
      where: { id },
      data: {
        // Menggunakan optional chaining atau pengecekan null
        orderInExam: data?.orderInExam ? parseInt(data.orderInExam, 10) : undefined,
        pointsForQuestion: data?.pointsForQuestion ? new Prisma.Decimal(data.pointsForQuestion) : undefined,
        sectionName: data?.sectionName ?? undefined,
      },
    });
  }

  // --- 2. REMOVE QUESTION FROM EXAM ---
  async removeQuestionFromExam(examId: number, questionId: number) {
    // Cukup hapus record di tabel jembatan (ExamQuestions)
    // Soal asli di tabel Questions tetap aman (tidak terhapus)
    const record = await this.prisma.examQuestions.findFirst({
      where: { examId, questionId }
    });

    if (!record) throw new NotFoundException('Soal tidak ditemukan di ujian ini');

    return this.prisma.examQuestions.delete({
      where: { id: record.id }
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
                  include: { answers: true }
                }
              }
            }
          }
        },
        userExamAnswers: true
      }
    });

    if (!attempt || attempt.userId !== userId) throw new NotFoundException();
    
    // Return data beserta ExplanationText untuk pembahasan
    return attempt;
  }

  async bulkCreateQuestions(dto: BulkCreateQuestionsDto, userId: number) {
    if (!dto.questions || dto.questions.length === 0) {
      throw new BadRequestException('Questions array is required and cannot be empty');
    }

    return this.prisma.$transaction(async (tx) => {
      const results: Questions[] = [];

      for (const q of dto.questions) {
        // Validasi manual lo tetap gue jaga di sini
        if (!q.questionText || q.questionText.trim() === '') {
          throw new BadRequestException('questionText is required and cannot be empty');
        }
        if (!q.answers || q.answers.length === 0) {
          throw new BadRequestException('Answers are required for each question');
        }
        if (dto.examId === undefined) throw new BadRequestException('examId wajib diisi');
        if (q.orderInExam === undefined) throw new BadRequestException('orderInExam wajib diisi');
        if (dto.subjectId === undefined) throw new BadRequestException('subjectId wajib diisi');
        if (q.answers.length < 2) throw new BadRequestException('Minimal 2 jawaban');

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
            answers: {
              create: q.answers.map((a, i) => {
                // Validasi jawaban
                if (!a.label || !a.answerText || a.isCorrect === undefined) {
                  throw new BadRequestException(`Answer ke-${i + 1} tidak lengkap`);
                }

                return {
                  answerText: a.answerText,
                  isCorrect: a.isCorrect,
                  // KARENA GAK ADA KOLOM LABEL DI DB, KITA TARUH DI SINI:
                  metadataJson: { label: a.label } 
                };
              })
            }
          }
        });

        // 2. Hubungkan ke ExamQuestions
        await tx.examQuestions.create({
          data: {
            examId: dto.examId,
            questionId: question.id,
            orderInExam: q.orderInExam,
            pointsForQuestion: new Prisma.Decimal(q.points || 5),
          }
        });

        results.push(question);
      }

      return {
        message: `${results.length} soal berhasil di-import dengan Subject ID: ${dto.subjectId}`,
        count: results.length
      };
    });
  }

  async submitExam(dto: SubmitExamDto, userId: number) {
    const { userExamId, answers } = dto;
    const attempt = await this.prisma.userExams.findUnique({
      where: { id: userExamId },
      include: { exam: true }
    });

    if (!attempt || attempt.userId !== userId) throw new NotFoundException('Data ujian tidak ditemukan');
    if (attempt.status === 'submitted') throw new BadRequestException('Ujian sudah dikumpulkan');

    return this.prisma.$transaction(async (tx) => {
      let totalScore = 0;
      const subjectScores: Record<string, number> = {}; // Objek penampung skor per subjek

      for (const ans of answers) {
        const question = await tx.questions.findUnique({
          where: { id: ans.questionId },
          include: { subject: true } // Ambil nama subjeknya (TWK/TIU/TKP)
        });

        const correctOption = await tx.answers.findFirst({
          where: { questionId: ans.questionId, isCorrect: true }
        });

        const isCorrect = correctOption?.id === ans.selectedAnswerId;
        const examQuestion = await tx.examQuestions.findFirst({
          where: { examId: attempt.examId, questionId: ans.questionId }
        });

        const points = Number(examQuestion?.pointsForQuestion || 0);
        const subjectName = question?.subject?.subjectName || 'Umum';

        if (isCorrect) {
          totalScore += points;
          subjectScores[subjectName] = (subjectScores[subjectName] || 0) + points;
        } else {
          subjectScores[subjectName] = subjectScores[subjectName] || 0;
        }

        await tx.userExamAnswers.create({
          data: {
            userExamId,
            questionId: ans.questionId,
            selectedAnswerId: ans.selectedAnswerId,
            isCorrect,
            metadataJson: {}
          }
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
            analysisPerSubject: subjectScores // Contoh: { "TIU": 80, "TWK": 95 }
          }
        }
      });
    });
  }

  async monitorActiveAttempts() {
    const activeAttempts = await this.prisma.userExams.findMany({
      where: { status: 'in_progress' }, //
      include: {
        user: { select: { firstName: true, email: true } },
        exam: { select: { examName: true, durationMinutes: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    return activeAttempts.map(attempt => {
      const now = new Date().getTime();
      const deadline = attempt.startTime.getTime() + (attempt.exam.durationMinutes * 60000);
      const remainingSeconds = Math.max(0, Math.floor((deadline - now) / 1000));

      return {
        ...attempt,
        remainingTime: `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`,
        isExpired: remainingSeconds <= 0
      };
    });
  }

  async createVoucher(data: any) {
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
      }
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
      include: { exam: true }
    });

    const toSubmit = expiredExams.filter(attempt => {
      const deadline = new Date(attempt.startTime.getTime() + attempt.exam.durationMinutes * 60000);
      return now > deadline;
    });

    // Proses bulk update status ke 'submitted'
    if (toSubmit.length > 0) {
      const ids = toSubmit.map(a => a.id);
      await this.prisma.userExams.updateMany({
        where: { id: { in: ids } },
        data: { 
          status: 'submitted',
          endTime: now,
          // Skor tetap dihitung berdasarkan jawaban yang sempat tersimpan[cite: 5]
        }
      });
    }
    
    return { processed: toSubmit.length };
  }

}
