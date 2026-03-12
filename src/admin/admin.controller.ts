// src/admin/admin.controller.ts
import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
// Import RolesGuard lo kalo ada

@Controller('admin')
@UseGuards(AuthGuard('jwt')) // Nanti tambahin RolesGuard khusus Admin di sini
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('payments/pending')
  async getPending() {
    return this.adminService.getPendingPayments();
  }

  @Patch('payments/verify/:id')
  async verify(
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto, // Pakai DTO di sini
  ) {
    return this.adminService.verifyPayment(+id, dto.status);
  }
}
