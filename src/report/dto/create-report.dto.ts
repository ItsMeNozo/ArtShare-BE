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
  targetId: number;

  @IsOptional()
  userId: string;

  @IsEnum(ReportTargetType)
  @IsNotEmpty()
  targetType: ReportTargetType;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  reason: string;

  @IsString()
  targetUrl: string;

  @IsOptional()
  targetTitle: string;
}
