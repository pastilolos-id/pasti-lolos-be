import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
} from 'class-validator';

export class CreateModuleDto {
  @IsNotEmpty()
  @IsNumberString()
  courseId: string; // Ini ID Course induknya

  @IsNotEmpty()
  @IsString()
  moduleTitle: string; // Dari input "Nama Modul"

  @IsNotEmpty()
  @IsNumberString()
  moduleOrder: string; // Dari input "Urutan Modul"

  @IsOptional()
  @IsString()
  description?: string; // Dari input "Deskripsi"

  @IsOptional()
  @IsString()
  status?: string; // Default 'draft' sesuai prisma
}
