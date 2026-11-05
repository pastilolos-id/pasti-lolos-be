import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ExamPackagesService } from '../exams/exam-packages.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private notificationsService: NotificationsService,
    private examPackagesService: ExamPackagesService,
  ) {}

  async processExamManualPayment(
    examPackageId: number,
    userId: number,
    paymentMethod: string,
    file: Express.Multer.File,
    discountCode?: string,
  ) {
    const pkg = await this.prisma.examPackages.findUnique({
      where: { id: examPackageId },
    });
    if (!pkg) throw new NotFoundException('Ujian tidak ditemukan');

    const existingEnrollment = await this.prisma.userExamPackages.findFirst({
      where: { userId, examPackageId },
    });
    if (existingEnrollment) {
      throw new BadRequestException('Lo sudah punya akses ke ujian ini.');
    }

    const pendingOrder = await this.prisma.orders.findFirst({
      where: {
        userId,
        orderStatus: 'pending',
        orderItems: {
          some: {
            itemId: examPackageId,
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

    const totalAmount = pkg.price ?? new Prisma.Decimal(0);
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

    if (!file) throw new BadRequestException('Bukti pembayaran wajib diunggah');
    const upload = await this.cloudinary.uploadFile(
      file,
      'exam_payment_proofs',
    );

    const checkoutResult = await this.prisma.$transaction(async (tx) => {
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
          transactionId: `EXTX-${Date.now()}-${userId}`,
          paymentStatus: 'pending',
          receiptUrl: upload.secure_url,
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
      itemName: pkg.examName,
      itemType: 'exam',
      grandTotal: checkoutResult.grandTotal,
    });

    await this.notificationsService.notifyByEvent({
      event: 'payment_pending_student',
      userId,
      itemName: pkg.examName,
    });

    return checkoutResult;
  }

  async approveManualPayment(orderId: number) {
    const txResult = await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { id: orderId },
        include: { orderItems: true },
      });

      if (!order) throw new NotFoundException('Order tidak ditemukan');

      if (order.orderStatus === 'completed') {
        throw new BadRequestException('Order ini sudah diproses sebelumnya.');
      }

      const updatedOrder = await tx.orders.update({
        where: { id: orderId },
        data: {
          orderStatus: 'completed',
          paymentStatus: 'paid',
        },
        include: { orderItems: true },
      });

      await tx.payments.updateMany({
        where: { orderId: order.id },
        data: { paymentStatus: 'completed' },
      });

      const packageIds = updatedOrder.orderItems
        .filter((item) => item.itemType === 'exam')
        .map((item) => item.itemId);

      for (const examPackageId of [...new Set(packageIds)]) {
        await this.examPackagesService.enrollUserInPackage(
          tx,
          updatedOrder.userId,
          examPackageId,
        );
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
          .map((item) => ({
            userId: order.userId,
            examPackageId: item.itemId,
          })),
      );

      for (const item of examOrderItems) {
        await this.examPackagesService.enrollUserInPackage(
          tx,
          item.userId,
          item.examPackageId,
        );
      }

      await tx.orders.updateMany({
        where: { id: { in: orderIds } },
        data: {
          orderStatus: 'completed',
          paymentStatus: 'paid',
        },
      });

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

  async validateVoucher(code: string, examPackageId: number) {
    const now = new Date();

    const coupon = await this.prisma.coupons.findUnique({
      where: { couponCode: code.toUpperCase() },
    });

    const pkg = await this.prisma.examPackages.findUnique({
      where: { id: examPackageId },
    });

    if (!pkg) {
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

    const originalPrice = Number(pkg.price);
    let discountAmount = 0;

    if (coupon.discountType === 'percentage') {
      discountAmount = (originalPrice * Number(coupon.discountValue)) / 100;
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return {
      message: 'Voucher berhasil dipasang',
      summary: {
        examName: pkg.examName,
        originalPrice,
        discount: discountAmount,
        totalPay: finalPrice,
        couponUsed: coupon.couponCode,
      },
    };
  }
}
