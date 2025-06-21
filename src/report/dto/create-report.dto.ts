// src/reports/dto/create-report.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ReportTargetType } from '../enum/report-target-type.enum';

export class CreateReportDto {
  @IsNotEmpty()
  target_id: number;

  @IsOptional()
  user_id: string;

  @IsEnum(ReportTargetType)
  @IsNotEmpty()
  target_type: ReportTargetType;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  reason: string;

  @IsString()
  target_url: string;

  @IsOptional()
  target_title: string;
}
