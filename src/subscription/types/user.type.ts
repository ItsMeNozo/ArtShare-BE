import { Prisma } from 'src/generated';

export type UserWithUsageAndAccess = Prisma.UserGetPayload<{
  include: {
    userAccess: true;
    UserUsage: true;
  };
}>;
