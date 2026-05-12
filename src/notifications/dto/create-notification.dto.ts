import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreateNotificationDto {
  @Type(() => Number)
  @IsInt()
  userId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsIn(['info', 'success', 'warning', 'error'])
  type?: string;

  @IsOptional()
  @IsString()
  link?: string | null;
}
