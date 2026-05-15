import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumberString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Dipakai di body `multipart/form-data` untuk POST /bank-soal (field teks + opsional file PDF). */
export class CreateBankSoalDto {
  @ApiProperty({ example: 'Bank Soal TIU 2026' })
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @ApiPropertyOptional({ example: 'Kumpulan soal TIU terbaru' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '1' })
  @IsNotEmpty()
  @IsNumberString()
  subjectId!: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsNumberString()
  topicId?: string;

  @ApiPropertyOptional({ example: '50000' })
  @IsOptional()
  @IsNumberString()
  price?: string;
}
