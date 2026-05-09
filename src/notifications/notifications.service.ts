import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationsGateway,
  NotificationRealtimePayload,
} from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import type { Notifications as NotificationRow } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  toPayload(row: NotificationRow): NotificationRealtimePayload {
    const link =
      row.link === undefined || row.link === null ? null : String(row.link);

    return {
      id: row.id,
      userId: row.userId,
      title: String(row.title),
      message: String(row.message),
      type: String(row.type),
      link,
      isRead: Boolean(row.isRead),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Simpan + push realtime ke user (admin / sistem). */
  async create(dto: CreateNotificationDto) {
    const row = await this.prisma.notifications.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type ?? 'info',
        link: dto.link ?? null,
      },
    });
    this.gateway.emitToUser(row.userId, this.toPayload(row));
    return this.toPayload(row);
  }

  /** Dipanggil setelah `notifications.create` di transaction lain (mis. pembayaran). */
  deliverRealtime(row: NotificationRow): void {
    this.gateway.emitToUser(row.userId, this.toPayload(row));
  }

  async findMine(userId: number, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notifications.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toPayload(r)),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit) || 1,
        limit,
      },
    };
  }

  async countUnread(userId: number) {
    const count = await this.prisma.notifications.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  async markRead(userId: number, id: number) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (row.userId !== userId) throw new ForbiddenException();
    const updated = await this.prisma.notifications.update({
      where: { id },
      data: { isRead: true },
    });
    return this.toPayload(updated);
  }

  async markAllRead(userId: number) {
    await this.prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async remove(userId: number, id: number) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (row.userId !== userId) throw new ForbiddenException();
    await this.prisma.notifications.delete({ where: { id } });
    return { success: true, id };
  }
}
