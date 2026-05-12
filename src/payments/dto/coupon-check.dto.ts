// src/payments/dto/check-voucher.dto.ts
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CheckVoucherDto {
  @IsString()
  @IsNotEmpty()
  couponCode!: string;

  @IsNumber()
  @IsNotEmpty()
  examId!: number;
}
