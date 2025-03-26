/* eslint-disable */
export default async () => {
  const t = {
    ['./posts/dto/response/media.dto']: await import(
      './posts/dto/response/media.dto'
    ),
    ['./posts/dto/response/user.dto']: await import(
      './posts/dto/response/user.dto'
    ),
    ['./posts/dto/response/category.dto']: await import(
      './posts/dto/response/category.dto'
    ),
    ['./posts/dto/response/post-details.dto']: await import(
      './posts/dto/response/post-details.dto'
    ),
    ['./posts/dto/response/post-list-item.dto']: await import(
      './posts/dto/response/post-list-item.dto'
    ),
    ['./likes/dto/response/like-details.dto']: await import(
      './likes/dto/response/like-details.dto'
    ),
    ['./storage/dto/response.dto']: await import('./storage/dto/response.dto'),
  };
  return {
    '@nestjs/swagger': {
      models: [
        [
          import('./storage/dto/request.dto'),
          {
            GetPresignedUrlRequestDto: {
              fileName: { required: true, type: () => String, default: '' },
              extension: {
                required: true,
                type: () => String,
                pattern: '/^(png|jpg|jpeg|gif|webp|mp4|mov|avi)$/i',
              },
              mediaType: { required: true, type: () => Object },
              directory: {
                required: false,
                type: () => String,
                default: 'uncategorized',
              },
            },
          },
        ],
        [
          import('./storage/dto/response.dto'),
          {
            GetPresignedUrlResponseDto: {
              url: { required: true, type: () => String },
              key: { required: true, type: () => String },
            },
            FileUploadResponse: {
              url: { required: true, type: () => String },
              key: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./posts/dto/request/create-post.dto'),
          {
            CreatePostDto: {
              title: { required: true, type: () => String },
              description: { required: false, type: () => String },
              video_url: { required: false, type: () => String },
              cate_ids: { required: true, type: () => [Number] },
            },
          },
        ],
        [
          import('./posts/dto/response/media.dto'),
          {
            MediaResponseDto: {
              id: { required: true, type: () => Number },
              media_type: { required: true, type: () => Object },
              description: { required: false, type: () => String },
              url: { required: true, type: () => String },
              creator_id: { required: true, type: () => String },
              downloads: { required: true, type: () => Number },
              created_at: { required: true, type: () => Date },
            },
          },
        ],
        [
          import('./posts/dto/response/user.dto'),
          {
            UserResponseDto: {
              id: { required: true, type: () => String },
              username: { required: true, type: () => String },
              email: { required: true, type: () => String },
              password_hash: { required: true, type: () => String },
              full_name: { required: true, type: () => String },
              profile_picture_url: { required: true, type: () => String },
              bio: { required: true, type: () => String },
              created_at: { required: true, type: () => Date },
              updated_at: { required: true, type: () => Date },
              refresh_token: { required: true, type: () => String },
            },
          },
        ],
        [
          import('./posts/dto/response/category.dto'),
          {
            CategoryResponseDto: {
              cate_id: { required: true, type: () => Number },
              cate_name: { required: true, type: () => String },
              url: { required: true, type: () => String, nullable: true },
              created_at: { required: true, type: () => Date },
            },
          },
        ],
        [
          import('./posts/dto/response/post-details.dto'),
          {
            PostDetailsResponseDto: {
              id: { required: true, type: () => Number },
              user_id: { required: true, type: () => String },
              title: { required: true, type: () => String },
              description: { required: false, type: () => String },
              thumbnail_url: { required: true, type: () => String },
              is_published: { required: true, type: () => Boolean },
              is_private: { required: true, type: () => Boolean },
              like_count: { required: true, type: () => Number },
              share_count: { required: true, type: () => Number },
              comment_count: { required: true, type: () => Number },
              created_at: { required: true, type: () => Date },
              medias: {
                required: true,
                type: () => [
                  t['./posts/dto/response/media.dto'].MediaResponseDto,
                ],
              },
              user: {
                required: true,
                type: () => t['./posts/dto/response/user.dto'].UserResponseDto,
              },
              categories: {
                required: true,
                type: () => [
                  t['./posts/dto/response/category.dto'].CategoryResponseDto,
                ],
              },
            },
          },
        ],
        [
          import('./posts/dto/request/update-post.dto'),
          {
            UpdatePostDto: {
              title: { required: false, type: () => String },
              description: { required: false, type: () => String },
              thumbnail_url: { required: false, type: () => String },
              video_url: { required: false, type: () => String },
              cate_ids: { required: false, type: () => [Number] },
            },
          },
        ],
        [
          import('./posts/dto/response/post-list-item.dto'),
          {
            PostListItemResponseDto: {
              id: { required: true, type: () => Number },
              user_id: { required: true, type: () => String },
              title: { required: true, type: () => String },
              description: { required: false, type: () => String },
              thumbnail_url: { required: true, type: () => String },
              is_published: { required: true, type: () => Boolean },
              is_private: { required: true, type: () => Boolean },
              like_count: { required: true, type: () => Number },
              share_count: { required: true, type: () => Number },
              comment_count: { required: true, type: () => Number },
              created_at: { required: true, type: () => Date },
              medias: {
                required: true,
                type: () => [
                  t['./posts/dto/response/media.dto'].MediaResponseDto,
                ],
              },
              user: {
                required: true,
                type: () => t['./posts/dto/response/user.dto'].UserResponseDto,
              },
              categories: {
                required: true,
                type: () => [
                  t['./posts/dto/response/category.dto'].CategoryResponseDto,
                ],
              },
            },
          },
        ],
        [
          import('./likes/dto/request/create-like.dto'),
          {
            CreateLikeDto: {
              target_id: { required: true, type: () => Number },
              target_type: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('./likes/dto/response/like-details.dto'),
          {
            LikeDetailsDto: {
              user_id: { required: true, type: () => String },
              target_id: { required: true, type: () => Number },
              target_type: { required: true, type: () => Object },
              created_at: { required: true, type: () => Date },
            },
          },
        ],
        [
          import('./likes/dto/request/remove-like.dto'),
          {
            RemoveLikeDto: {
              target_id: { required: true, type: () => Number },
              target_type: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('./shares/dto/create-share.dto'),
          {
            CreateShareDto: {
              target_id: { required: true, type: () => Number },
              target_type: { required: true, type: () => Object },
              share_platform: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('./shares/dto/remove-share.dto'),
          {
            RemoveShareDto: {
              target_id: { required: true, type: () => Number },
              target_type: { required: true, type: () => Object },
            },
          },
        ],
        [
          import('./posts/dto/request/media.dto'),
          {
            MediaDto: {
              url: { required: true, type: () => String },
              media_type: { required: true, type: () => Object },
            },
          },
        ],
      ],
      controllers: [
        [
          import('./app.controller'),
          { AppController: { getHello: { type: String } } },
        ],
        [
          import('./posts/posts.controller'),
          {
            PostsController: {
              createPost: { type: Object },
              updatePost: {
                type: t['./posts/dto/response/post-details.dto']
                  .PostDetailsResponseDto,
              },
              deletePost: {},
              searchPosts: {
                type: [
                  t['./posts/dto/response/post-list-item.dto']
                    .PostListItemResponseDto,
                ],
              },
              getForYouPosts: {},
              getFollowingPosts: {
                type: [
                  t['./posts/dto/response/post-list-item.dto']
                    .PostListItemResponseDto,
                ],
              },
              getPostDetails: {
                type: t['./posts/dto/response/post-details.dto']
                  .PostDetailsResponseDto,
              },
            },
          },
        ],
        [
          import('./auth/auth.controller'),
          {
            AuthController: {
              signup: { type: Object },
              login: {},
              signout: {},
              verifyToken: { type: Object },
            },
          },
        ],
        [
          import('./likes/likes.controller'),
          {
            LikesController: {
              createLike: {
                type: t['./likes/dto/response/like-details.dto'].LikeDetailsDto,
              },
              removeLike: {},
            },
          },
        ],
        [
          import('./shares/shares.controller'),
          { SharesController: { createShare: {}, removeShare: {} } },
        ],
        [
          import('./storage/storage.controller'),
          {
            StorageController: {
              getPresignedUrl: {
                type: t['./storage/dto/response.dto']
                  .GetPresignedUrlResponseDto,
              },
            },
          },
        ],
        [
          import('./user/user.controller'),
          {
            UserController: {
              findAll: { type: Object },
              create: {},
              update: {},
              remove: { type: Object },
            },
          },
        ],
      ],
    },
  };
};
