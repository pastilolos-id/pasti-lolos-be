import {
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
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { Roles } from 'src/common/decorators/roles.decorators';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { JwtRequestUser } from 'src/types/express';

interface RequestWithUser extends Express.Request {
  user?: JwtRequestUser;
}

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private getUserId(req: RequestWithUser): number {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new Error('User ID tidak ditemukan di request');
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
    return this.notificationsService.findMine(this.getUserId(req), query);
  }

  @Get('unread-count')
  unreadCount(@Req() req: RequestWithUser) {
    return this.notificationsService.countUnread(this.getUserId(req));
  }

  @Patch(':id/read')
  markRead(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markRead(this.getUserId(req), id);
  }

  @Patch('read-all')
  markAllRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllRead(this.getUserId(req));
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.remove(this.getUserId(req), id);
  }
}
