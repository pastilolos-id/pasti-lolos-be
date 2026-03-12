import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CheckoutDto {
  @IsNotEmpty() @IsNumberString() courseId: string;
  @IsNotEmpty() @IsString() paymentMethod: string; // misal: "BANK_TRANSFER"
  @IsOptional() @IsString() discountCode?: string;
  @IsOptional() @IsString() notes?: string;
}
