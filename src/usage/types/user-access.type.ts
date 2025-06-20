import { Prisma } from 'src/generated';

export type UserAccessWithPlan = Prisma.UserAccessGetPayload<{
  include: { plan: true };
}>;
