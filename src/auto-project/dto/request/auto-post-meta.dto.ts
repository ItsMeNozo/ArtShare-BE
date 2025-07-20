import { IsDate, IsInt } from 'class-validator';

export class AutoPostMeta {
  @IsDate()
  scheduledAt: Date;

  @IsInt()
  imagesCount: number;
}
