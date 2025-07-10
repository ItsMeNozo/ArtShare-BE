import { TargetType } from 'src/generated';

export class LikeDetailsDto {
  userId: string;
  targetId: number;
  targetType: TargetType;
  createdAt: Date;
}
