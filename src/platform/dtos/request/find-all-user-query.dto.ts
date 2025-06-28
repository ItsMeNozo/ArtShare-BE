import { IsEnum } from 'class-validator';
import { SharePlatform } from 'src/generated';

export class FindAllUserQuery {
  @IsEnum(SharePlatform)
  platformName: SharePlatform;
}
