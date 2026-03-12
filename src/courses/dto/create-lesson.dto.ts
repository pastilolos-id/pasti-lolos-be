import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
// Di dalam service atau file types
export interface LessonFiles {
  video?: Express.Multer.File[];
  pdf?: Express.Multer.File[];
}

// dto/create-lesson.dto.ts
export class CreateLessonDto {
  @IsNotEmpty()
  @IsNumberString()
  module_id: string;

  @IsNotEmpty()
  @IsString()
  lesson_title: string;

  @IsNotEmpty()
  @IsString()
  lesson_type: 'video' | 'text' | 'file' | 'assignment';

  @IsOptional()
  @IsString()
  content_text?: string;

  @IsOptional()
  @IsNumberString()
  order_in_module?: string;

  @IsOptional()
  @IsString()
  tags?: string; // Input: "#TWK, #Pancasila"
}
