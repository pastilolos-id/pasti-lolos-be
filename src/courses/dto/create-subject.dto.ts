import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumberString,
  IsBooleanString,
} from 'class-validator';

export class CreateSubjectDto {
  @IsNotEmpty() @IsString() subject_name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBooleanString() is_active?: string;
  @IsOptional() @IsNumberString() total_questions_count?: string;
  @IsOptional() @IsNumberString() total_courses_count?: string;
  @IsOptional() @IsString() average_difficulty?: string; // Float tetap masuk string
  @IsOptional() @IsString() related_field_of_study?: string;
  @IsOptional() @IsString() syllabus_outline?: string;
  @IsOptional() @IsString() suggested_grade_levels?: string;
  @IsOptional() @IsString() common_misconceptions?: string;
  @IsOptional() @IsString() key_concepts?: string;
  @IsOptional() @IsString() learning_objectives?: string;
  @IsOptional() @IsString() assessment_methods?: string;
  @IsOptional() @IsString() internal_notes?: string;
  @IsOptional() @IsNumberString() last_reviewed_by?: string;
  @IsOptional() @IsString() external_resource_links?: string;
  @IsOptional() @IsString() metadata_json?: string;
}
