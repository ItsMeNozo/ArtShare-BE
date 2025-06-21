import { Injectable } from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { generatePaginatedResponse } from 'src/common/helpers/pagination.helper';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { PublicUserSearchResponseDto } from './dto/response/search-users.dto';
import { mapToPublicUserSearchDto } from './mapper/user-read.mapper';

@Injectable()
export class UserReadService {
  constructor(private prisma: PrismaService) {}

  async searchUsers(
    query: PaginationQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResponseDto<PublicUserSearchResponseDto>> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { full_name: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(currentUserId && {
        NOT: { id: currentUserId },
      }),
    };

    const [users, totalUsers] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    const mappedUsers = users.map((user) => mapToPublicUserSearchDto(user));

    return generatePaginatedResponse(mappedUsers, totalUsers, { page, limit });
  }
}
