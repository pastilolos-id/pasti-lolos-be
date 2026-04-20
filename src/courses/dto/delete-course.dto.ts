import { IsOptional, IsString } from 'class-validator';

export class DeleteCourseDto {
  @IsOptional()
  @IsString()
  reason?: string; // Contoh jika ingin menyimpan alasan penghapusan
}
