import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectTransactionDto {
  @ApiPropertyOptional({
    description: 'Alasan penolakan yang dikirim ke siswa',
    example: 'Bukti transfer tidak sesuai dengan nominal pembayaran',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
