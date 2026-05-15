import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
} from 'class-validator';

export class CheckoutBankSoalDto {
  @IsNotEmpty()
  @IsNumberString()
  bankId!: string;

  @IsNotEmpty()
  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
