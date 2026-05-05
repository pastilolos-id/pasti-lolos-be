import { Controller, Get, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { Roles } from 'src/common/decorators/roles.decorators';

@Controller('admin')
@UseGuards(AuthGuard('jwt')) 
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('payments/pending')
  @Roles('3') 
  async getPending() {
    return this.adminService.getPendingPayments();
  }

  @Patch('payments/verify/:id')
  @Roles('3')
  async verify(
    @Param('id', ParseIntPipe) id: number, // Pake ParseIntPipe biar otomatis jadi number
    @Body() dto: VerifyPaymentDto,
  ) {
    // Kirim status dan reason ke service
    return this.adminService.verifyPayment(id, dto.status, dto.rejectionReason);
  }
}
