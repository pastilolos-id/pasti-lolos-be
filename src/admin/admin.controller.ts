import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RejectTransactionDto } from './dto/reject-transaction.dto';
import { Roles } from 'src/common/decorators/roles.decorators';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('Admin')
@ApiCookieAuth()
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('payments/pending')
  @Roles('3')
  async getPending() {
    return this.adminService.getPendingPayments();
  }

  @Patch('payments/verify/:orderId')
  @Roles('3')
  @ApiOperation({
    summary:
      'Admin: Verifikasi pembayaran berdasarkan Order ID (completed = terima, failed = tolak)',
  })
  async verify(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.adminService.verifyPayment(
      orderId,
      dto.status,
      dto.rejectionReason,
    );
  }

  @Patch('transactions/:orderId/reject')
  @Roles('3')
  @ApiOperation({ summary: 'Admin: Tolak transaksi berdasarkan Order ID' })
  async rejectTransaction(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: RejectTransactionDto,
  ) {
    return this.adminService.rejectTransaction(orderId, dto.rejectionReason);
  }
}
