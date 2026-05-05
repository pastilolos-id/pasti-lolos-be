import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // FUNGSI SPESIFIK UNTUK EXAM
  async processExamManualPayment(
    examId: number,
    userId: number,
    paymentMethod: string,
    file: Express.Multer.File,
    discountCode?: string,
  ) {
    const exam = await this.prisma.exams.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    const totalAmount = exam.price ?? new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let couponId: number | null = null;

    // 1. Logic Diskon
    if (discountCode) {
      const coupon = await this.prisma.coupons.findUnique({ where: { couponCode: discountCode } });
      const now = new Date();
      const isValid = coupon && coupon.isActive && now >= coupon.validFrom && now <= coupon.validUntil &&
                      (coupon.maxUses === null || (coupon.usesCount ?? 0) < coupon.maxUses);

      if (!isValid) throw new BadRequestException('Kupon tidak valid atau kadaluarsa');
      
      couponId = coupon.id;
      discountAmount = coupon.discountType === 'percentage' 
        ? totalAmount.mul(Number(coupon.discountValue) / 100) 
        : new Prisma.Decimal(coupon.discountValue);
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);

    // 2. Transaksi Database
    return await this.prisma.$transaction(async (tx) => {
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
            create: [{
              itemType: 'exam',
              itemId: examId,
              itemName: exam.examName,
              pricePerItem: totalAmount,
              totalPrice: grandTotal,
              courseId: 0,
              metadataJson: { examId } as any,
            }],
          },
        },
      });

      if (couponId) {
        await tx.coupons.update({ where: { id: couponId }, data: { usesCount: { increment: 1 } } });
      }

      // Upload bukti transfer ke Cloudinary
      const upload = await this.cloudinary.uploadFile(file, 'exam_payment_proofs');

      await tx.payments.create({
        data: {
          orderId: order.id,
          userId,
          amount: grandTotal,
          paymentMethod,
          transactionId: `EXTX-${Date.now()}-${userId}`,
          paymentStatus: 'pending',
          receiptUrl: upload.secure_url,
        },
      });

      return {
        message: 'Pembayaran berhasil diupload. Tunggu verifikasi admin.',
        orderId: order.id,
        grandTotal,
      };
    });
  }

  // Fungsi Approve oleh Admin[cite: 5]
  async approveManualPayment(orderId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.update({
        where: { id: orderId },
        data: { orderStatus: 'completed', paymentStatus: 'paid' },
        include: { orderItems: true }
      });

      await tx.payments.updateMany({
        where: { orderId: order.id },
        data: { paymentStatus: 'completed' }
      });

      // --- AUTO ENROLL LOGIC ---
      const examId = order.orderItems[0].itemId;
      const subExams = await tx.exams.findMany({ where: { packageId: examId } });
      const allExams = [{ id: examId }, ...subExams];

      await tx.userExams.createMany({
        data: allExams.map(e => ({
          userId: order.userId,
          examId: e.id,
          status: 'not_started',
        })),
        skipDuplicates: true,
      });

      // Kirim Notifikasi[cite: 5]
      await tx.notifications.create({
        data: {
          userId: order.userId,
          notificationType: 'payment_approved',
          title: 'Akses Ujian Terbuka!',
          message: `Pembayaran untuk ${order.orderItems[0].itemName} berhasil. Selamat belajar!`,
        }
      });

      return { message: `Order #${orderId} berhasil diverifikasi dan akses dibuka.` };
    });
  }

  async approveBulkPayments(orderIds: number[]) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Update status di tabel Orders
      await tx.orders.updateMany({
        where: { id: { in: orderIds } },
        data: { 
          orderStatus: 'completed', 
          paymentStatus: 'paid' 
        },
      });

      // 2. Update status di tabel Payments
      await tx.payments.updateMany({
        where: { orderId: { in: orderIds } },
        data: { paymentStatus: 'completed' },
      });

      return { 
        success: true, 
        message: `${orderIds.length} pembayaran berhasil disetujui sekaligus.` 
      };
    });
  }
  
}