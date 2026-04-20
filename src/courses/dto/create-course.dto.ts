import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  courseTitle!: string;

  @IsNotEmpty()
  @IsNumberString()
  subjectId!: string; // Kategori Kelas (BUMN/CPNS)

  @IsNotEmpty()
  @IsNumberString()
  topicId?: string; // Kategori Materi (TWK/TIU)

  @IsNotEmpty()
  @IsEnum(['beginner', 'intermediate', 'advance', 'advanced'])
  difficultyLevel!: string;

  @IsNotEmpty()
  @IsNumberString()
  price!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  instructorId?: string; // Dari UI "Nama Contributor"
}
