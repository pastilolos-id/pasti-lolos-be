// src/admin/admin.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from './dto/verify-payment.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
  async verifyPayment(paymentId: number, status: PaymentStatus, reason?: string) {
    // 1. Validasi Keberadaan Data (Point 1)
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Pembayaran dengan ID ${paymentId} tidak ditemukan`);
    }

    // 2. Cegah Verifikasi Ulang (Point 1)
    if (payment.paymentStatus !== 'pending') {
      throw new BadRequestException(`Pembayaran ini sudah diproses sebelumnya dengan status: ${payment.paymentStatus}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 3. Update Payment (Point 4 - Simpan alasan jika gagal)
      const updatedPayment = await tx.payments.update({
        where: { id: paymentId },
        data: { 
          paymentStatus: status,
          // Simpan alasan di metadataJson atau kolom khusus jika lo punya
          metadataJson: reason ? { rejectionReason: reason } : (payment.metadataJson as object),
        },
      });

      // 4. Update Order (Point 2 & 5)
      await tx.orders.update({
        where: { id: payment.orderId },
        data: { 
          orderStatus: status,
          // Opsional: catat siapa admin yang memverifikasi jika ada req.user.id
        },
      });

      return { 
        success: true,
        message: `Pembayaran ${paymentId} telah di-update menjadi ${status}`
        // data: updatedPayment 
      };
    });
  }
}
