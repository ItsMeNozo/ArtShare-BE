import { IsNumber, IsString } from 'class-validator';
import { AutoProjectStatus } from 'src/generated';

export class UpdateAutoProjectDto {
  @IsString()
  title?: string;

  @IsString()
  description?: string;

  @IsNumber()
  platformId?: number;

  @IsString()
  status?: AutoProjectStatus;
}
