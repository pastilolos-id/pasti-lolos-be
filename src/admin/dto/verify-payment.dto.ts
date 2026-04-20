import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum PaymentStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class VerifyPaymentDto {
  @IsNotEmpty({ message: 'Status tidak boleh kosong' })
  @IsEnum(PaymentStatus, { message: 'Status harus completed atau failed' })
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string; // Alasan jika status 'failed'
}