import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDTO {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}
