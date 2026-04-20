import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsNumberString,
} from 'class-validator';

export class CreateTopicDto {
  @IsNotEmpty() @IsNumber() subjectId!: number;
  @IsNotEmpty() @IsString() topicName!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumberString() averageScore?: string;
  @IsOptional() @IsNumberString() quizAverageScore?: string;
  @IsOptional() @IsNumberString() totalQuestionsCount?: string;
  @IsOptional() @IsNumberString() totalLessonsCount?: string;
  // Tambahkan field lain sesuai skema Prisma lu
}
