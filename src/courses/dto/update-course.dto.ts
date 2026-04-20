import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional() @IsString() courseTitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumberString() subjectId?: string;
  @IsOptional() @IsNumberString() topicId?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() difficultyLevel?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() instructorId?: string;
}
