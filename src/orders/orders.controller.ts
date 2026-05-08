// src/orders/orders.controller.ts
import { Controller, Get,Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('history')
  async getHistory(@Req() req: any) {
    // Tadi kita set di JwtStrategy pake key 'userId'
    const userId = req.user.userId; 
    return this.ordersService.getPurchaseHistory(userId);
  }

  @Get('history/:id')
  async getDetail(
    @Param('id', ParseIntPipe) id: number, // Pake ParseIntPipe biar otomatis convert string ke number
    @Req() req: any,
  ) {
    // Ambil userId dari payload JWT (yang tadi kita set di JwtStrategy)
    const userId = req.user.userId; 

    const orderDetail = await this.ordersService.getOrderDetail(id, userId);
    
    return {
      success: true,
      message: 'Detail pesanan berhasil diambil',
      data: orderDetail,
    };
  }
}