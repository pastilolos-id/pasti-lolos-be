import { IsNumber, IsNotEmpty } from 'class-validator';

export class CompleteLessonDto {
  @IsNotEmpty()
  @IsNumber()
  lesson_id!: number;
}
