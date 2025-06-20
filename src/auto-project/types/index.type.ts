import { AutoProjectStatus, SharePlatform } from 'src/generated';

export interface RawProjectResult {
  id: number;
  title: string;
  status: AutoProjectStatus;
  platformId: number;
  platformName: SharePlatform;
  postCount: number;
  nextPostAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}
