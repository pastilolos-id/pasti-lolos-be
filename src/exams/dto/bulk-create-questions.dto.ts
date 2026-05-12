import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
  IsUrl,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateAnswerNestedDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  answerText!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class QuestionItemDto {
  @IsString()
  @IsNotEmpty()
  questionText!: string;

  @IsOptional()
  @IsString()
  explanationText?: string;

  @IsOptional()
  @IsNumber()
  points?: number;

  @IsOptional()
  @IsString()
  difficultyLevel?: string;

  @IsNumber()
  @IsNotEmpty()
  orderInExam!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  imageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerNestedDto)
  answers!: CreateAnswerNestedDto[];
}

export class BulkCreateQuestionsDto {
  @IsNumber()
  @IsNotEmpty()
  examId!: number;

  @IsNumber()
  @IsNotEmpty()
  subjectId!: number;

  @IsOptional()
  @IsString()
  examTitle?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions!: QuestionItemDto[];
}
