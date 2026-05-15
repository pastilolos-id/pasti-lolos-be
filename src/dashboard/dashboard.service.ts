import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type RevenuePeriod = 'daily' | 'monthly' | 'yearly';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getAdminSummary() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(startOfThisMonth.getTime() - 1);

    const [
      totalUsers,
      usersThisMonth,
      usersLastMonth,
      totalTransactions,
      transactionsThisMonth,
      transactionsLastMonth,
      revenueAllTime,
      revenueThisMonth,
      revenueLastMonth,
    ] = await Promise.all([
      this.prisma.users.count(),
      this.prisma.users.count({
        where: { createdAt: { gte: startOfThisMonth } },
      }),
      this.prisma.users.count({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      this.prisma.orders.count({
        where: { paymentStatus: 'paid' },
      }),
      this.prisma.orders.count({
        where: {
          paymentStatus: 'paid',
          orderDate: { gte: startOfThisMonth },
        },
      }),
      this.prisma.orders.count({
        where: {
          paymentStatus: 'paid',
          orderDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      this.prisma.orders.aggregate({
        _sum: { grandTotal: true },
        where: { paymentStatus: 'paid' },
      }),
      this.prisma.orders.aggregate({
        _sum: { grandTotal: true },
        where: {
          paymentStatus: 'paid',
          orderDate: { gte: startOfThisMonth },
        },
      }),
      this.prisma.orders.aggregate({
        _sum: { grandTotal: true },
        where: {
          paymentStatus: 'paid',
          orderDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
    ]);

    return {
      totalUser: {
        value: totalUsers,
        percentageChange: this.calcPercentageChange(
          usersLastMonth,
          usersThisMonth,
        ),
      },
      totalTransaksi: {
        value: totalTransactions,
        percentageChange: this.calcPercentageChange(
          transactionsLastMonth,
          transactionsThisMonth,
        ),
      },
      totalRevenue: {
        value: Number(revenueAllTime._sum.grandTotal ?? 0),
        percentageChange: this.calcPercentageChange(
          Number(revenueLastMonth._sum.grandTotal ?? 0),
          Number(revenueThisMonth._sum.grandTotal ?? 0),
        ),
      },
    };
  }

  async getRevenueChart(period: RevenuePeriod = 'daily') {
    const now = new Date();

    switch (period) {
      case 'daily':
        return this.getDailyRevenue(now);
      case 'monthly':
        return this.getMonthlyRevenue(now);
      case 'yearly':
        return this.getYearlyRevenue();
    }
  }

  async getTopSales(limit = 10) {
    const orderItems = await this.prisma.orderItems.groupBy({
      by: ['itemName', 'itemType', 'itemId'],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
      where: {
        order: { paymentStatus: 'paid' },
      },
    });

    return orderItems.map((item, index) => ({
      no: index + 1,
      nama: item.itemName,
      terjual: item._sum.quantity ?? 0,
      profit: Number(item._sum.totalPrice ?? 0),
    }));
  }

  private async getDailyRevenue(now: Date) {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    startOfWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const orders = await this.prisma.orders.findMany({
      where: {
        paymentStatus: 'paid',
        orderDate: { gte: startOfWeek, lte: endOfWeek },
      },
      select: { orderDate: true, grandTotal: true },
    });

    const revenueByDay = new Map<number, number>();
    for (const order of orders) {
      const day = order.orderDate.getDay();
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(order.grandTotal));
    }

    const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.grandTotal),
      0,
    );

    return {
      totalPenjualan: totalRevenue,
      data: mondayFirst.map((dayIndex) => ({
        label: dayNames[dayIndex],
        revenue: revenueByDay.get(dayIndex) ?? 0,
      })),
    };
  }

  private async getMonthlyRevenue(now: Date) {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];

    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const orders = await this.prisma.orders.findMany({
      where: {
        paymentStatus: 'paid',
        orderDate: { gte: startOfYear, lte: endOfYear },
      },
      select: { orderDate: true, grandTotal: true },
    });

    const revenueByMonth = new Map<number, number>();
    for (const order of orders) {
      const month = order.orderDate.getMonth();
      revenueByMonth.set(
        month,
        (revenueByMonth.get(month) ?? 0) + Number(order.grandTotal),
      );
    }

    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.grandTotal),
      0,
    );

    return {
      totalPenjualan: totalRevenue,
      data: monthNames.map((label, index) => ({
        label,
        revenue: revenueByMonth.get(index) ?? 0,
      })),
    };
  }

  private async getYearlyRevenue() {
    const orders = await this.prisma.orders.findMany({
      where: { paymentStatus: 'paid' },
      select: { orderDate: true, grandTotal: true },
      orderBy: { orderDate: 'asc' },
    });

    const revenueByYear = new Map<number, number>();
    for (const order of orders) {
      const year = order.orderDate.getFullYear();
      revenueByYear.set(
        year,
        (revenueByYear.get(year) ?? 0) + Number(order.grandTotal),
      );
    }

    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.grandTotal),
      0,
    );

    const sortedYears = [...revenueByYear.entries()].sort(
      ([a], [b]) => a - b,
    );

    return {
      totalPenjualan: totalRevenue,
      data: sortedYears.map(([year, revenue]) => ({
        label: String(year),
        revenue,
      })),
    };
  }

  private calcPercentageChange(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}
