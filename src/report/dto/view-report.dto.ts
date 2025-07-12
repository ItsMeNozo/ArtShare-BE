// src/reports/dto/view-reports.dto.ts
import { IsEnum, IsNumberString, IsOptional } from 'class-validator';

export enum ViewTab {
  ALL = 'all',
  USER = 'user',
  POST = 'post',
  BLOG = 'blog',
  COMMENT = 'comment',
}

export class ViewReportsDto {
  /** Chọn tab muốn xem: user/post/blog/comment/all */
  @IsOptional()
  @IsEnum(ViewTab)
  tab?: ViewTab;

  /** Số bản ghi bỏ qua */
  @IsOptional()
  @IsNumberString()
  skip?: string;

  /** Số bản ghi lấy về */
  @IsOptional()
  @IsNumberString()
  take?: string;
}
