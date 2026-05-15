import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class UpdateBankSoalDto {
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  subjectId?: string;

  @IsOptional()
  @IsNumberString()
  topicId?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;
}
