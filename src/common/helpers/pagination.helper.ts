import { PaginatedResponse } from '../dto/paginated-response.dto';

interface PaginationOptions {
  page: number;
  limit: number;
}

export function generatePaginatedResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions,
): PaginatedResponse<T> {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

/**
 * A generic method to generate a paginated response DTO with an unknown total count.
 * @param dataWithExtra The data array, which may include an extra item for pagination purposes.
 * @param options The pagination options containing page and limit.
 * @returns A PaginatedResponseDto
 */
export function generatePaginatedResponseWithUnknownTotal<T>(
  dataWithExtra: T[],
  options: PaginationOptions,
): PaginatedResponse<T> {
  const { page, limit } = options;

  const hasNextPage = dataWithExtra.length > limit;
  if (hasNextPage) {
    dataWithExtra.pop();
  }

  return {
    data: dataWithExtra,
    total: null,
    page,
    limit,
    totalPages: null,
    hasNextPage,
  };
}
