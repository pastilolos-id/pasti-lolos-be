// src/payments/dto/exam-checkout.dto.ts
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ExamCheckoutDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  examId!: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @IsString()
  @IsOptional()
  discountCode?: string;
}
