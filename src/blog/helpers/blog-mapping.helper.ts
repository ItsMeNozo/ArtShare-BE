import { Prisma } from 'src/generated';
import { BlogDetailsResponseDto } from '../dto/response/blog-details.dto';
import { BlogListItemResponseDto } from '../dto/response/blog-list-item.dto';

type UserSelect = {
  id: true;
  username: true;
  profile_picture_url: true;
  full_name: true;
  followers_count: true;
};

export const blogListItemSelect = {
  id: true,
  title: true,
  content: true,
  created_at: true,
  like_count: true,
  comment_count: true,
  share_count: true,
  view_count: true,
  is_published: true,
  pictures: true,
  user: {
    select: {
      id: true,
      username: true,
      profile_picture_url: true,
      full_name: true,
      followers_count: true,
    },
  },
  updated_at: true,
};

export type BlogForListItemPayload = Prisma.BlogGetPayload<{
  select: typeof blogListItemSelect;
}>;

export type BlogWithUser = Prisma.BlogGetPayload<{
  include: {
    user: {
      select: UserSelect;
    };
  };
}>;

export type BlogWithRelations = Prisma.BlogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        full_name: true;
        profile_picture_url: true;
        followers_count: true;
      };
    };
    likes: { select: { id: true } };
  };
}>;

export const mapBlogToDetailsDto = (
  blog: BlogWithUser | BlogWithRelations | null,
): BlogDetailsResponseDto | null => {
  if (!blog || !blog.user) return null;

  const likeArray = Array.isArray((blog as any).likes)
    ? (blog as BlogWithRelations).likes
    : [];

  const isFollowedByCurrentUser = (blog.user as any).followers
    ? (blog.user as any).followers.length > 0
    : false;

  return {
    id: blog.id,
    title: blog.title,
    content: blog.content,
    created_at: blog.created_at,
    updated_at: blog.updated_at,
    is_published: blog.is_published,
    like_count: blog.like_count,
    comment_count: blog.comment_count,
    share_count: blog.share_count,
    view_count: blog.view_count,
    pictures: blog.pictures,
    embeddedVideos: blog.embedded_videos,
    user: {
      id: blog.user.id,
      username: blog.user.username,
      profile_picture_url: blog.user.profile_picture_url,
      full_name: blog.user.full_name,
      followers_count: blog.user.followers_count,
      is_following: isFollowedByCurrentUser,
    },
    isLikedByCurrentUser: likeArray.length > 0,
  };
};

export const mapBlogToListItemDto = (
  blog: BlogForListItemPayload | null,
): BlogListItemResponseDto | null => {
  if (!blog) {
    return null;
  }

  if (!blog.user) {
    console.warn(
      `Blog with ID ${blog.id} is missing expected user relation for DTO mapping (unexpected for selected payload).`,
    );
    return null;
  }

  return {
    id: blog.id,
    title: blog.title,
    content: blog.content,
    created_at: blog.created_at,
    updated_at: blog.updated_at,
    like_count: blog.like_count,
    comment_count: blog.comment_count,
    share_count: blog.share_count,
    view_count: blog.view_count,
    is_published: blog.is_published,
    pictures: blog.pictures,
    user: {
      id: blog.user.id,
      username: blog.user.username,
      profile_picture_url: blog.user.profile_picture_url,
      full_name: blog.user.full_name,
      followers_count: blog.user.followers_count,
      is_following: (blog.user as any).is_following ?? false,
    },
  };
};
