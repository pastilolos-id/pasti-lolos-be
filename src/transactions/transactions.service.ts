import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getTransactions(query: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, status, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrdersWhereInput = {};

    if (status) {
      where.paymentStatus = status;
    }

    if (type) {
      where.orderItems = { some: { itemType: type } };
    }

    if (search) {
      where.user = {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePictureUrl: true,
            },
          },
          orderItems: {
            select: {
              id: true,
              itemType: true,
              itemId: true,
              itemName: true,
              totalPrice: true,
            },
          },
          payments: {
            select: {
              id: true,
              paymentStatus: true,
              receiptUrl: true,
              paymentDate: true,
              transactionId: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.orders.count({ where }),
    ]);

    const data = orders.map((order, idx) => {
      const payment = order.payments[0] ?? null;
      const fullName =
        [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') ||
        order.user.username;

      return {
        no: skip + idx + 1,
        orderId: order.id,
        nama: fullName,
        email: order.user.email,
        profilePicture: order.user.profilePictureUrl,
        buktiTransfer: payment?.receiptUrl ?? null,
        tanggalTransaksi: order.createdAt,
        harga: Number(order.grandTotal),
        status: order.paymentStatus,
        itemType: order.orderItems[0]?.itemType ?? null,
        itemName: order.orderItems[0]?.itemName ?? null,
        transactionId: payment?.transactionId ?? null,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionSummary() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [
      totalAll,
      totalPaid,
      totalPending,
      yesterdayAll,
      yesterdayPaid,
      yesterdayPending,
    ] = await Promise.all([
      this.prisma.orders.count(),
      this.prisma.orders.count({ where: { paymentStatus: 'paid' } }),
      this.prisma.orders.count({ where: { paymentStatus: 'pending' } }),
      this.prisma.orders.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      this.prisma.orders.count({
        where: {
          paymentStatus: 'paid',
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
      this.prisma.orders.count({
        where: {
          paymentStatus: 'pending',
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
    ]);

    const todayAll = await this.prisma.orders.count({
      where: { createdAt: { gte: todayStart } },
    });
    const todayPaid = await this.prisma.orders.count({
      where: { paymentStatus: 'paid', createdAt: { gte: todayStart } },
    });
    const todayPending = await this.prisma.orders.count({
      where: { paymentStatus: 'pending', createdAt: { gte: todayStart } },
    });

    const calcChange = (today: number, yesterday: number) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    return {
      totalTransaksi: {
        value: totalAll,
        changePercent: calcChange(todayAll, yesterdayAll),
      },
      transaksiSukses: {
        value: totalPaid,
        changePercent: calcChange(todayPaid, yesterdayPaid),
      },
      transaksiPending: {
        value: totalPending,
        changePercent: calcChange(todayPending, yesterdayPending),
      },
    };
  }

  async getTransactionDetail(orderId: number) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        orderItems: {
          select: {
            id: true,
            itemType: true,
            itemId: true,
            itemName: true,
            pricePerItem: true,
            totalPrice: true,
          },
        },
        payments: {
          select: {
            id: true,
            paymentStatus: true,
            receiptUrl: true,
            paymentDate: true,
            transactionId: true,
            amount: true,
            paymentMethod: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Transaksi tidak ditemukan');

    const fullName =
      [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') ||
      order.user.username;

    return {
      orderId: order.id,
      namaUser: fullName,
      emailUser: order.user.email,
      profilePicture: order.user.profilePictureUrl,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      grandTotal: Number(order.grandTotal),
      couponCode: order.couponCode,
      tanggalTransaksi: order.createdAt,
      items: order.orderItems,
      payments: order.payments,
      notes: order.notes,
    };
  }
}
