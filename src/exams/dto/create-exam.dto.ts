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
  @IsNotEmpty()
  @IsString()
  examName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumberString()
  subjectId!: string;

  @IsNotEmpty()
  @IsNumberString()
  durationMinutes!: string;

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
}
