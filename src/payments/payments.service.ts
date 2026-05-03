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
    // 1. Cari data Exam
    const exam = await this.prisma.exams.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan');

    const totalAmount = exam.price ?? new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let couponId: number | null = null;

    // 2. LOGIC DISKON SPESIFIK EXAM
    if (discountCode) {
      const coupon = await this.prisma.coupons.findUnique({
        where: { couponCode: discountCode },
      });
      const now = new Date();

      const isValidBasic = coupon && coupon.isActive && now >= coupon.validFrom && now <= coupon.validUntil &&
                           (coupon.maxUses === null || (coupon.usesCount ?? 0) < coupon.maxUses);

      if (!isValidBasic) throw new BadRequestException('Kupon tidak valid atau kadaluarsa');

      if (coupon.appliesToEntityType && coupon.appliesToEntityType !== 'exam') {
        throw new BadRequestException('Kupon ini hanya berlaku untuk ujian.');
      }

      if (coupon.appliesToEntityIds) {
        const allowedIds = coupon.appliesToEntityIds as number[];
        if (!allowedIds.includes(examId)) throw new BadRequestException('Kupon tidak berlaku untuk paket ujian ini.');
      }

      couponId = coupon.id;
      discountAmount = coupon.discountType === 'percentage' 
        ? totalAmount.mul(Number(coupon.discountValue) / 100) 
        : new Prisma.Decimal(coupon.discountValue);
    }

    const grandTotal = Prisma.Decimal.max(totalAmount.sub(discountAmount), 0);

    // 3. EKSEKUSI TRANSAKSI
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
        message: 'Pembayaran ujian berhasil diupload. Tunggu verifikasi admin.',
        orderId: order.id,
        grandTotal,
      };
    });
  }

  // FUNGSI APPROVE (Bisa dipakai keduanya)
  async approveManualPayment(orderId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.update({
        where: { id: orderId },
        data: { orderStatus: 'completed', paymentStatus: 'paid' },
        include: { orderItems: true } // Ambil info barang yang dibeli
      });

      await tx.payments.updateMany({
        where: { orderId: order.id },
        data: { paymentStatus: 'completed' }
      });

      // TRIGGER NOTIFIKASI
      const itemName = order.orderItems[0]?.itemName || 'Paket Ujian';
      await tx.notifications.create({
        data: {
          userId: order.userId,
          notificationType: 'payment_approved',
          title: 'Pembayaran Diterima!',
          message: `Hore! Pembayaran untuk ${itemName} sudah diverifikasi. Silakan cek menu TryOut Saya untuk memulai.`,
          isRead: false,
          metadataJson: { orderId: order.id }
        }
      });

      return { message: `Order #${orderId} berhasil diverifikasi.` };
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