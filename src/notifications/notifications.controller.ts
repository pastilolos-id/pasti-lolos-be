import {
  UnauthorizedException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Req,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { GetNotificationQueryDto } from './dto/get-notification-query.dto';
import { Roles } from 'src/common/decorators/roles.decorators';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { JwtRequestUser } from 'src/types/express';

interface RequestWithUser extends Express.Request {
  user?: JwtRequestUser;
}

@ApiTags('Notifications')
@ApiCookieAuth()
@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private getUserId(req: RequestWithUser): number {
    const raw = req.user?.userId ?? req.user?.sub ?? req.user?.id;
    const userId = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new UnauthorizedException('User ID tidak ditemukan di token');
    }
    return userId;
  }

  /** Admin: buat notifikasi untuk user tertentu (+ realtime). */
  @Post()
  @Roles('3')
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Get()
  list(@Req() req: RequestWithUser, @Query() query: ListNotificationsQueryDto) {
    const roles = req.user?.roles?.map(String) ?? [];
    const viewerIsAdmin = roles.includes('3');
    return this.notificationsService.findMine(
      this.getUserId(req),
      query,
      viewerIsAdmin,
    );
  }

  @Get('unread-count')
  unreadCount(@Req() req: RequestWithUser) {
    const roles = req.user?.roles?.map(String) ?? [];
    const viewerIsAdmin = roles.includes('3');
    return this.notificationsService.countUnread(
      this.getUserId(req),
      viewerIsAdmin,
    );
  }

  /** Satu notifikasi; `?markRead=true` = tandai dibaca saat dibuka (satu request untuk FE). */
  @Get(':id')
  findOne(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetNotificationQueryDto,
  ) {
    const roles = req.user?.roles?.map(String) ?? [];
    const viewerIsAdmin = roles.includes('3');
    return this.notificationsService.findOneForViewer(
      this.getUserId(req),
      id,
      viewerIsAdmin,
      { markRead: query.markRead === true },
    );
  }

  @Patch('read-all')
  markAllRead(@Req() req: RequestWithUser) {
    const roles = req.user?.roles?.map(String) ?? [];
    const viewerIsAdmin = roles.includes('3');
    return this.notificationsService.markAllRead(
      this.getUserId(req),
      viewerIsAdmin,
    );
  }

  @Patch(':id/read')
  markRead(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    const roles = req.user?.roles?.map(String) ?? [];
    const viewerIsAdmin = roles.includes('3');
    return this.notificationsService.markRead(
      this.getUserId(req),
      id,
      viewerIsAdmin,
    );
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    const roles = req.user?.roles?.map(String) ?? [];
    const viewerIsAdmin = roles.includes('3');
    return this.notificationsService.remove(
      this.getUserId(req),
      id,
      viewerIsAdmin,
    );
  }
}
