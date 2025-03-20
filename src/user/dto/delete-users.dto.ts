import { IsArray, IsInt, IsNotEmpty } from 'class-validator';

export class DeleteUsersDTO {
  @IsArray()
  @IsNotEmpty()
  @IsInt({ each: true })
  userIds: number[];
}
