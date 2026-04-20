import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class CreateQuestionDto {
  @IsNotEmpty()
  @IsString()
  questionText!: string;

  @IsNotEmpty()
  @IsEnum(['multiple_choice', 'essay', 'true_false', 'fill_in_the_blank'])
  questionType!: string;

  @IsNotEmpty()
  @IsNumberString()
  subjectId!: string;

  @IsOptional()
  @IsNumberString()
  topicId?: string;

  @IsOptional()
  @IsNumberString()
  questionBankId?: string;

  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'])
  difficultyLevel?: string;

  @IsOptional()
  @IsString()
  explanationText?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsNumberString()
  points?: string;

  @IsOptional()
  @IsNumberString()
  timeLimitPerQuestion?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsNumberString()
  examId?: string; // ID Ujian yang mau dikoneksikan

  @IsOptional()
  @IsNumberString()
  orderInExam?: string; // Urutan soal dalam ujian, kalau mau langsung masukin ke exam
}
