import { User } from './generated';
import { PostWithRelations } from './posts/mapper/posts-explore.mapper';

export const mockedPosts: PostWithRelations[] = Array.from(
  { length: 100 },
  (_, index) => ({
    id: index + 1,
    userId: `user-${index % 10}`,
    title: `Mocked Post Title ${index + 1}`,
    description: `Mocked description for post #${index + 1}`,
    createdAt: new Date(),
    isPublished: index % 2 === 0,
    isPrivate: index % 5 === 0,
    groupId: null,
    shareCount: Math.floor(Math.random() * 100),
    commentCount: Math.floor(Math.random() * 50),
    viewCount: Math.floor(Math.random() * 1000),
    likeCount: Math.floor(Math.random() * 200),
    thumbnailUrl: `https://picsum.photos/seed/post-${index}/400/300`,
    updatedAt: new Date(),
    isMature: false,
    aiCreated: index % 3 === 0,
    artGenerationId: null,
    thumbnailCropMeta: null,

    // Included relations
    likes: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
      id: index * 10 + i + 1,
    })),

    medias: Array.from({ length: 2 }, (_, i) => ({
      id: index * 10 + i + 1,
      postId: index + 1,
      mediaType: i % 2 === 0 ? 'image' : 'video',
      description: `Media ${i + 1} for post ${index + 1}`,
      url: `https://media.example.com/${index}-${i}`,
      downloads: Math.floor(Math.random() * 100),
      createdAt: new Date(),
      creatorId: `user-${index % 10}`,
    })),

    user: {
      id: `user-${index % 10}`,
      username: `mockuser${index % 10}`,
      email: `user${index % 10}@example.com`,
      fullName: `Mock User ${index % 10}`,
      profilePictureUrl: `https://i.pravatar.cc/150?u=user-${index % 10}`,
      bio: `This is a short bio for mock user ${index % 10}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      refreshToken: null,
      birthday: null,
      followersCount: 0,
      followingsCount: 0,
      stripeCustomerId: null,
      isOnboard: true,
      status: 'ACTIVE',
    },

    categories: [
      {
        id: 1,
        name: 'Digital Art',
        description: 'Artwork made with digital tools',
        exampleImages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'ATTRIBUTE',
      },
    ],
  }),
);

export const mockedUsers: User[] = Array.from({ length: 100 }, (_, index) => ({
  id: `user-${index + 1}`,
  username: `user${index + 1}`,
  email: `user${index + 1}@example.com`,
  fullName: `User ${index + 1}`,
  profilePictureUrl: `https://i.pravatar.cc/150?img=${index + 1}`,
  bio: `This is user ${index + 1}'s bio`,
  createdAt: new Date(),
  updatedAt: new Date(),
  refreshToken: null,
  birthday: null,
  followersCount: 0,
  followingsCount: 0,
  stripeCustomerId: null,
  isOnboard: true,
  status: 'ACTIVE',
}));
