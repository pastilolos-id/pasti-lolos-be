import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional() @IsString() course_title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumberString() subject_id?: string;
  @IsOptional() @IsNumberString() topic_id?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() difficulty_level?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() instructor_id?: string;
}
