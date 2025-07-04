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
  is_private: true,
  thumbnail_url: true,
  user_id: true,
  created_at: true,
  updated_at: true,
  posts: {
    orderBy: {
      post: {
        created_at: 'desc',
      },
    },
    select: {
      post: {
        select: {
          id: true,
          title: true,
          thumbnail_url: true,
          created_at: true,
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
  thumbnail_url: postOnCollection.post.thumbnail_url ?? undefined,
  created_at: postOnCollection.post.created_at,
});

export const mapCollectionToDto = (
  collection: SelectedCollectionPayload,
): CollectionDto => {
  const sortedPosts = collection.posts.map(mapSelectedPostToSummaryDto);

  return {
    id: collection.id,
    name: collection.name,
    is_private: collection.is_private,
    thumbnail_url: collection.thumbnail_url ?? undefined,
    description: collection.description ?? undefined,
    user_id: collection.user_id,
    created_at: collection.created_at,
    updated_at: collection.updated_at,
    posts: sortedPosts,
  };
};
