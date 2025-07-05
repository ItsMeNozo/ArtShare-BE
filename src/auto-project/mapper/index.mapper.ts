import { AutoProjectListItemDto } from '../dto/response/auto-project-list-item.dto';
import { RawProjectResult } from '../types/index.type';

export const mapToAutoProjectListItemsDto = (
  projects: RawProjectResult[],
): AutoProjectListItemDto[] => {
  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    platform: {
      id: p.platformId,
      name: p.platformName,
    },
    postCount: p.postCount,
    nextPostAt: p.nextPostAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
};
