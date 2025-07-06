import { Collection, Post, Prisma } from 'src/generated';
import { CollectionDto } from '../dto/response/collection.dto';
import { PostSummaryDto } from '../dto/response/post-summary.dto';

export type CollectionWithPosts = Collection & {
  posts: Post[];
};

export const collectionWithPostsSelect = {
  id: true,
  name: true,
  description: true,
  isPrivate: true,
  thumbnailUrl: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  posts: {
    orderBy: {
      post: {
        createdAt: 'desc',
      },
    },
    select: {
      post: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          createdAt: true,
          likeCount: true,
          commentCount: true,
          viewCount: true,
        },
      },
    },
  },
} satisfies Prisma.CollectionSelect;

/**
 * This file contains the mapping functions and types for collections with posts.
 * The main exported function is `mapCollectionToDto`, which transforms the
 * selected collection payload into a `CollectionDto` object.
 */

export type SelectedCollectionPayload = Prisma.CollectionGetPayload<{
  select: typeof collectionWithPostsSelect;
}>;

const mapSelectedPostToSummaryDto = (
  postOnCollection: SelectedCollectionPayload['posts'][number],
): PostSummaryDto => ({
  id: postOnCollection.post.id,
  title: postOnCollection.post.title,
  thumbnailUrl: postOnCollection.post.thumbnailUrl ?? undefined,
  createdAt: postOnCollection.post.createdAt,
  likeCount: postOnCollection.post.likeCount ?? 0,
  commentCount: postOnCollection.post.commentCount ?? 0,
  viewCount: postOnCollection.post.viewCount ?? 0,
});

export const mapCollectionToDto = (
  collection: SelectedCollectionPayload,
): CollectionDto => {
  const sortedPosts = collection.posts.map(mapSelectedPostToSummaryDto);

  return {
    id: collection.id,
    name: collection.name,
    isPrivate: collection.isPrivate,
    thumbnailUrl: collection.thumbnailUrl ?? undefined,
    description: collection.description ?? undefined,
    userId: collection.userId,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    posts: sortedPosts,
  };
};
