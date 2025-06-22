import { IsNumber, IsString } from 'class-validator';

export class UpdateAutoProjectDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  platform_id: number;
}
