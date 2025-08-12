class PostMediaDto {
  url: string;
  mediaType: 'image' | 'video' | 'gif' | string;
}

class PostAuthorDto {
  username: string;
  fullName: string;
  profilePictureUrl: string | null;
}

export class PostDetailForViewDto {
  id: number;

  userId: string;

  title: string;

  description: string;

  createdAt: string;
  likeCount: number;

  commentCount: number;

  isMature: boolean;

  aiCreated: boolean;

  viewCount: number;

  medias: PostMediaDto[];

  user: PostAuthorDto;

  isLikedByCurrentUser: boolean;
}
