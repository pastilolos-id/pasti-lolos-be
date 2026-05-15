import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';
import { CreateBankSoalDto } from './dto/create-bank-soal.dto';
import { UpdateBankSoalDto } from './dto/update-bank-soal.dto';

@Injectable()
export class BankSoalService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── ADMIN: CRUD ───

  async createBankSoal(
    dto: CreateBankSoalDto,
    userId: number,
    pdfFile?: Express.Multer.File,
  ) {
    const created = await this.prisma.questionBanks.create({
      data: {
        bankName: dto.bankName,
        description: dto.description,
        subjectId: +dto.subjectId,
        // topicId: dto.topicId ? +dto.topicId : undefined,
        price: dto.price ? new Prisma.Decimal(dto.price) : undefined,
        createdByUserId: userId,
        status: 'draft',
      },
    });

    if (pdfFile) {
      return this.uploadPdf(created.id, pdfFile);
    }

    return created;
  }

  async updateBankSoal(bankId: number, dto: UpdateBankSoalDto) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');

    return this.prisma.questionBanks.update({
      where: { id: bankId },
      data: {
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.subjectId !== undefined && { subjectId: +dto.subjectId }),
        ...(dto.topicId !== undefined && { topicId: +dto.topicId }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
      },
    });
  }

  async uploadPdf(bankId: number, file: Express.Multer.File) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');

    const upload = await this.cloudinary.uploadFile(file, 'bank_soal_pdfs');

    return this.prisma.questionBanks.update({
      where: { id: bankId },
      data: {
        pdfUrl: upload.secure_url,
        pdfName: file.originalname,
      },
    });
  }

  async deletePdf(bankId: number) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');
    if (!bank.pdfUrl)
      throw new BadRequestException('Bank soal belum punya PDF');

    return this.prisma.questionBanks.update({
      where: { id: bankId },
      data: { pdfUrl: null, pdfName: null },
    });
  }

  async publishBankSoal(bankId: number) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');

    return this.prisma.questionBanks.update({
      where: { id: bankId },
      data: { status: 'published' },
    });
  }

  async deleteBankSoal(bankId: number) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');

    return this.prisma.questionBanks.delete({ where: { id: bankId } });
  }

  async getAllBankSoal(status?: string) {
    const where: Prisma.QuestionBanksWhereInput = {};
    if (status) where.status = status;

    return this.prisma.questionBanks.findMany({
      where,
      include: {
        subject: { select: { id: true, subjectName: true } },
        topic: { select: { id: true, topicName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── USER: BROWSE ───

  async getAll() {
    return this.prisma.questionBanks.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        bankName: true,
        description: true,
        price: true,
        subject: { select: { id: true, subjectName: true } },
        topic: { select: { id: true, topicName: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDetail(bankId: number, userId?: number) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
      include: {
        subject: { select: { id: true, subjectName: true } },
        topic: { select: { id: true, topicName: true } },
      },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');

    let hasAccess = false;
    if (userId) {
      hasAccess = await this.checkAccess(userId, bankId);
    }

    return {
      id: bank.id,
      bankName: bank.bankName,
      description: bank.description,
      price: bank.price,
      status: bank.status,
      pdfName: bank.pdfName,
      subject: bank.subject,
      topic: bank.topic,
      hasAccess,
    };
  }

  // ─── USER: CHECKOUT ───

  async checkoutBankSoal(
    bankId: number,
    paymentMethod: string,
    file: Express.Multer.File,
    userId: number,
    discountCode?: string,
  ) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');
    if (bank.status !== 'published') {
      throw new BadRequestException('Bank soal belum dipublikasikan');
    }

    if (await this.checkAccess(userId, bankId)) {
      throw new BadRequestException('Kamu sudah punya akses ke bank soal ini.');
    }

    const pendingOrder = await this.prisma.orders.findFirst({
      where: {
        userId,
        orderStatus: 'pending',
        orderItems: {
          some: { itemId: bankId, itemType: 'question_bank' },
        },
      },
    });
    if (pendingOrder) {
      throw new BadRequestException(
        'Kamu masih memiliki transaksi pending untuk bank soal ini. Tunggu konfirmasi admin.',
      );
    }

    const totalAmount = bank.price ?? new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let couponId: number | null = null;

    if (discountCode) {
      const coupon = await this.prisma.coupons.findUnique({
        where: { couponCode: discountCode },
      });
      const now = new Date();
      const isValid =
        coupon &&
        coupon.isActive &&
        now >= coupon.validFrom &&
        now <= coupon.validUntil &&
        (coupon.maxUses === null || (coupon.usesCount ?? 0) < coupon.maxUses);

      if (!isValid) {
        throw new BadRequestException('Kupon tidak valid atau kadaluarsa');
      }

      couponId = coupon.id;
      discountAmount =
        coupon.discountType === 'percentage'
          ? totalAmount.mul(Number(coupon.discountValue) / 100)
          : new Prisma.Decimal(coupon.discountValue);
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);

    const upload = await this.cloudinary.uploadFile(
      file,
      'bank_soal_payment_proofs',
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.create({
        data: {
          userId,
          totalAmount,
          discountAmount,
          grandTotal,
          couponCode: discountCode || null,
          orderStatus: 'pending',
          paymentStatus: 'pending',
          paymentMethod,
          orderItems: {
            create: [
              {
                itemType: 'question_bank',
                itemId: bankId,
                itemName: bank.bankName,
                pricePerItem: totalAmount,
                totalPrice: grandTotal,
                courseId: 0,
                metadataJson: { bankId } as Prisma.JsonObject,
              },
            ],
          },
        },
      });

      if (couponId) {
        await tx.coupons.update({
          where: { id: couponId },
          data: { usesCount: { increment: 1 } },
        });
      }

      await tx.payments.create({
        data: {
          orderId: order.id,
          userId,
          amount: grandTotal,
          paymentMethod,
          transactionId: `BSTX-${Date.now()}-${userId}`,
          paymentStatus: 'pending',
          receiptUrl: upload.secure_url,
        },
      });

      return { orderId: order.id, grandTotal };
    });

    await this.notificationsService.notifyAdminsPendingPayment({
      orderId: result.orderId,
      buyerUserId: userId,
      itemName: bank.bankName,
      itemType: 'question_bank',
      grandTotal: result.grandTotal,
    });

    await this.notificationsService.notifyByEvent({
      event: 'payment_pending_student',
      userId,
      itemName: bank.bankName,
    });

    return {
      success: true,
      message: 'Pembayaran berhasil diupload. Tunggu verifikasi admin.',
      orderId: result.orderId,
      grandTotal: result.grandTotal,
    };
  }

  // ─── USER: VIEW PDF (hanya lihat, tidak download) ───

  async viewPdf(bankId: number, userId: number) {
    const bank = await this.prisma.questionBanks.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Bank soal tidak ditemukan');
    if (!bank.pdfUrl) {
      throw new NotFoundException('PDF belum tersedia untuk bank soal ini');
    }

    if (!(await this.checkAccess(userId, bankId))) {
      throw new ForbiddenException(
        'Kamu belum memiliki akses. Silakan beli terlebih dahulu.',
      );
    }

    return {
      pdfUrl: bank.pdfUrl,
      pdfName: bank.pdfName,
      canDownload: false,
    };
  }

  // ─── USER: MY PURCHASES ───

  async getMyPurchases(userId: number) {
    const orders = await this.prisma.orders.findMany({
      where: {
        userId,
        orderItems: { some: { itemType: 'question_bank' } },
      },
      include: {
        orderItems: {
          where: { itemType: 'question_bank' },
        },
        payments: {
          select: {
            paymentStatus: true,
            receiptUrl: true,
            paymentDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bankIds = [
      ...new Set(orders.flatMap((o) => o.orderItems.map((i) => i.itemId))),
    ];

    const banks =
      bankIds.length > 0
        ? await this.prisma.questionBanks.findMany({
            where: { id: { in: bankIds } },
            select: { id: true, bankName: true, pdfName: true },
          })
        : [];

    const bankMap = new Map(banks.map((b) => [b.id, b]));

    return orders.map((order) => ({
      orderId: order.id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt,
      items: order.orderItems.map((item) => {
        const bank = bankMap.get(item.itemId);
        return {
          bankId: item.itemId,
          bankName: bank?.bankName ?? item.itemName,
          pdfName: bank?.pdfName,
        };
      }),
      payment: order.payments[0] ?? null,
    }));
  }

  // ─── HELPERS ───

  private async checkAccess(userId: number, bankId: number): Promise<boolean> {
    const paidItem = await this.prisma.orderItems.findFirst({
      where: {
        itemType: 'question_bank',
        itemId: bankId,
        order: {
          userId,
          paymentStatus: 'paid',
        },
      },
      select: { id: true },
    });
    return !!paidItem;
  }
}
