import { Expose, Transform, Type } from 'class-transformer';
import { AutoProjectStatus, SharePlatform } from 'src/generated';

class PlatformInfo {
  @Expose()
  name: SharePlatform;
}

class ProjectCounts {
  @Expose()
  autoPosts: number;
}

export class AutoProjectListItemDto {
  @Expose()
  id: number;

  @Expose()
  title: string;

  @Expose()
  status: AutoProjectStatus;

  @Expose()
  platform: PlatformInfo;

  @Expose()
  @Transform(({ obj }) => (obj.platform ? [{ platform: obj.platform }] : []), {
    toClassOnly: true,
  })
  platforms: { platform: PlatformInfo }[];

  @Expose()
  @Type(() => ProjectCounts)
  _count: ProjectCounts;

  @Expose()
  nextPostAt: Date | null;
}

export class AutoProjectListResponseDto {
  @Expose()
  @Type(() => AutoProjectListItemDto)
  projects: AutoProjectListItemDto[];

  @Expose()
  total: number;
}
