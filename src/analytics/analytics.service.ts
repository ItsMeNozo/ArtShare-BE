import { Injectable } from '@nestjs/common';
import {
  differenceInMilliseconds,
  eachDayOfInterval,
  format,
  subDays,
} from 'date-fns';
import { PrismaService } from 'src/prisma.service';
import {
  AiContentEngagementDto,
  CategoryPostCountDto,
  ContentFunnelDto,
  FollowerEngagementTierDto,
  OverallPostStatsDto,
  OverallUserStatsDto,
  PlanContentInsightDto,
  PlatformWideStatsDto,
  PopularCategoriesDto,
  PopularCategoryDto,
  PostsByCategoryDto,
  TimePointDto,
  TimeSeriesDataDto,
  TimeToActionDto,
} from './dto';

const HOURS_IN_MILLISECOND = 1000 * 60 * 60;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverallUserStats(): Promise<OverallUserStatsDto> {
    const totalUsers = await this.prisma.user.count();
    const thirtyDaysAgo = subDays(new Date(), 30);

    const newUsersLast30Days = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const onboardedUsers = await this.prisma.user.count({
      where: { isOnboard: true },
    });

    const onboardingCompletionRate =
      totalUsers > 0 ? (onboardedUsers / totalUsers) * 100 : 0;

    return {
      totalUsers,
      newUsersLast30Days,
      onboardedUsers,
      onboardingCompletionRate: parseFloat(onboardingCompletionRate.toFixed(2)),
    };
  }

  async getOverallPostStats(): Promise<OverallPostStatsDto> {
    const totalPosts = await this.prisma.post.count();
    const thirtyDaysAgo = subDays(new Date(), 30);

    const newPostsLast30Days = await this.prisma.post.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const publishedPosts = await this.prisma.post.count({
      where: { isPublished: true },
    });
    const draftPosts = totalPosts - publishedPosts;

    const privatePosts = await this.prisma.post.count({
      where: { isPrivate: true },
    });
    const publicPosts = totalPosts - privatePosts;

    const aiCreatedPosts = await this.prisma.post.count({
      where: { aiCreated: true },
    });

    const matureContentPosts = await this.prisma.post.count({
      where: { isMature: true },
    });

    return {
      totalPosts,
      newPostsLast30Days,
      publishedPosts,
      draftPosts,
      privatePosts,
      publicPosts,
      aiCreatedPosts,
      matureContentPosts,
    };
  }

  async getPostsByCategory(): Promise<PostsByCategoryDto> {
    const categoriesWithPostCounts = await this.prisma.category.findMany({
      select: {
        name: true,
        _count: {
          select: { posts: true },
        },
      },
      orderBy: {
        posts: {
          _count: 'desc',
        },
      },
    });

    const data: CategoryPostCountDto[] = categoriesWithPostCounts.map(
      (cat) => ({
        categoryName: cat.name,
        postCount: cat._count.posts,
      }),
    );

    return { data };
  }

  async getPopularCategories(
    limit: number = 5,
    sortBy: 'postCount' | 'engagement' = 'postCount',
  ): Promise<PopularCategoriesDto> {
    let popularCategoriesData: PopularCategoryDto[] = [];

    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        posts: {
          select: {
            likeCount: true,
            commentCount: true,
            viewCount: true,
            shareCount: true,
          },
        },
        _count: {
          select: { posts: true },
        },
      },
    });

    popularCategoriesData = categories.map((category) => {
      let totalEngagementScore = 0;
      category.posts.forEach((post) => {
        totalEngagementScore +=
          (post.likeCount || 0) +
          (post.commentCount || 0) * 2 +
          (post.viewCount || 0) * 0.5 +
          (post.shareCount || 0) * 3;
      });
      return {
        categoryName: category.name,
        postCount: category._count.posts,
        totalEngagementScore: parseFloat(totalEngagementScore.toFixed(2)),
      };
    });

    if (sortBy === 'postCount') {
      popularCategoriesData.sort((a, b) => b.postCount - a.postCount);
    } else if (sortBy === 'engagement') {
      popularCategoriesData.sort(
        (a, b) => b.totalEngagementScore - a.totalEngagementScore,
      );
    }

    return { data: popularCategoriesData.slice(0, limit) };
  }

  async getPlatformWideStats(): Promise<PlatformWideStatsDto> {
    const contentFunnel = await this.getContentFunnelStats();
    const followerEngagementInsights =
      await this.getFollowerEngagementInsights();
    const planContentInsights = await this.getPlanContentInsights();
    const aiContentEngagement = await this.getAiContentEngagement();
    const timeToAction = await this.getTimeToActionStats();

    return {
      contentFunnel,
      followerEngagementInsights,
      planContentInsights,
      aiContentEngagement,
      timeToAction,
    };
  }

  private calculateAverage(sum: number, count: number, precision = 2): number {
    if (count === 0) return 0;
    return parseFloat((sum / count).toFixed(precision));
  }

  private async getContentFunnelStats(): Promise<ContentFunnelDto> {
    const usersWhoPostedCount = await this.prisma.user.count({
      where: { posts: { some: {} } },
    });

    const postsWithViewsCount = await this.prisma.post.count({
      where: { viewCount: { gt: 0 } },
    });

    const postsWithEngagementCount = await this.prisma.post.count({
      where: {
        OR: [{ likeCount: { gt: 0 } }, { commentCount: { gt: 0 } }],
      },
    });

    return {
      usersWhoPostedCount,
      postsWithViewsCount,
      postsWithEngagementCount,
    };
  }

  private async getFollowerEngagementInsights(): Promise<
    FollowerEngagementTierDto[]
  > {
    const tiers = [
      { description: '0-100 followers', min: 0, max: 100 },
      { description: '101-1000 followers', min: 101, max: 1000 },
      { description: '>1000 followers', min: 1001, max: Infinity },
    ];

    const insights: FollowerEngagementTierDto[] = [];

    for (const tier of tiers) {
      const stats = await this.prisma.post.aggregate({
        where: {
          user: {
            followersCount: {
              gte: tier.min,
              lte: tier.max === Infinity ? undefined : tier.max,
            },
          },
        },
        _avg: {
          likeCount: true,
          commentCount: true,
        },
        _count: { id: true },
      });

      insights.push({
        tierDescription: tier.description,
        averageLikesPerPost: parseFloat(
          (stats._avg?.likeCount || 0).toFixed(2),
        ),
        averageCommentsPerPost: parseFloat(
          (stats._avg?.commentCount || 0).toFixed(2),
        ),
        postsAnalyzed: stats._count?.id || 0,
      });
    }
    return insights;
  }

  private async getPlanContentInsights(): Promise<PlanContentInsightDto[]> {
    const plans = await this.prisma.plan.findMany({
      select: { id: true, name: true },
    });
    const insights: PlanContentInsightDto[] = [];

    for (const plan of plans) {
      const usersOnPlanCount = await this.prisma.user.count({
        where: { userAccess: { planId: plan.id } },
      });

      let averagePostsPerUserOnPlan = 0;
      if (usersOnPlanCount > 0) {
        const postsByUsersOnPlanCount = await this.prisma.post.count({
          where: { user: { userAccess: { planId: plan.id } } },
        });
        averagePostsPerUserOnPlan = this.calculateAverage(
          postsByUsersOnPlanCount,
          usersOnPlanCount,
        );
      }

      const engagementStats = await this.prisma.post.aggregate({
        where: { user: { userAccess: { planId: plan.id } } },
        _avg: { likeCount: true, commentCount: true },
        _count: { id: true },
      });

      insights.push({
        planName: plan.name,
        averagePostsPerUserOnPlan,
        averageLikesPerPostByUsersOnPlan: parseFloat(
          (engagementStats._avg?.likeCount || 0).toFixed(2),
        ),
        averageCommentsPerPostByUsersOnPlan: parseFloat(
          (engagementStats._avg?.commentCount || 0).toFixed(2),
        ),
        postsAnalyzedForEngagement: engagementStats._count?.id || 0,
        usersAnalyzedForPostCount: usersOnPlanCount,
      });
    }
    return insights;
  }

  private async getAiContentEngagement(): Promise<AiContentEngagementDto> {
    const aiStats = await this.prisma.post.aggregate({
      where: { aiCreated: true },
      _avg: { likeCount: true, commentCount: true, viewCount: true },
      _count: { id: true },
    });

    const nonAiStats = await this.prisma.post.aggregate({
      where: { aiCreated: false },
      _avg: { likeCount: true, commentCount: true, viewCount: true },
      _count: { id: true },
    });

    return {
      averageLikesAiPosts: parseFloat(
        (aiStats._avg?.likeCount || 0).toFixed(2),
      ),
      averageCommentsAiPosts: parseFloat(
        (aiStats._avg?.commentCount || 0).toFixed(2),
      ),
      averageViewsAiPosts: parseFloat(
        (aiStats._avg?.viewCount || 0).toFixed(2),
      ),
      aiPostsAnalyzed: aiStats._count?.id || 0,
      averageLikesNonAiPosts: parseFloat(
        (nonAiStats._avg?.likeCount || 0).toFixed(2),
      ),
      averageCommentsNonAiPosts: parseFloat(
        (nonAiStats._avg?.commentCount || 0).toFixed(2),
      ),
      averageViewsNonAiPosts: parseFloat(
        (nonAiStats._avg?.viewCount || 0).toFixed(2),
      ),
      nonAiPostsAnalyzed: nonAiStats._count?.id || 0,
    };
  }

  private async getTimeToActionStats(): Promise<TimeToActionDto> {
    const usersWithFirstPost = await this.prisma.user.findMany({
      where: { posts: { some: {} } },
      select: {
        createdAt: true,
        posts: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    let totalMillisToFirstPost = 0;
    let usersCountedForFirstPost = 0;
    for (const user of usersWithFirstPost) {
      if (user.posts.length > 0) {
        const diff = differenceInMilliseconds(
          user.posts[0].createdAt,
          user.createdAt,
        );
        if (diff >= 0) {
          totalMillisToFirstPost += diff;
          usersCountedForFirstPost++;
        }
      }
    }
    const avgMillisToFirstPost =
      usersCountedForFirstPost > 0
        ? totalMillisToFirstPost / usersCountedForFirstPost
        : null;
    const avgHoursSignupToFirstPost =
      avgMillisToFirstPost !== null
        ? parseFloat((avgMillisToFirstPost / HOURS_IN_MILLISECOND).toFixed(2))
        : null;

    const postsWithInteractionMeta = await this.prisma.post.findMany({
      where: {
        OR: [{ likeCount: { gt: 0 } }, { commentCount: { gt: 0 } }],
      },
      select: { id: true, createdAt: true },
    });

    let avgHoursPostToFirstInteraction: number | null = null;

    if (postsWithInteractionMeta.length > 0) {
      const postMap = new Map<number, Date>(
        postsWithInteractionMeta.map((p) => [p.id, p.createdAt]),
      );
      const postIds = postsWithInteractionMeta.map((p) => p.id);

      const firstLikesData = await this.prisma.like.groupBy({
        by: ['postId'],
        where: {
          postId: { in: postIds },
        },
        _min: {
          createdAt: true,
        },
        having: {
          postId: {
            not: null,
          },
        },
      });
      const firstLikesMap = new Map<number, Date>();
      firstLikesData.forEach((l) => {
        if (l.postId !== null && l._min.createdAt) {
          firstLikesMap.set(l.postId, l._min.createdAt);
        }
      });

      const firstCommentsData = await this.prisma.comment.groupBy({
        by: ['targetId'],
        where: {
          targetId: { in: postIds },
          targetType: 'POST',
        },
        _min: {
          createdAt: true,
        },
      });
      const firstCommentsMap = new Map<number, Date>();
      firstCommentsData.forEach((c) => {
        if (c.targetId && c._min.createdAt) {
          firstCommentsMap.set(c.targetId, c._min.createdAt);
        }
      });

      let totalMillisToFirstInteraction = 0;
      let postsCountedForFirstInteraction = 0;

      for (const postId of postIds) {
        const postCreatedAt = postMap.get(postId);
        if (!postCreatedAt) continue;

        const firstLikeTime = firstLikesMap.get(postId);
        const firstCommentTime = firstCommentsMap.get(postId);
        let firstInteractionTime: Date | undefined = undefined;

        if (firstLikeTime && firstCommentTime) {
          firstInteractionTime =
            firstLikeTime < firstCommentTime ? firstLikeTime : firstCommentTime;
        } else if (firstLikeTime) {
          firstInteractionTime = firstLikeTime;
        } else if (firstCommentTime) {
          firstInteractionTime = firstCommentTime;
        }

        if (firstInteractionTime) {
          const diff = differenceInMilliseconds(
            firstInteractionTime,
            postCreatedAt,
          );
          if (diff >= 0) {
            totalMillisToFirstInteraction += diff;
            postsCountedForFirstInteraction++;
          }
        }
      }

      if (postsCountedForFirstInteraction > 0) {
        const avgMillisToFirstInteraction =
          totalMillisToFirstInteraction / postsCountedForFirstInteraction;
        avgHoursPostToFirstInteraction = parseFloat(
          (avgMillisToFirstInteraction / HOURS_IN_MILLISECOND).toFixed(2),
        );
      }
    }

    return {
      avgHoursSignupToFirstPost,
      avgHoursPostToFirstInteraction,
    };
  }

  async getUsersOverTime(days: number = 30): Promise<TimeSeriesDataDto> {
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1); // N days including today

    // Get daily new user counts
    const dailyNewUsers = await this.prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate, // Ensure we don't go beyond today for cumulative
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get total users before the start date for cumulative calculation
    const usersBeforeStartDate = await this.prisma.user.count({
      where: { createdAt: { lt: startDate } },
    });

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    let cumulativeUsers = usersBeforeStartDate;
    const timeSeries: TimePointDto[] = [];

    // Map daily new users to a dictionary for quick lookup
    const newUsersMap = new Map<string, number>();
    dailyNewUsers.forEach((record) => {
      const dateStr = format(new Date(record.createdAt), 'yyyy-MM-dd'); // Group by day
      newUsersMap.set(
        dateStr,
        (newUsersMap.get(dateStr) || 0) + (record._count?.id || 0),
      );
    });

    for (const day of allDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      cumulativeUsers += newUsersMap.get(dateStr) || 0;
      timeSeries.push({ date: dateStr, count: cumulativeUsers });
    }

    return { data: timeSeries };
  }

  async getPostsOverTime(days: number = 30): Promise<TimeSeriesDataDto> {
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);

    const dailyNewPosts = await this.prisma.post.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const postsBeforeStartDate = await this.prisma.post.count({
      where: { createdAt: { lt: startDate } },
    });

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    let cumulativePosts = postsBeforeStartDate;
    const timeSeries: TimePointDto[] = [];

    const newPostsMap = new Map<string, number>();
    dailyNewPosts.forEach((record) => {
      const dateStr = format(new Date(record.createdAt), 'yyyy-MM-dd');
      newPostsMap.set(
        dateStr,
        (newPostsMap.get(dateStr) || 0) + (record._count?.id || 0),
      );
    });

    for (const day of allDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      cumulativePosts += newPostsMap.get(dateStr) || 0;
      timeSeries.push({ date: dateStr, count: cumulativePosts });
    }
    return { data: timeSeries };
  }
}
