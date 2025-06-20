import { Prisma } from '@prisma/client';
import { AutoProjectDetailsDto } from '../dto/response/auto-project-details.dto';

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
    created_at: project.created_at,
    updated_at: project.updated_at,
    platform: {
      id: project.platform.id,
      name: project.platform.name,
      external_page_id: project.platform.external_page_id,
      token_expires_at: project.platform.token_expires_at,
      status: project.platform.status,
    },
  };
};
