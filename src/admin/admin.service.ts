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

  // Action: Terima atau Tolak Pembayaran (by Order ID)
  async verifyPayment(
    orderId: number,
    status: PaymentStatus,
    rejectionReason: string | undefined,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        paymentStatus: true,
        orderStatus: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Transaksi dengan ID ${orderId} tidak ditemukan`,
      );
    }

    if (order.paymentStatus === 'paid' || order.orderStatus === 'completed') {
      throw new BadRequestException(
        'Transaksi ini sudah disetujui dan tidak dapat diverifikasi ulang',
      );
    }

    const payment = await this.prisma.payments.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new NotFoundException(
        `Data pembayaran untuk transaksi #${orderId} tidak ditemukan`,
      );
    }

    if (payment.paymentStatus !== 'pending') {
      throw new BadRequestException(
        `Pembayaran transaksi #${orderId} sudah diproses dengan status: ${payment.paymentStatus}`,
      );
    }

    if (status === PaymentStatus.COMPLETED) {
      const result = await this.paymentsService.approveManualPayment(orderId);
      return {
        success: true,
        message: result.message,
        data: { orderId, paymentStatus: 'paid', orderStatus: 'completed' },
      };
    }

    const reason =
      rejectionReason?.trim() || 'Pembayaran ditolak tanpa alasan spesifik';

    await this.prisma.$transaction(async (tx) => {
      await tx.payments.update({
        where: { id: payment.id },
        data: {
          paymentStatus: 'failed',
          notes: reason,
        },
      });

      await tx.orders.update({
        where: { id: orderId },
        data: {
          orderStatus: 'failed',
          paymentStatus: 'failed',
          notes: reason,
        },
      });
    });

    const failMsg =
      rejectionReason?.trim() ||
      'Pembayaranmu tidak dapat diverifikasi. Silakan hubungi admin atau unggah bukti baru.';

    await this.notificationsService.notifyByEvent({
      event: 'payment_rejected_student',
      userId: order.userId,
      reason: failMsg,
    });

    return {
      success: true,
      message: `Transaksi #${orderId} berhasil ditolak`,
      data: {
        orderId,
        paymentStatus: 'failed',
        orderStatus: 'failed',
        rejectionReason: reason,
      },
    };
  }

  async rejectTransaction(orderId: number, rejectionReason?: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        orderItems: { select: { itemName: true, itemType: true } },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Transaksi dengan ID ${orderId} tidak ditemukan`,
      );
    }

    if (order.paymentStatus === 'paid' || order.orderStatus === 'completed') {
      throw new BadRequestException(
        'Transaksi ini sudah disetujui dan tidak dapat ditolak',
      );
    }

    if (order.paymentStatus === 'failed') {
      throw new BadRequestException('Transaksi ini sudah ditolak sebelumnya');
    }

    const reason =
      rejectionReason?.trim() || 'Pembayaran ditolak tanpa alasan spesifik';
    const payment = order.payments[0];

    await this.prisma.$transaction(async (tx) => {
      if (payment) {
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            paymentStatus: 'failed',
            notes: reason,
          },
        });
      }

      await tx.orders.update({
        where: { id: orderId },
        data: {
          orderStatus: 'failed',
          paymentStatus: 'failed',
          notes: reason,
        },
      });
    });

    const failMsg =
      rejectionReason?.trim() ||
      'Pembayaranmu tidak dapat diverifikasi. Silakan hubungi admin atau unggah bukti baru.';

    await this.notificationsService.notifyByEvent({
      event: 'payment_rejected_student',
      userId: order.userId,
      reason: failMsg,
    });

    const fullName =
      [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') ||
      order.user.username;

    return {
      success: true,
      message: `Transaksi #${orderId} berhasil ditolak`,
      data: {
        orderId: order.id,
        namaUser: fullName,
        emailUser: order.user.email,
        itemName: order.orderItems[0]?.itemName ?? null,
        itemType: order.orderItems[0]?.itemType ?? null,
        grandTotal: Number(order.grandTotal),
        paymentStatus: 'failed',
        orderStatus: 'failed',
        rejectionReason: reason,
        ditolakPada: new Date(),
      },
    };
  }
}
