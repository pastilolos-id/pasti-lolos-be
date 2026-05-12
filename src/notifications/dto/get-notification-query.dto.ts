import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query untuk `GET /notifications/:id` — set `markRead=true` saat user membuka detail (satu request). */
export class GetNotificationQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  markRead?: boolean;
}
