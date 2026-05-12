import { IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UserAnswerDto {
  @IsNumber()
  questionId!: number;

  @IsNumber()
  selectedAnswerId!: number;
}

export class SubmitExamDto {
  @IsNumber()
  userExamId!: number; // ID dari tabel UserExams (attempt yang lagi jalan)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserAnswerDto)
  answers!: UserAnswerDto[];
}
