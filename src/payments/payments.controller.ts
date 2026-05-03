import { Controller, Post, Body, UseGuards, Req, UseInterceptors, UploadedFile, Param, Patch, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // URL KHUSUS CHECKOUT EXAM
  @Post('checkout/exam')
  @UseInterceptors(FileInterceptor('file'))
  async checkoutExam(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Bukti pembayaran wajib diunggah');
    
    return this.paymentsService.processExamManualPayment(
      +body.examId,
      req.user.userId,
      body.paymentMethod,
      file,
      body.discountCode,
    );
  }

  // Nanti lo tinggal tambahin @Post('checkout/course') di sini fungsinya beda lagi

  @Patch('verify/:orderId')
  @Roles('3') // Admin Only
  async verify(@Param('orderId') orderId: string) {
    return this.paymentsService.approveManualPayment(+orderId);
  }

  @Patch('verify-bulk')
  @Roles('3') // Admin Only[cite: 9]
  async verifyBulk(@Body('orderIds') orderIds: number[]) {
    return this.paymentsService.approveBulkPayments(orderIds);
  }

}