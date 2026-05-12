// src/admin/admin.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from './dto/verify-payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getPendingPayments() {
    return this.prisma.payments.findMany({
      where: { paymentStatus: 'pending' },
      include: {
        order: {
          include: {
            user: { select: { id: true, username: true, email: true } },
            orderItems: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Gunakan createdAt dari tabel Payment
    });
  }

  // Action: Terima atau Tolak Pembayaran
  async verifyPayment(
    paymentId: number,
    status: PaymentStatus,
    rejectionReason: string | undefined,
  ) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
      include: { order: { select: { userId: true } } },
    });

    if (!payment) {
      throw new NotFoundException(
        `Pembayaran dengan ID ${paymentId} tidak ditemukan`,
      );
    }

    if (payment.paymentStatus !== 'pending') {
      throw new BadRequestException(
        `Pembayaran ini sudah diproses sebelumnya dengan status: ${payment.paymentStatus}`,
      );
    }

    if (status === PaymentStatus.COMPLETED) {
      const result = await this.paymentsService.approveManualPayment(
        payment.orderId,
      );
      return {
        success: true,
        message: result.message,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      const paymentUpdateData: { paymentStatus: string; notes?: string } = {
        paymentStatus: status,
      };

      if (status === PaymentStatus.FAILED) {
        paymentUpdateData.notes =
          rejectionReason ?? 'Pembayaran ditolak tanpa alasan spesifik';
      }

      await tx.payments.update({
        where: { id: paymentId },
        data: paymentUpdateData,
      });

      await tx.orders.update({
        where: { id: payment.orderId },
        data: {
          orderStatus: status,
          paymentStatus: status,
        },
      });
    });

    const failMsg =
      rejectionReason?.trim() ||
      'Pembayaranmu tidak dapat diverifikasi. Silakan hubungi admin atau unggah bukti baru.';

    await this.notificationsService.notifyByEvent({
      event: 'payment_rejected_student',
      userId: payment.order.userId,
      reason: failMsg,
    });

    return {
      success: true,
      message: `Pembayaran ${paymentId} telah di-update menjadi ${status}`,
    };
  }
}
