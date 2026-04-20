import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional() @IsString() lesson_title?: string;
  @IsOptional() @IsString() lesson_type?: string;
  @IsOptional() @IsString() content_text?: string;
  @IsOptional() @IsNumberString() order_in_module?: string;
  @IsOptional() @IsString() is_preview?: string | boolean;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() attachments_json?: string;
  @IsOptional() @IsString() resource_links_json?: string;
}
