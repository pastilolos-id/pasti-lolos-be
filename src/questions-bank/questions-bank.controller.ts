import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UnauthorizedException,
  ParseIntPipe,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { BankSoalService } from './questions-bank.service';
import { CreateBankSoalDto } from './dto/create-bank-soal.dto';
import { UpdateBankSoalDto } from './dto/update-bank-soal.dto';
import { CheckoutBankSoalDto } from './dto/checkout-bank-soal.dto';
import type { Request } from 'express';
import type { JwtRequestUser } from 'src/types/express';

interface RequestWithUser extends Request {
  user?: JwtRequestUser;
}

@ApiTags('Bank Soal')
@ApiCookieAuth()
@Controller('bank-soal')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BankSoalController {
  constructor(private readonly bankSoalService: BankSoalService) {}

  private requireUserId(req: RequestWithUser): number {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) throw new UnauthorizedException('User tidak valid');
    return userId;
  }

  // ─── ADMIN ───

  @Post()
  @Roles('2', '3')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    description:
      'Form fields: bankName, subjectId (wajib); description, topicId, price (opsional); file = PDF (opsional, satu langkah dengan create)',
    schema: {
      type: 'object',
      required: ['bankName', 'subjectId'],
      properties: {
        bankName: { type: 'string', example: 'Bank Soal TIU 2026' },
        description: { type: 'string', example: 'Kumpulan soal TIU' },
        subjectId: { type: 'string', example: '1' },
        price: { type: 'string', example: '50000' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF bank soal (opsional)',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'Admin: Buat bank soal baru (opsional: lampirkan PDF lewat field `file` sekaligus)',
  })
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateBankSoalDto,
    @Req() req: RequestWithUser,
  ) {
    if (file && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File harus berupa PDF');
    }
    return this.bankSoalService.createBankSoal(
      dto,
      this.requireUserId(req),
      file,
    );
  }

  @Patch(':id')
  @Roles('2', '3')
  @ApiOperation({ summary: 'Admin: Update bank soal' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankSoalDto,
  ) {
    return this.bankSoalService.updateBankSoal(id, dto);
  }

  @Post(':id/upload-pdf')
  @Roles('2', '3')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Admin: Upload atau ganti PDF bank soal (setelah create)',
  })
  uploadPdf(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File harus berupa PDF');
    }
    return this.bankSoalService.uploadPdf(id, file);
  }

  @Delete(':id/pdf')
  @Roles('2', '3')
  @ApiOperation({ summary: 'Admin: Hapus PDF dari bank soal' })
  deletePdf(@Param('id', ParseIntPipe) id: number) {
    return this.bankSoalService.deletePdf(id);
  }

  @Patch(':id/publish')
  @Roles('2', '3')
  @ApiOperation({ summary: 'Admin: Publish bank soal' })
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.bankSoalService.publishBankSoal(id);
  }

  @Delete(':id')
  @Roles('2', '3')
  @ApiOperation({ summary: 'Admin: Hapus bank soal' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bankSoalService.deleteBankSoal(id);
  }

  @Get('admin/all')
  @Roles('2', '3')
  @ApiOperation({ summary: 'Admin: List semua bank soal (bisa filter status)' })
  adminGetAll(@Query('status') status?: string) {
    return this.bankSoalService.getAllBankSoal(status);
  }

  // ─── USER ───

  @Get()
  @Roles('1', '2', '3')
  @ApiOperation({ summary: 'List semua bank soal yang published' })
  getAll() {
    return this.bankSoalService.getAll();
  }

  @Get('my-purchases')
  @Roles('1', '2', '3')
  @ApiOperation({ summary: 'Riwayat pembelian bank soal saya' })
  getMyPurchases(@Req() req: RequestWithUser) {
    return this.bankSoalService.getMyPurchases(this.requireUserId(req));
  }

  @Get(':id')
  @Roles('1', '2', '3')
  @ApiOperation({ summary: 'Detail bank soal (termasuk info akses)' })
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.bankSoalService.getDetail(id, userId);
  }

  @Post('checkout')
  @Roles('1', '2', '3')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Beli bank soal (upload bukti pembayaran)' })
  checkout(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: CheckoutBankSoalDto,
    @Req() req: RequestWithUser,
  ) {
    if (!file) throw new BadRequestException('Bukti pembayaran wajib diunggah');
    return this.bankSoalService.checkoutBankSoal(
      +dto.bankId,
      dto.paymentMethod,
      file,
      this.requireUserId(req),
      dto.discountCode,
    );
  }

  @Get(':id/view-pdf')
  @Roles('1', '2', '3')
  @ApiOperation({
    summary: 'Lihat PDF bank soal (harus sudah beli, tidak bisa download)',
  })
  viewPdf(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.bankSoalService.viewPdf(id, this.requireUserId(req));
  }
}
