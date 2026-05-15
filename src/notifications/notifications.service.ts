import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationsGateway,
  type NotificationReadPayload,
  type NotificationRealtimePayload,
} from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import type { Notifications as NotificationRow } from '@prisma/client';
import {
  ADMIN_PENDING_PAYMENT_TITLE,
  ADMIN_NOTIFICATION_LINK_PREFIX,
  NotificationEventKey,
} from './admin-notification.constants';
import { NotificationEmailService } from './notification-email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: NotificationEmailService,
  ) {}

  /** Hindari @typescript-eslint/no-unsafe-call bila tipe gateway tidak ter-resolve di IDE. */
  private emitRead(userId: number, payload: NotificationReadPayload): void {
    (
      this.gateway as {
        emitNotificationRead(uid: number, p: NotificationReadPayload): void;
      }
    ).emitNotificationRead(userId, payload);
  }

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

  private isAdminOnlyNotificationRow(row: {
    link: string | null;
    title: string;
  }): boolean {
    const link = row.link;
    if (link && link.startsWith(ADMIN_NOTIFICATION_LINK_PREFIX)) return true;
    return row.title === ADMIN_PENDING_PAYMENT_TITLE;
  }

  private async sendEmailBestEffort(dto: CreateNotificationDto): Promise<void> {
    const user = await this.prisma.users.findUnique({
      where: { id: dto.userId },
      select: { email: true, firstName: true, username: true },
    });
    if (!user?.email) return;

    const name = user.firstName || user.username || 'Pengguna';
    await this.emailService.send({
      to: user.email,
      subject: dto.title,
      text: `${dto.message}\n\nBuka aplikasi untuk melihat detail notifikasi.`,
      html: `<p>Halo ${name},</p><p>${dto.message}</p><p>Silakan buka aplikasi untuk melihat detail notifikasi.</p>`,
    });
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
    await this.sendEmailBestEffort(dto);
    return this.toPayload(row);
  }

  /** Dipanggil setelah `notifications.create` di transaction lain (mis. pembayaran). */
  deliverRealtime(row: NotificationRow): void {
    this.gateway.emitToUser(row.userId, this.toPayload(row));
  }

  async notifyAdminsPendingPayment(params: {
    buyerUserId: number;
    orderId: number;
    itemName: string;
    itemType: 'course' | 'exam' | 'question_bank';
    grandTotal: Prisma.Decimal;
  }) {
    const buyer = await this.prisma.users.findUnique({
      where: { id: params.buyerUserId },
      select: { username: true, firstName: true, lastName: true, email: true },
    });
    const buyerLabel =
      [buyer?.firstName, buyer?.lastName].filter(Boolean).join(' ').trim() ||
      buyer?.username ||
      buyer?.email ||
      `User #${params.buyerUserId}`;
    const entityLabels: Record<string, string> = {
      course: 'kursus',
      exam: 'ujian',
      question_bank: 'bank soal',
    };
    const entityLabel = entityLabels[params.itemType] ?? params.itemType;
    const totalStr = Number(params.grandTotal).toLocaleString('id-ID');

    const admins = await this.prisma.users.findMany({
      where: {
        userRoleId: 3,
        status: 'active',
        id: { not: params.buyerUserId },
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.create({
          userId: admin.id,
          title: ADMIN_PENDING_PAYMENT_TITLE,
          message: `${buyerLabel} mengunggah bukti pembayaran ${entityLabel} "${params.itemName}" (Order #${params.orderId}, Rp ${totalStr}).`,
          type: 'warning',
          link: `${ADMIN_NOTIFICATION_LINK_PREFIX}/payments/pending`,
        }),
      ),
    );
  }

  async notifyByEvent(params: {
    event: NotificationEventKey;
    userId: number;
    itemName?: string;
    reason?: string;
    score?: number;
    passingScore?: number;
    passed?: boolean;
  }) {
    const itemName = params.itemName ?? 'pesanan';
    let payload: CreateNotificationDto;
    switch (params.event) {
      case 'payment_pending_student':
        payload = {
          userId: params.userId,
          type: 'info',
          title: 'Pembayaran Sedang Diproses',
          message: `Bukti pembayaran untuk "${itemName}" telah dikirim. Admin akan segera memverifikasi.`,
        };
        break;
      case 'payment_pending_admin':
        payload = {
          userId: params.userId,
          type: 'warning',
          title: ADMIN_PENDING_PAYMENT_TITLE,
          message: `Ada pembayaran baru yang menunggu verifikasi untuk "${itemName}".`,
          link: `${ADMIN_NOTIFICATION_LINK_PREFIX}/payments/pending`,
        };
        break;
      case 'payment_approved_student':
        payload = {
          userId: params.userId,
          type: 'success',
          title: 'Pembayaran Berhasil Diverifikasi',
          message: `Pembayaran untuk "${itemName}" berhasil diverifikasi. Aksesmu sudah dibuka.`,
        };
        break;
      case 'payment_rejected_student':
        payload = {
          userId: params.userId,
          type: 'error',
          title: 'Pembayaran ditolak',
          message:
            params.reason?.trim() ||
            'Pembayaran tidak dapat diverifikasi. Silakan hubungi admin atau unggah ulang bukti pembayaran.',
        };
        break;
      case 'free_exam_activated_student':
        payload = {
          userId: params.userId,
          type: 'success',
          title: 'Akses Ujian Aktif',
          message: `Ujian "${itemName}" berhasil diaktifkan dan bisa langsung kamu kerjakan.`,
        };
        break;
      case 'bulk_payment_approved_student':
        payload = {
          userId: params.userId,
          type: 'success',
          title: 'Pembayaran Berhasil Diverifikasi',
          message: `Pembayaran untuk "${itemName}" berhasil diverifikasi oleh admin.`,
        };
        break;
      case 'exam_submitted_student':
        payload = {
          userId: params.userId,
          type: params.passingScore ? 'success' : 'info',
          title: 'Hasil Ujian Tersedia',
          message: `Kamu telah menyelesaikan "${itemName}" dengan skor ${params.score ?? 0} (${params.passingScore ? 'lulus' : 'belum lulus'}).`,
        };
        break;
      default:
        throw new Error(
          `Unhandled notification event: ${String(params.event)}`,
        );
    }

    await this.create(payload);
  }

  private buildWhereForViewer(
    userId: number,
    query: ListNotificationsQueryDto,
    viewerIsAdmin: boolean,
  ): Prisma.NotificationsWhereInput {
    const base: Prisma.NotificationsWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };
    if (!viewerIsAdmin) {
      /**
       * Hindari `NOT: { OR: [ link startsWith..., title ... ] }` — di SQL,
       * `(NULL OR false)` di dalam NOT menghasilkan UNKNOWN sehingga baris
       * dengan `link` NULL (notifikasi siswa umumnya tanpa link) ikut ter-filter.
       */
      return {
        ...base,
        AND: [
          {
            NOT: {
              AND: [
                { link: { not: null } },
                { link: { startsWith: ADMIN_NOTIFICATION_LINK_PREFIX } },
              ],
            },
          },
          { title: { not: ADMIN_PENDING_PAYMENT_TITLE } },
        ],
      };
    }
    return base;
  }

  async findMine(
    userId: number,
    query: ListNotificationsQueryDto,
    viewerIsAdmin = false,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhereForViewer(userId, query, viewerIsAdmin);

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

  async countUnread(userId: number, viewerIsAdmin = false) {
    const where = this.buildWhereForViewer(
      userId,
      { unreadOnly: true } as ListNotificationsQueryDto,
      viewerIsAdmin,
    );
    const count = await this.prisma.notifications.count({ where });
    return { unreadCount: count };
  }

  /**
   * Satu notifikasi milik viewer + opsi tandai dibaca saat dibuka (`markRead=true`).
   */
  async findOneForViewer(
    userId: number,
    id: number,
    viewerIsAdmin: boolean,
    options?: { markRead?: boolean },
  ) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (row.userId !== userId) throw new ForbiddenException();
    if (!viewerIsAdmin && this.isAdminOnlyNotificationRow(row)) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }

    if (options?.markRead && !row.isRead) {
      const updated = await this.prisma.notifications.update({
        where: { id },
        data: { isRead: true },
      });
      this.emitRead(userId, {
        id: updated.id,
        isRead: true,
      });
      return this.toPayload(updated);
    }

    return this.toPayload(row);
  }

  async markRead(userId: number, id: number, viewerIsAdmin = false) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (row.userId !== userId) throw new ForbiddenException();
    if (!viewerIsAdmin && this.isAdminOnlyNotificationRow(row)) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }
    if (row.isRead) {
      return this.toPayload(row);
    }
    const updated = await this.prisma.notifications.update({
      where: { id },
      data: { isRead: true },
    });
    this.emitRead(userId, {
      id: updated.id,
      isRead: true,
    });
    return this.toPayload(updated);
  }

  async markAllRead(userId: number, viewerIsAdmin = false) {
    const where = this.buildWhereForViewer(
      userId,
      { unreadOnly: true } as ListNotificationsQueryDto,
      viewerIsAdmin,
    );
    await this.prisma.notifications.updateMany({
      where,
      data: { isRead: true },
    });
    this.emitRead(userId, { allRead: true });
    return { success: true };
  }

  async remove(userId: number, id: number, viewerIsAdmin = false) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (row.userId !== userId) throw new ForbiddenException();
    if (!viewerIsAdmin && this.isAdminOnlyNotificationRow(row)) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }
    await this.prisma.notifications.delete({ where: { id } });
    return { success: true, id };
  }
}
