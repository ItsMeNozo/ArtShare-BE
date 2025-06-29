import { plainToInstance } from 'class-transformer';
import { Prisma } from 'src/generated';
import { PostDetailsResponseDto } from '../dto/response/post-details.dto';
import { PostListItemResponse } from '../dto/response/post-list-item.dto';

export type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    likes: { select: { id: true } };
    medias: true;
    user: true;
    categories: true;
  };
}>;

export const mapPostListToDto = (
  posts: PostWithRelations[],
): PostListItemResponse[] => {
  const pojos = posts.map((p) => {
    const { likes, ...rest } = p;
    return {
      ...rest,
      isLikedByCurrentUser: likes.length > 0,
    };
  });

  return plainToInstance(PostListItemResponse, pojos);
};

export const mapPostToDto = (
  post: PostWithRelations,
): PostDetailsResponseDto => {
  const { likes, ...rest } = post;
  return plainToInstance(PostDetailsResponseDto, {
    ...rest,
    isLikedByCurrentUser: likes.length > 0,
  });
};
