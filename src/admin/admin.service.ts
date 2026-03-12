// src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Lihat semua pembayaran yang masuk (perlu dicheck admin)
  async getPendingPayments() {
    return this.prisma.payments.findMany({
      where: { paymentStatus: 'pending' },
      include: {
        order: {
          include: {
            user: { select: { username: true, email: true } },
            orderItems: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  // Action: Terima atau Tolak Pembayaran
  async verifyPayment(paymentId: number, status: 'completed' | 'failed') {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Update Payment
      const payment = await tx.payments.update({
        where: { id: paymentId },
        data: { paymentStatus: status },
      });

      // 2. Update Order yang nyambung sama payment ini
      await tx.orders.update({
        where: { id: payment.orderId },
        data: { orderStatus: status },
      });

      return { message: `Pembayaran berhasil di-update ke ${status}` };
    });
  }
}
