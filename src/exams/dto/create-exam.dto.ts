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
  @IsString()
  @IsNotEmpty()
  examName!: string;

  @IsNotEmpty()
  @IsNumberString()
  examPackageId!: string | number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumberString()
  subjectId!: string;

  @IsNotEmpty()
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
  attemptsAllowed?: string;

  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;

  @IsOptional()
  metadataJson?: unknown;
}

export type UpdateExamDto = Partial<CreateExamDto>;
