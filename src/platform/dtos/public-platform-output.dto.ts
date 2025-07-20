import { PlatformStatus } from 'src/generated';

export class PublicPlatformOutputDto {
  id: string;
  name: string;
  category: string;
  platformDbId: number;
  status: PlatformStatus;
}
