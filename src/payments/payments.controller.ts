import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Param,
  Patch,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { CheckVoucherDto } from './dto/coupon-check.dto';
import type { Request } from 'express';
import type { JwtRequestUser } from 'src/types/express';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('apply-coupon')
  async applyVoucher(@Body() dto: CheckVoucherDto) {
    // Memproses pengecekan voucher via body request
    return await this.paymentsService.validateVoucher(
      dto.couponCode,
      dto.examId,
    );
  }
  // URL KHUSUS CHECKOUT EXAM
  @Post('checkout/exam')
  @UseInterceptors(FileInterceptor('file'))
  async checkoutExam(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // Batas 2MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }), // Cuma gambar[cite: 6]
        ],
      }),
    )
    file: Express.Multer.File,
    @Body()
    body: { examId: string; paymentMethod: string; discountCode?: string },
    @Req() req: Request,
  ) {
    const user = req.user as JwtRequestUser | undefined;
    if (!user?.userId) {
      throw new BadRequestException('User tidak valid');
    }
    return this.paymentsService.processExamManualPayment(
      +body.examId,
      user.userId,
      body.paymentMethod,
      file,
      body.discountCode,
    );
  }

  @Patch('verify/:orderId')
  @Roles('3') // Cuma Admin yang bisa approve[cite: 6]
  async verify(@Param('orderId') orderId: string) {
    return this.paymentsService.approveManualPayment(+orderId);
  }

  @Patch('approve/:orderId') // atau @Post sesuai route lo
  @Roles('3') // Cuma Admin yang bisa approve[cite: 6]
  async approvePayment(@Param('orderId') orderId: string) {
    // Gunakan Number(orderId) atau +orderId untuk konversi string ke number
    return this.paymentsService.approveManualPayment(Number(orderId));
  }

  @Patch('verify-bulk')
  @Roles('3') // Admin Only[cite: 9]
  async verifyBulk(@Body('orderIds') orderIds: number[]) {
    return this.paymentsService.approveBulkPayments(orderIds);
  }

  @Post('upload-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 2 * 1024 * 1024, // Batas 2MB[cite: 6]
      },
      fileFilter: (req, file, callback) => {
        // Cuma terima gambar[cite: 6]
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(
            new BadRequestException('Cuma boleh upload JPG, JPEG, atau PNG!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadProof(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File-nya mana?');

    // Lanjut proses upload ke Cloudinary...[cite: 6, 9]
  }
}
