import { IsOptional, IsString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetTransactionsDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe item: question_bank, exam, course',
    enum: ['question_bank', 'exam', 'course'],
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status pembayaran: pending, paid, failed',
    enum: ['pending', 'paid', 'failed'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Cari berdasarkan nama atau email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Halaman (default: 1)' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Jumlah per halaman (default: 10)' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
