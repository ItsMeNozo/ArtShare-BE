import { IsArray } from "class-validator";


export class BulkDeleteBlogsDto {
  @IsArray()
  ids: number[];
}
