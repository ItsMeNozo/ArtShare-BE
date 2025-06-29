export class PaginatedResponse<T> {
  readonly data: T[];
  readonly total: number | null;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number | null;
  readonly hasNextPage: boolean;
}
