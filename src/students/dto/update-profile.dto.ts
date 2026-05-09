import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('ID') // Validasi format nomor HP Indonesia
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
