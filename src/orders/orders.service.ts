// src/orders/orders.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async getPurchaseHistory(userId: number) {
    const orders = await this.prisma.orders.findMany({
        where: { userId: userId },
        include: {
        orderItems: {
            select: {
            itemName: true,
            itemType: true,
            itemId: true,
            // totalPrice: true, // Saran gue ini tetep di-include buat FE
            },
        },
        payments: {
            select: {
            createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
        },
        },
        orderBy: { createdAt: 'desc' },
    });

    // 1. Validasi jika data kosong
    if (!orders || orders.length === 0) {
        throw new NotFoundException('Belum ada riwayat pembelian');
    }

    // 2. Mapping data
    return orders.map((order) => ({
        id: order.id,
        date: order.createdAt,
        status: order.orderStatus, 
        paymentStatus: order.paymentStatus,
        grandTotal: Number(order.grandTotal), // Pastikan diconvert ke Number
        paymentMethod: order.paymentMethod,
        items: order.orderItems.map(item => ({
        ...item,
        // totalPrice: Number(item.totalPrice)
        })),
        paymentInfo: order.payments[0] || null,
    }));
    }

  // src/orders/orders.service.ts

    async getOrderDetail(orderId: number, userId: number) {
        const order = await this.prisma.orders.findFirst({
            where: { 
                id: orderId,
                userId: userId 
            },
            include: {
                orderItems: true,
                payments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

        const lastPayment = order.payments[0] || null;

        // Logic instruksi bayar
        const paymentInstructions = {
            method: order.paymentMethod,
            accountName: "PT Pasti Lolos Indonesia",
            accountNumber: order.paymentMethod === 'BCA' ? '1234567890' : '081234567890',
            notes: `Mohon transfer tepat sebesar Rp ${Number(order.grandTotal).toLocaleString('id-ID')}`
        };

        return {
            orderId: order.id,
            // AMBIL KODE TRANSAKSI DARI TABEL PAYMENT
            transactionCode: lastPayment?.transactionId || '-', 
            status: order.orderStatus,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            grandTotal: Number(order.grandTotal),
            discount: Number(order.discountAmount),
            totalAmount: Number(order.totalAmount),
            createdAt: order.createdAt,
            
            paymentInfo: lastPayment ? {
                paymentDate: lastPayment.createdAt,
                paymentMethod: order.paymentMethod, 
                amountPaid: Number(lastPayment.amount),
                receiptUrl: lastPayment.receiptUrl,
                status: lastPayment.paymentStatus,
                transactionId: lastPayment.transactionId // ID Transaksi dari Payment
            } : null,

            items: order.orderItems.map(item => ({
                ...item,
                pricePerItem: Number(item.pricePerItem),
                totalPrice: Number(item.totalPrice),
                metadataJson: typeof item.metadataJson === 'string' 
                    ? JSON.parse(item.metadataJson) 
                    : item.metadataJson
            })),

            instructions: order.orderStatus === 'pending' ? paymentInstructions : null,
        };
    }

}