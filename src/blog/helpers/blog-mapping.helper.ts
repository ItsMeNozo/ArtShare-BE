import { Prisma } from 'src/generated';
import { BlogDetailsResponseDto } from '../dto/response/blog-details.dto';

type UserSelect = {
  id: true;
  username: true;
  profilePictureUrl: true;
  fullName: true;
  followersCount: true;
};

export const blogListItemSelect = {
  id: true,
  title: true,
  content: true,
  createdAt: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  viewCount: true,
  isPublished: true,
  pictures: true,
  user: {
    select: {
      id: true,
      username: true,
      profilePictureUrl: true,
      fullName: true,
      followersCount: true,
    },
  },
  updatedAt: true,
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
        fullName: true;
        profilePictureUrl: true;
        followersCount: true;
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

  let isFollowedByCurrentUser = false;
  if (Array.isArray((blog.user as any).followers)) {
    isFollowedByCurrentUser = (blog.user as any).followers.length > 0;
  }

  return {
    id: blog.id,
    title: blog.title,
    content: blog.content,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    isPublished: blog.isPublished,
    likeCount: blog.likeCount,
    commentCount: blog.commentCount,
    shareCount: blog.shareCount,
    viewCount: blog.viewCount,
    pictures: blog.pictures,
    embeddedVideos: blog.embeddedVideos,
    user: {
      id: blog.user.id,
      username: blog.user.username,
      profilePictureUrl: blog.user.profilePictureUrl,
      fullName: blog.user.fullName,
      followersCount: blog.user.followersCount,
      isFollowing: isFollowedByCurrentUser,
    },
    isLikedByCurrentUser: likeArray.length > 0,
  };
};
