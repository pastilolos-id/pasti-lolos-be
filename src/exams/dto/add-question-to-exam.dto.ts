import { IsNotEmpty, IsNumberString, IsOptional } from 'class-validator';

export class AddQuestionToExamDto {
  @IsNotEmpty()
  @IsNumberString()
  examId: string;

  @IsNotEmpty()
  @IsNumberString()
  questionId: string;

  @IsOptional()
  @IsNumberString()
  orderInExam?: string;

  @IsOptional()
  @IsNumberString()
  pointsForQuestion?: string;
}
