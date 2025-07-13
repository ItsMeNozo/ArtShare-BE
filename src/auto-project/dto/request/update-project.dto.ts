import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AutoProjectStatus } from 'src/generated';
import { CreateAutoProjectDto } from './create-project.dto';

export class UpdateAutoProjectDto extends CreateAutoProjectDto {
  @IsString()
  @IsOptional()
  @IsEnum(AutoProjectStatus)
  status?: AutoProjectStatus;
}
