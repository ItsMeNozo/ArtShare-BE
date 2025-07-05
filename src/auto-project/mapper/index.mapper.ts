import { Prisma } from 'src/generated';
import { AutoProjectDetailsDto } from '../dto/response/auto-project-details.dto';
import { AutoProjectListItemDto } from '../dto/response/auto-project-list-item.dto';
import { RawProjectResult } from '../types/index.type';

type AutoProjectWithRelations = Prisma.AutoProjectGetPayload<{
  include: {
    platform: true;
  };
}>;
export const mapToAutoProjectDetailsDto = (
  project: AutoProjectWithRelations,
): AutoProjectDetailsDto => {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    platform: {
      id: project.platform.id,
      name: project.platform.name,
      externalPageId: project.platform.externalPageId,
      tokenExpiresAt: project.platform.tokenExpiresAt,
      status: project.platform.status,
    },
  };
};

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
