import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ResolveReportDto {
  @IsDateString()
  resolveDate: string;

  @IsOptional()
  @IsString()
  resolutionComment?: string;
}