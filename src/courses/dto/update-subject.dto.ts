import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional() @IsString() subjectName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() iconUrl?: string;
  // Tambahkan field lain yang mungkin di-update
}
