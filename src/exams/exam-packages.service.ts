import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateExamPackageDto,
  UpdateExamPackageDto,
} from './dto/create-exam-package.dto';

@Injectable()
export class ExamPackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createExamPackage(
    data: CreateExamPackageDto,
    userId: number,
  ): Promise<{ message: string }> {
    if (!userId) {
      throw new BadRequestException('User ID tidak valid');
    }

    await this.prisma.examPackages.create({
      data: {
        examName: data.examName,
        description: data.description ?? null,
        durationMinutes: parseInt(data.durationMinutes.toString(), 10),
        examType: data.examType,
        status: data.status ?? 'draft',
        subjectId: parseInt(data.subjectId.toString(), 10),
        createdByUserId: userId,
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        price: data.price
          ? new Prisma.Decimal(data.price)
          : new Prisma.Decimal(0),
        metadataJson: {
          source: 'admin_panel',
          created_at_iso: new Date().toISOString(),
          ...((data.metadataJson as object) || {}),
        } as Prisma.InputJsonValue,
      },
    });

    return { message: 'Berhasil membuat exam package' };
  }

  async findOneExamPackage(id: number) {
    const pkg = await this.prisma.examPackages.findUnique({
      where: { id },
      include: {
        subject: { select: { subjectName: true } },
        exams: {
          where: { status: { not: 'archived' } },
          select: {
            id: true,
            examName: true,
            status: true,
            durationMinutes: true,
            passingScore: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!pkg) throw new NotFoundException('Exam package tidak ditemukan');
    return {
      ...pkg,
      price: Number(pkg.price),
      subExams: pkg.exams,
    };
  }

  async findExamsByPackageId(packageId: number) {
    const pkg = await this.prisma.examPackages.findUnique({
      where: { id: packageId },
    });
    if (!pkg) throw new NotFoundException('Exam package tidak ditemukan');

    return this.prisma.exams.findMany({
      where: { examPackageId: packageId, status: { not: 'archived' } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateExamPackage(
    id: number,
    userId: number,
    data: UpdateExamPackageDto,
  ) {
    const pkg = await this.prisma.examPackages.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Exam package tidak ditemukan');

    return this.prisma.examPackages.update({
      where: { id },
      data: {
        examName: data.examName,
        description: data.description,
        durationMinutes: data.durationMinutes
          ? parseInt(data.durationMinutes.toString(), 10)
          : undefined,
        examType: data.examType,
        status: data.status,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        price: data.price ? new Prisma.Decimal(data.price) : undefined,
        metadataJson: {
          ...((pkg.metadataJson as object) || {}),
          lastUpdatedBy: userId,
          updatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  async softDeleteExamPackage(id: number) {
    const pkg = await this.prisma.examPackages.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Exam package tidak ditemukan');

    return this.prisma.examPackages.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async findAllExamPackagesAdmin(
    subjectName?: string,
    page = 1,
    limit = 10,
    status?: string,
  ) {
    const safeLimit = [10, 30, 50].includes(Number(limit)) ? Number(limit) : 10;
    const skip = (Number(page) - 1) * safeLimit;

    const where: Prisma.ExamPackagesWhereInput = {
      status: status ? status : { not: 'archived' },
      ...(subjectName
        ? {
            subject: {
              subjectName: { equals: subjectName, mode: 'insensitive' },
            },
          }
        : {}),
    };

    const [raw, total] = await Promise.all([
      this.prisma.examPackages.findMany({
        where,
        take: safeLimit,
        skip,
        select: {
          id: true,
          examName: true,
          description: true,
          examType: true,
          price: true,
          status: true,
          durationMinutes: true,
          totalQuestions: true,
          subject: { select: { subjectName: true } },
          exams: {
            select: { _count: { select: { examQuestions: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.examPackages.count({ where }),
    ]);

    const data = raw.map((pkg) => {
      const jumlahSoal = pkg.exams.reduce(
        (sum, e) => sum + e._count.examQuestions,
        0,
      );
      return {
        id: pkg.id,
        examName: pkg.examName,
        description: pkg.description,
        examType: pkg.examType,
        status: pkg.status,
        durationMinutes: pkg.durationMinutes,
        totalQuestions: jumlahSoal || pkg.totalQuestions || 0,
        subject: pkg.subject,
        price: Number(pkg.price),
        jumlahSoal: jumlahSoal || pkg.totalQuestions || 0,
      };
    });

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

  async findAllPublished(subjectName?: string, page = 1, limit = 10) {
    if (!subjectName) {
      throw new BadRequestException('Kategori (BUMN/CPNS) harus dipilih!');
    }

    const safeLimit = [10, 30, 50].includes(Number(limit)) ? Number(limit) : 10;
    const skip = (Number(page) - 1) * safeLimit;

    const where: Prisma.ExamPackagesWhereInput = {
      status: 'published',
      subject: {
        subjectName: { equals: subjectName, mode: 'insensitive' },
      },
    };

    const [rawPackages, total] = await Promise.all([
      this.prisma.examPackages.findMany({
        where,
        take: safeLimit,
        skip,
        select: {
          id: true,
          examName: true,
          description: true,
          examType: true,
          price: true,
          durationMinutes: true,
          totalQuestions: true,
          subject: { select: { subjectName: true } },
          exams: {
            select: { _count: { select: { examQuestions: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.examPackages.count({ where }),
    ]);

    const data = rawPackages.map((pkg) => {
      const jumlahSoal = pkg.exams.reduce(
        (sum, e) => sum + e._count.examQuestions,
        0,
      );
      return {
        id: pkg.id,
        examName: pkg.examName,
        description: pkg.description,
        examType: pkg.examType,
        durationMinutes: pkg.durationMinutes,
        totalQuestions: jumlahSoal || pkg.totalQuestions || 0,
        subject: pkg.subject,
        price: Number(pkg.price),
        jumlahSoal: jumlahSoal || pkg.totalQuestions || 0,
      };
    });

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

  async getPackageDetail(examPackageId: number, userId: number) {
    const uId = Number(userId);
    const pId = Number(examPackageId);

    const parentPackage = await this.prisma.examPackages.findUnique({
      where: { id: pId },
      include: { subject: true },
    });

    if (!parentPackage) {
      throw new NotFoundException('Paket ujian tidak ditemukan');
    }

    const packageAccess = await this.prisma.userExamPackages.findFirst({
      where: { userId: uId, examPackageId: pId },
    });

    const allUserAttempts = await this.prisma.userExams.findMany({
      where: { userId: uId },
      select: { id: true, examId: true, status: true, score: true },
    });

    const pendingOrder = await this.prisma.orders.findFirst({
      where: {
        userId: uId,
        orderStatus: 'pending',
        orderItems: { some: { itemId: pId, itemType: 'exam' } },
      },
    });

    const children = await this.prisma.exams.findMany({
      where: { examPackageId: pId, status: 'published' },
      include: { _count: { select: { examQuestions: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const isPurchased = !!packageAccess;
    const purchaseStatus = isPurchased
      ? 'completed'
      : pendingOrder
        ? 'pending'
        : 'available';

    let totalQuestionsCount = 0;
    let totalScoreAccumulator = 0;

    const subExamsResult = children.map((child) => {
      const attempt = allUserAttempts.find(
        (a) => Number(a.examId) === Number(child.id),
      );
      const scoreNum = attempt?.score ? Number(attempt.score) : 0;

      totalQuestionsCount += child._count?.examQuestions || 0;
      totalScoreAccumulator += scoreNum;

      return {
        id: child.id,
        name: child.examName,
        totalSoal: child._count?.examQuestions || 0,
        passingGrade: child.passingScore,
        duration: child.durationMinutes,
        userExamId: attempt?.id || null,
        status: attempt?.status || 'not_started',
        score: scoreNum,
      };
    });

    return {
      id: parentPackage.id,
      examName: parentPackage.examName,
      description: parentPackage.description,
      price: Number(parentPackage.price) || 0,
      isPurchased,
      purchaseStatus,
      pendingOrderId: pendingOrder?.id || null,
      totalDuration: parentPackage.durationMinutes,
      totalQuestions: totalQuestionsCount,
      totalPassingScore: totalScoreAccumulator,
      subject: parentPackage.subject?.subjectName,
      subExams: subExamsResult,
    };
  }

  async getExamCheckoutPreview(examPackageId: number) {
    const pkg = await this.prisma.examPackages.findUnique({
      where: { id: examPackageId },
      include: {
        subject: true,
        exams: {
          where: { status: 'published' },
          select: { examName: true },
        },
      },
    });

    if (!pkg) throw new NotFoundException('Paket ujian tidak ditemukan');

    return {
      examId: pkg.id,
      examName: pkg.examName,
      category: pkg.subject?.subjectName,
      price: pkg.price,
      includedSubExams: pkg.exams.map((c) => c.examName),
      adminFee: 0,
      totalPayment: pkg.price,
    };
  }

  async enrollUserInPackage(
    tx: Prisma.TransactionClient,
    userId: number,
    examPackageId: number,
  ) {
    const childExams = await tx.exams.findMany({
      where: { examPackageId },
      select: { id: true },
    });

    await tx.userExamPackages.createMany({
      data: [{ userId, examPackageId, status: 'not_started' }],
      skipDuplicates: true,
    });

    if (childExams.length > 0) {
      await tx.userExams.createMany({
        data: childExams.map((e) => ({
          userId,
          examId: e.id,
          status: 'not_started',
        })),
        skipDuplicates: true,
      });
    }
  }

  async processExamCheckout(
    examPackageId: number,
    userId: number,
    paymentMethod: string,
    file: Express.Multer.File,
    discountCode?: string,
  ) {
    const pkg = await this.prisma.examPackages.findUnique({
      where: { id: examPackageId },
    });
    if (!pkg) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Validation failed for one or more fields',
        errors: { examId: ['Ujian tidak ditemukan'] },
      });
    }

    const existingEnrollment = await this.prisma.userExamPackages.findFirst({
      where: { userId, examPackageId },
    });

    if (existingEnrollment) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        errors: {
          examId: ['Lo sudah terdaftar di ujian ini, nggak perlu beli lagi.'],
        },
      });
    }

    const totalAmount = pkg.price ?? new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let couponId: number | null = null;

    if (discountCode) {
      const coupon = await this.prisma.coupons.findUnique({
        where: { couponCode: discountCode.toUpperCase() },
      });

      const now = new Date();
      const isValidBasic =
        coupon &&
        coupon.isActive &&
        now >= coupon.validFrom &&
        now <= coupon.validUntil &&
        (coupon.maxUses === null || (coupon.usesCount ?? 0) < coupon.maxUses);

      if (!isValidBasic) {
        throw new BadRequestException('Kupon tidak valid atau kadaluarsa');
      }

      if (coupon.appliesToEntityType && coupon.appliesToEntityType !== 'exam') {
        throw new BadRequestException('Kupon ini hanya berlaku untuk ujian');
      }

      couponId = coupon.id;
      discountAmount =
        coupon.discountType === 'percentage'
          ? totalAmount.mul(Number(coupon.discountValue) / 100)
          : new Prisma.Decimal(coupon.discountValue);
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);
    const isFree = grandTotal.equals(0);

    let receiptUrl: string | null = null;
    if (!isFree) {
      if (!file) {
        throw new BadRequestException('Bukti pembayaran wajib diunggah');
      }
      const upload = await this.cloudinary.uploadFile(
        file,
        'exam_payment_proofs',
      );
      receiptUrl = upload.secure_url;
    }

    const checkout = await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.create({
        data: {
          userId,
          totalAmount,
          discountAmount,
          grandTotal,
          couponCode: discountCode || null,
          orderStatus: isFree ? 'completed' : 'pending',
          paymentStatus: isFree ? 'paid' : 'pending',
          paymentMethod,
          orderItems: {
            create: [
              {
                itemType: 'exam',
                itemId: examPackageId,
                itemName: pkg.examName,
                pricePerItem: totalAmount,
                totalPrice: grandTotal,
                courseId: 0,
                metadataJson: { examId: examPackageId } as Prisma.JsonObject,
              },
            ],
          },
        },
      });

      if (isFree) {
        await this.enrollUserInPackage(tx, userId, examPackageId);
      }

      if (couponId) {
        await tx.coupons.update({
          where: { id: couponId },
          data: { usesCount: { increment: 1 } },
        });
      }

      if (!isFree && receiptUrl) {
        await tx.payments.create({
          data: {
            orderId: order.id,
            userId,
            amount: grandTotal,
            paymentMethod,
            transactionId: `EXTX-${Date.now()}-${userId}`,
            paymentStatus: 'pending',
            receiptUrl,
          },
        });
      }

      return {
        success: true,
        message: isFree
          ? 'Paket berhasil diaktifkan!'
          : 'Pembayaran berhasil diupload. Tunggu verifikasi admin.',
        orderId: order.id,
        grandTotal,
      };
    });

    if (isFree) {
      await this.notificationsService.notifyByEvent({
        event: 'free_exam_activated_student',
        userId,
        itemName: pkg.examName,
      });
      return checkout;
    }

    await this.notificationsService.notifyAdminsPendingPayment({
      orderId: checkout.orderId,
      buyerUserId: userId,
      itemName: pkg.examName,
      itemType: 'exam',
      grandTotal: checkout.grandTotal,
    });

    await this.notificationsService.notifyByEvent({
      event: 'payment_pending_student',
      userId,
      itemName: pkg.examName,
    });

    return checkout;
  }

  async getScoreByPackage(examPackageId: number, userId: number) {
    const subExams = await this.prisma.exams.findMany({
      where: { examPackageId },
      select: { id: true, examName: true, passingScore: true },
    });

    if (subExams.length === 0) {
      throw new NotFoundException(
        'Paket ujian tidak ditemukan atau tidak memiliki sub-ujian.',
      );
    }

    const subExamIds = subExams.map((e) => e.id);

    const results = await this.prisma.userExams.findMany({
      where: {
        userId,
        examId: { in: subExamIds },
        status: 'submitted',
      },
      include: {
        exam: { select: { examName: true, passingScore: true } },
      },
    });

    let totalFinalScore = 0;
    let allPassed = true;

    const breakdown = results.map((res) => {
      const metadata = (res.metadataJson ?? {}) as {
        summary?: {
          correctAnswers?: number;
          wrongAnswers?: number;
          unanswered?: number;
        };
      };
      const summary = metadata.summary ?? {};
      const score = Number(res.score || 0);
      const passing = Number(res.exam.passingScore || 0);

      totalFinalScore += score;
      const isSubPassed = score >= passing;
      if (!isSubPassed) allPassed = false;

      return {
        examName: res.exam.examName,
        score,
        passingScore: passing,
        status: isSubPassed ? 'passed' : 'failed',
        stats: {
          correct: summary.correctAnswers || 0,
          wrong: summary.wrongAnswers || 0,
          empty: summary.unanswered || 0,
        },
      };
    });

    return {
      success: true,
      message: 'Data skor paket berhasil diambil',
      data: {
        packageId: examPackageId,
        totalScore: totalFinalScore,
        isPackagePassed: allPassed,
        completedExams: results.length,
        totalExamsInPackage: subExams.length,
        details: breakdown,
      },
    };
  }
}
