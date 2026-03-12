// src/exams/exams.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
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

  // Get Exam Lengkap (Exams -> ExamQuestions -> Questions -> Answers)
  async findOneExam(id: number) {
    const exam = await this.prisma.exams.findUnique({
      where: { id },
      include: {
        examQuestions: {
          // CamelCase
          orderBy: {
            orderInExam: 'asc', // CamelCase
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
  async createQuestion(
    data: CreateQuestionDto,
    userId: number,
  ): Promise<Questions> {
    if (!userId) {
      throw new BadRequestException(
        'User ID wajib ada untuk mencatat pembuat soal.',
      );
    }

    return this.prisma.questions.create({
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

        // Relasi 3: Topic (Opsional) - Pake format connect biar TS aman
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
        } as Prisma.InputJsonValue,
      },
    });
  }

  // --- MENGHUBUNGKAN SOAL KE UJIAN (ExamQuestions) ---
  async addQuestionToExam(data: AddQuestionToExamDto): Promise<ExamQuestions> {
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
        metadataJson: { source: 'admin_dashboard' } as Prisma.InputJsonValue,
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
        questionId: questionId,
      },
    });

    if (existingAnswer) {
      return this.prisma.userExamAnswers.update({
        where: { id: existingAnswer.id },
        data: {
          selectedAnswerId: answerId,
          updatedAt: new Date(),
        },
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
      select: { id: true, examId: true },
    });

    if (!userExam) {
      throw new NotFoundException(
        `Sesi ujian ID ${userExamId} tidak ditemukan`,
      );
    }

    const userAnswers = await this.prisma.userExamAnswers.findMany({
      where: { userExamId: userExamId },
      include: {
        selectedAnswer: {
          select: { isCorrect: true },
        },
        question: {
          include: {
            examQuestions: {
              where: { examId: userExam.examId },
            },
          },
        },
      },
    });

    if (!userAnswers.length) {
      throw new NotFoundException(
        'Tidak ada jawaban yang ditemukan untuk sesi ini',
      );
    }

    const totalScore = userAnswers.reduce((acc, curr) => {
      const isCorrect = curr.selectedAnswer?.isCorrect || false;

      if (isCorrect) {
        const point = Number(
          curr.question.examQuestions[0]?.pointsForQuestion || 0,
        );
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
        status: 'submitted',
      },
    });
  }

  // checkout exam
  async getExamCheckoutPreview(examId: number) {
    const exam = await this.prisma.exams.findUnique({
      where: { id: examId },
      include: { subject: true },
    });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    return {
      examId: exam.id,
      title: exam.examName,
      price: exam.price,
      subjectName: exam.subject?.subjectName,
    };
  }

  async processExamCheckout(
    examId: number,
    userId: number,
    paymentMethod: string,
    file: Express.Multer.File,
  ) {
    const exam = await this.prisma.exams.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    return await this.prisma.$transaction(async (tx) => {
      // 1. Buat Order (Gunakan grandTotal & orderStatus sesuai schema)
      const order = await tx.orders.create({
        data: {
          userId: userId,
          totalAmount: exam.price ?? 0,
          grandTotal: exam.price ?? 0,
          orderStatus: 'created', // Sesuai default flow lo
          paymentMethod: paymentMethod,
          orderItems: {
            create: [
              {
                // Karena ini Ujian, courseId dikosongkan (sesuai schema yang optional)
                itemType: 'exam',
                itemId: exam.id,
                itemName: exam.examName,
                pricePerItem: exam.price ?? 0,
                totalPrice: exam.price ?? 0,
                // Jika schema lo maksa courseId, lo bisa pake metadataJson untuk simpan examId
                metadataJson: JSON.stringify({
                  examId: exam.id,
                  category: 'exam_access',
                }),
                courseId: 0,
              },
            ],
          },
        },
      });

      // 2. Upload Bukti Transfer ke Cloudinary
      // const upload = await this.cloudinary.uploadFile(file, 'exam_payments');
      const upload = await this.cloudinary.uploadFile(
        file,
        'exam_payment_proofs',
      );

      // 3. Buat Payment (Gunakan receiptUrl sesuai field di schema)
      await tx.payments.create({
        data: {
          orderId: order.id,
          userId: userId,
          amount: exam.price ?? 0,
          paymentMethod: paymentMethod,
          transactionId: `EXAM-${Date.now()}-${userId}`,
          paymentStatus: 'pending',
          receiptUrl: upload.secure_url,
          metadataJson: {
            cloudinary_id: upload.public_id,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        message:
          'Pembayaran ujian berhasil diupload. Silahkan tunggu verifikasi admin.',
        orderId: order.id,
      };
    });
  }
}
