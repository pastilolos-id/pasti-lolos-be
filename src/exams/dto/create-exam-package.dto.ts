import { PartialType } from '@nestjs/mapped-types';
import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';

export class CreateExamPackageDto {
  @IsString()
  @IsNotEmpty()
  examName!: string;

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
  price?: string;

  @IsOptional()
  metadataJson?: unknown;
}

export class UpdateExamPackageDto extends PartialType(CreateExamPackageDto) {}
