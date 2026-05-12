// src/orders/orders.controller.ts
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { Request } from 'express';
import type { JwtRequestUser } from 'src/types/express';

@ApiTags('Orders')
@ApiCookieAuth()
@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('history')
  async getHistory(@Req() req: Request) {
    // Tadi kita set di JwtStrategy pake key 'userId'
    const user = req.user as JwtRequestUser | undefined;
    if (!user?.userId) {
      throw new NotFoundException('User tidak valid');
    }
    const userId = user.userId;
    return this.ordersService.getPurchaseHistory(userId);
  }

  @Get('history/:id')
  async getDetail(
    @Param('id', ParseIntPipe) id: number, // Pake ParseIntPipe biar otomatis convert string ke number
    @Req() req: Request,
  ) {
    // Ambil userId dari payload JWT (yang tadi kita set di JwtStrategy)
    const user = req.user as JwtRequestUser | undefined;
    if (!user?.userId) {
      throw new NotFoundException('User tidak valid');
    }
    const userId = user.userId;

    const orderDetail = await this.ordersService.getOrderDetail(id, userId);

    return {
      success: true,
      message: 'Detail pesanan berhasil diambil',
      data: orderDetail,
    };
  }
}
