import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsInt, 
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnswerDto {
  @IsNotEmpty()
  @IsNumberString()
  questionId!: string; // Error minta number string

  @IsNotEmpty()
  @IsString()
  answerText!: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @IsString()
  feedbackText?: string;

  @IsOptional()
  @IsNumberString()
  orderNumber?: string; // Error minta number string

  @IsOptional()
  @IsNumberString()
  pointsIfSelected?: string; // Error minta number string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  justificationForCorrect?: string;

  // Ini biar error "property metadataJson should not exist" ilang
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
