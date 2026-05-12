import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private notificationsService: NotificationsService,
  ) {}

  // FUNGSI SPESIFIK UNTUK EXAM
  async processExamManualPayment(
    examId: number,
    userId: number,
    paymentMethod: string,
    file: Express.Multer.File,
    discountCode?: string,
  ) {
    // 1. Cari data Exam Utama
    const exam = await this.prisma.exams.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    // 2. CEK APAKAH SUDAH PUNYA AKSES (Enrollment)
    const existingEnrollment = await this.prisma.userExams.findFirst({
      where: { userId, examId },
    });
    if (existingEnrollment) {
      throw new BadRequestException('Lo sudah punya akses ke ujian ini.');
    }

    // 3. CEK APAKAH ADA ORDER YANG MASIH PENDING (Ini yang lo butuhin, Bal)
    const pendingOrder = await this.prisma.orders.findFirst({
      where: {
        userId,
        orderStatus: 'pending', // Masih nunggu verifikasi admin
        orderItems: {
          some: {
            itemId: examId,
            itemType: 'exam',
          },
        },
      },
    });

    if (pendingOrder) {
      throw new BadRequestException({
        statusCode: 400,
        message:
          'Kamu masih memiliki transaksi pending untuk ujian ini. Tunggu konfirmasi admin atau hubungi CS.',
      });
    }

    // 3. LOGIC DISKON
    const totalAmount = exam.price ?? new Prisma.Decimal(0);
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

      if (!isValid)
        throw new BadRequestException('Kupon tidak valid atau kadaluarsa');

      couponId = coupon.id;
      discountAmount =
        coupon.discountType === 'percentage'
          ? totalAmount.mul(Number(coupon.discountValue) / 100)
          : new Prisma.Decimal(coupon.discountValue);
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);

    // --- 4. UPLOAD CLOUDINARY DI LUAR TRANSAKSI (Anti P2028) ---
    if (!file) throw new BadRequestException('Bukti pembayaran wajib diunggah');
    const upload = await this.cloudinary.uploadFile(
      file,
      'exam_payment_proofs',
    );

    // 5. TRANSAKSI DATABASE (Cepat karena upload sudah selesai)
    const checkoutResult = await this.prisma.$transaction(async (tx) => {
      // A. Buat Order
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
                itemType: 'exam',
                itemId: examId,
                itemName: exam.examName,
                pricePerItem: totalAmount,
                totalPrice: grandTotal,
                courseId: 0,
                metadataJson: { examId } as Prisma.JsonObject,
              },
            ],
          },
        },
      });

      // B. Update kuota kupon
      if (couponId) {
        await tx.coupons.update({
          where: { id: couponId },
          data: { usesCount: { increment: 1 } },
        });
      }

      // C. Record Payment
      await tx.payments.create({
        data: {
          orderId: order.id,
          userId,
          amount: grandTotal,
          paymentMethod,
          transactionId: `EXTX-${Date.now()}-${userId}`,
          paymentStatus: 'pending',
          receiptUrl: upload.secure_url, // URL dari upload di atas
        },
      });

      return {
        success: true,
        message: 'Pembayaran berhasil diupload. Tunggu verifikasi admin.',
        orderId: order.id,
        grandTotal,
      };
    });

    await this.notificationsService.notifyAdminsPendingPayment({
      orderId: checkoutResult.orderId,
      buyerUserId: userId,
      itemName: exam.examName,
      itemType: 'exam',
      grandTotal: checkoutResult.grandTotal,
    });

    await this.notificationsService.notifyByEvent({
      event: 'payment_pending_student',
      userId: userId,
      itemName: exam.examName,
    });

    return checkoutResult;
  }

  // Fungsi Approve oleh Admin[cite: 5]
  // src/payments/payments.service.ts

  // src/payments/payments.service.ts

  async approveManualPayment(orderId: number) {
    // Ganti jadi number
    const txResult = await this.prisma.$transaction(async (tx) => {
      // 1. Ambil detail order
      const order = await tx.orders.findUnique({
        where: { id: orderId }, // Sekarang sudah match (number)
        include: { orderItems: true },
      });

      if (!order) throw new NotFoundException('Order tidak ditemukan');

      if (order.orderStatus === 'completed') {
        throw new BadRequestException('Order ini sudah diproses sebelumnya.');
      }

      // 2. Update status Order & Payment
      // PENTING: Tambahkan include orderItems di sini juga agar variabel 'updatedOrder' punya datanya
      const updatedOrder = await tx.orders.update({
        where: { id: orderId },
        data: {
          orderStatus: 'completed',
          paymentStatus: 'paid',
        },
        include: { orderItems: true }, // Tambahkan ini biar error Property 'orderItems' does not exist hilang
      });

      // 3. Update status di tabel Payments
      await tx.payments.updateMany({
        where: { orderId: order.id },
        data: { paymentStatus: 'completed' },
      });

      // 4. --- AUTO ENROLL LOGIC ---
      // Pakai updatedOrder yang sudah include orderItems
      const parentExamIds = updatedOrder.orderItems
        .filter((item) => item.itemType === 'exam')
        .map((item) => item.itemId);

      if (parentExamIds.length > 0) {
        const subExams = await tx.exams.findMany({
          where: { packageId: { in: parentExamIds } },
          select: { id: true },
        });

        const childExamIds = subExams.map((se) => se.id);
        const allExamIdsToEnroll = [
          ...new Set([...parentExamIds, ...childExamIds]),
        ];

        await tx.userExams.createMany({
          data: allExamIdsToEnroll.map((id) => ({
            userId: updatedOrder.userId,
            examId: id,
            status: 'not_started',
          })),
          skipDuplicates: true,
        });
      }

      return {
        message: `Order #${orderId} sukses, status 'completed', dan akses dibuka.`,
        userId: updatedOrder.userId,
        itemName: updatedOrder.orderItems[0]?.itemName ?? 'pesanan',
      };
    });

    await this.notificationsService.notifyByEvent({
      event: 'payment_approved_student',
      userId: txResult.userId,
      itemName: txResult.itemName,
    });

    return {
      message: txResult.message,
    };
  }

  async approveBulkPayments(orderIds: number[]) {
    const approvedOrders = await this.prisma.$transaction(async (tx) => {
      const orders = await tx.orders.findMany({
        where: { id: { in: orderIds } },
        include: { orderItems: true },
      });

      const examOrderItems = orders.flatMap((order) =>
        order.orderItems
          .filter((item) => item.itemType === 'exam')
          .map((item) => ({ userId: order.userId, examId: item.itemId })),
      );

      if (examOrderItems.length > 0) {
        const parentExamIds = [...new Set(examOrderItems.map((i) => i.examId))];
        const subExams = await tx.exams.findMany({
          where: { packageId: { in: parentExamIds } },
          select: { id: true, packageId: true },
        });

        const enrollData = examOrderItems.flatMap((item) => {
          const childIds = subExams
            .filter((s) => s.packageId === item.examId)
            .map((s) => s.id);
          return [item.examId, ...childIds].map((examId) => ({
            userId: item.userId,
            examId,
            status: 'not_started' as const,
          }));
        });

        await tx.userExams.createMany({
          data: enrollData,
          skipDuplicates: true,
        });
      }

      // 1. Update status di tabel Orders
      await tx.orders.updateMany({
        where: { id: { in: orderIds } },
        data: {
          orderStatus: 'completed',
          paymentStatus: 'paid',
        },
      });

      // 2. Update status di tabel Payments
      await tx.payments.updateMany({
        where: { orderId: { in: orderIds } },
        data: { paymentStatus: 'completed' },
      });

      return orders;
    });

    await Promise.all(
      approvedOrders.map((order) =>
        this.notificationsService.notifyByEvent({
          event: 'bulk_payment_approved_student',
          userId: order.userId,
          itemName: order.orderItems[0]?.itemName ?? 'pesanan',
        }),
      ),
    );

    return {
      success: true,
      message: `${orderIds.length} pembayaran berhasil disetujui sekaligus.`,
    };
  }

  async validateVoucher(code: string, examId: number) {
    const now = new Date();

    const coupon = await this.prisma.coupons.findUnique({
      where: { couponCode: code.toUpperCase() },
    });

    const exam = await this.prisma.exams.findUnique({
      where: { id: examId },
    });

    // --- VALIDASI DENGAN FORMAT CUSTOM ---

    if (!exam) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Validation failed for one or more fields',
        errors: {
          examId: ['Ujian tidak ditemukan.'],
        },
      });
    }

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed for one or more fields',
        errors: {
          couponCode: ['Voucher tidak valid atau sudah tidak aktif.'],
        },
      });
    }

    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed for one or more fields',
        errors: {
          couponCode: ['Masa berlaku voucher telah habis.'],
        },
      });
    }

    if (coupon.maxUses && (coupon.usesCount ?? 0) >= coupon.maxUses) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed for one or more fields',
        errors: {
          couponCode: ['Kuota pemakaian voucher sudah penuh.'],
        },
      });
    }

    // --- KALKULASI ---
    const originalPrice = Number(exam.price);
    let discountAmount = 0;

    if (coupon.discountType === 'percentage') {
      // Hitung berdasarkan persen
      discountAmount = (originalPrice * Number(coupon.discountValue)) / 100;
    } else {
      // Hitung berdasarkan nominal tetap
      discountAmount = Number(coupon.discountValue);
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return {
      message: 'Voucher berhasil dipasang',
      summary: {
        examName: exam.examName,
        originalPrice: originalPrice,
        discount: discountAmount,
        totalPay: finalPrice,
        couponUsed: coupon.couponCode,
      },
    };
  }
}
