import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateExamDto {
  @IsString() // Pastikan ini IsString, bukan IsNumberString
  @IsNotEmpty()
  examName!: string;

  // @IsNotEmpty()
  @IsOptional()
  packageId?: string | number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumberString()
  subjectId!: string;

  @IsNotEmpty()
  // Pakai IsString atau IsNumberString tergantung gimana lo kirim dari Postman
  durationMinutes!: string | number;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsNotEmpty()
  @IsEnum(['tryout', 'quiz', 'final_exam', 'practice'])
  examType!: string;

  @IsOptional()
  @IsEnum(['draft', 'published', 'closed', 'archived'])
  status?: string;

  @IsOptional()
  @IsNumberString()
  passingScore?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsNumberString()
  attemptsAllowed?: string;

  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;
  
  @IsOptional()
  // Biar error "should not exist" hilang, tambahkan ini:
  metadataJson?: any;
}
