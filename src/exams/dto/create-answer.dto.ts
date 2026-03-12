import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAnswerDto {
  @IsNotEmpty()
  @IsNumberString()
  questionId: string;

  @IsNotEmpty()
  @IsString()
  answerText: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @IsString()
  feedbackText?: string;

  @IsOptional()
  @IsNumberString()
  orderNumber?: string;

  @IsOptional()
  @IsNumberString()
  pointsIfSelected?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
