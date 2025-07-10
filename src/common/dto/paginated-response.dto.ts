export class PaginatedResponse<T> {
  readonly data: T[];
  readonly total: number | null;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number | null;
  readonly hasNextPage: boolean;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNextPage = page < this.totalPages;
  }
}
