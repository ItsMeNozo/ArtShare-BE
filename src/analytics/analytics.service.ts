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
    const thirtyDaysAgo = subDays(new Date(), 30);

    // Use a single raw SQL query to get all user counts
    // We use COUNT(CASE WHEN ...) for conditional aggregation.
    // ::int casts the BigInt result of COUNT to an integer for JS compatibility.
    const [stats] = await this.prisma.$queryRaw<
      {
        totalUsers: number;
        newUsersLast30Days: number;
        onboardedUsers: number;
      }[]
    >`
      SELECT
          COUNT(id)::int AS "totalUsers",
          COUNT(CASE WHEN "created_at" >= ${thirtyDaysAgo} THEN 1 END)::int AS "newUsersLast30Days",
          COUNT(CASE WHEN "is_onboard" = true THEN 1 END)::int AS "onboardedUsers"
      FROM "public"."user";
    `;

    const totalUsers = stats.totalUsers;
    const newUsersLast30Days = stats.newUsersLast30Days;
    const onboardedUsers = stats.onboardedUsers;

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
    const thirtyDaysAgo = subDays(new Date(), 30);

    const [stats] = await this.prisma.$queryRaw<
      {
        totalPosts: number;
        newPostsLast30Days: number;
        publishedPosts: number;
        privatePosts: number;
        aiCreatedPosts: number;
        matureContentPosts: number;
      }[]
    >`
      SELECT
          COUNT(id)::int AS "totalPosts",
          COUNT(CASE WHEN "created_at" >= ${thirtyDaysAgo} THEN 1 END)::int AS "newPostsLast30Days",
          COUNT(CASE WHEN "is_published" = true THEN 1 END)::int AS "publishedPosts",
          COUNT(CASE WHEN "is_private" = true THEN 1 END)::int AS "privatePosts",
          COUNT(CASE WHEN "ai_created" = true THEN 1 END)::int AS "aiCreatedPosts",
          COUNT(CASE WHEN "is_mature" = true THEN 1 END)::int AS "matureContentPosts"
      FROM "public"."post";
    `;

    const draftPosts = stats.totalPosts - stats.publishedPosts;
    const publicPosts = stats.totalPosts - stats.privatePosts;

    return {
      totalPosts: stats.totalPosts,
      newPostsLast30Days: stats.newPostsLast30Days,
      publishedPosts: stats.publishedPosts,
      draftPosts,
      privatePosts: stats.privatePosts,
      publicPosts,
      aiCreatedPosts: stats.aiCreatedPosts,
      matureContentPosts: stats.matureContentPosts,
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
    const [
      contentFunnel,
      followerEngagementInsights,
      planContentInsights,
      aiContentEngagement,
      timeToAction,
    ] = await Promise.all([
      this.getContentFunnelStats(),
      this.getFollowerEngagementInsights(),
      this.getPlanContentInsights(),
      this.getAiContentEngagement(),
      this.getTimeToActionStats(),
    ]);

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
    const [stats] = await this.prisma.$queryRaw<
      {
        usersWhoPostedCount: number;
        postsWithViewsCount: number;
        postsWithEngagementCount: number;
      }[]
    >`
      SELECT
          -- Count of unique users who have posted at least one post
          (SELECT COUNT(DISTINCT "user_id") FROM "public"."post")::int AS "usersWhoPostedCount",
          -- Count of posts with at least one view
          COUNT(CASE WHEN "view_count" > 0 THEN 1 END)::int AS "postsWithViewsCount",
          -- Count of posts with at least one like or comment
          COUNT(CASE WHEN ("like_count" > 0 OR "comment_count" > 0) THEN 1 END)::int AS "postsWithEngagementCount"
      FROM "public"."post";
    `;

    return {
      usersWhoPostedCount: stats.usersWhoPostedCount || 0,
      postsWithViewsCount: stats.postsWithViewsCount || 0,
      postsWithEngagementCount: stats.postsWithEngagementCount || 0,
    };
  }

  private async getFollowerEngagementInsights(): Promise<
    FollowerEngagementTierDto[]
  > {
    const insights = await this.prisma.$queryRaw<
      {
        tierDescription: string;
        tierSortOrder: number;
        averageLikesPerPost: number;
        averageCommentsPerPost: number;
        postsAnalyzed: number;
      }[]
    >`
      SELECT
          CASE
              WHEN u."followers_count" >= 0 AND u."followers_count" <= 100 THEN '0-100 followers'
              WHEN u."followers_count" >= 101 AND u."followers_count" <= 1000 THEN '101-1000 followers'
              WHEN u."followers_count" >= 1001 THEN '>1000 followers'
              ELSE 'Other/Undefined'
          END AS "tierDescription",
          CASE -- NEW: Add a numeric sort key to SELECT
              WHEN u."followers_count" >= 0 AND u."followers_count" <= 100 THEN 1
              WHEN u."followers_count" >= 101 AND u."followers_count" <= 1000 THEN 2
              WHEN u."followers_count" >= 1001 THEN 3
              ELSE 4
          END AS "tierSortOrder", -- Alias the new sort key
          COALESCE(AVG(p."like_count"), 0.0)::float AS "averageLikesPerPost",
          COALESCE(AVG(p."comment_count"), 0.0)::float AS "averageCommentsPerPost",
          COUNT(p.id)::int AS "postsAnalyzed"
      FROM "public"."post" p
      JOIN "public"."user" u ON p."user_id" = u.id
      GROUP BY
          CASE -- Repeat the CASE for tierDescription for GROUP BY
              WHEN u."followers_count" >= 0 AND u."followers_count" <= 100 THEN '0-100 followers'
              WHEN u."followers_count" >= 101 AND u."followers_count" <= 1000 THEN '101-1000 followers'
              WHEN u."followers_count" >= 1001 THEN '>1000 followers'
              ELSE 'Other/Undefined'
          END,
          CASE -- NEW: Repeat the CASE for tierSortOrder for GROUP BY
              WHEN u."followers_count" >= 0 AND u."followers_count" <= 100 THEN 1
              WHEN u."followers_count" >= 101 AND u."followers_count" <= 1000 THEN 2
              WHEN u."followers_count" >= 1001 THEN 3
              ELSE 4
          END
      ORDER BY "tierSortOrder"; -- Now you can safely order by the alias
    `;

    // Ensure all tiers are present even if no data, and format numbers
    // This post-processing logic remains the same.
    const finalInsights: FollowerEngagementTierDto[] = [
      {
        tierDescription: '0-100 followers',
        averageLikesPerPost: 0,
        averageCommentsPerPost: 0,
        postsAnalyzed: 0,
      },
      {
        tierDescription: '101-1000 followers',
        averageLikesPerPost: 0,
        averageCommentsPerPost: 0,
        postsAnalyzed: 0,
      },
      {
        tierDescription: '>1000 followers',
        averageLikesPerPost: 0,
        averageCommentsPerPost: 0,
        postsAnalyzed: 0,
      },
    ];

    insights.forEach((item) => {
      const existing = finalInsights.find(
        (f) => f.tierDescription === item.tierDescription,
      );
      if (existing) {
        existing.averageLikesPerPost = parseFloat(
          item.averageLikesPerPost.toFixed(2),
        );
        existing.averageCommentsPerPost = parseFloat(
          item.averageCommentsPerPost.toFixed(2),
        );
        existing.postsAnalyzed = item.postsAnalyzed;
      }
    });

    return finalInsights;
  }

  private async getPlanContentInsights(): Promise<PlanContentInsightDto[]> {
    const insights = await this.prisma.$queryRaw<
      {
        planName: string;
        usersAnalyzedForPostCount: number;
        totalPostsByUsersOnPlan: number;
        averageLikesPerPostByUsersOnPlan: number;
        averageCommentsPerPostByUsersOnPlan: number;
        postsAnalyzedForEngagement: number;
      }[]
    >`
      WITH PlanUsers AS (
          SELECT
              p.id AS plan_id,
              p.name AS plan_name,
              ua."userId"
          FROM "public"."plans" p
          JOIN "public"."user_access" ua ON p.id = ua."planId"
      ),
      PlanUserPostCounts AS (
          SELECT
              pu.plan_id,
              pu.plan_name,
              COUNT(DISTINCT pu."userId") AS users_on_plan,
              COUNT(DISTINCT po.id) FILTER (WHERE po.id IS NOT NULL) AS posts_count_by_plan_users,
              COALESCE(AVG(po."like_count"), 0.0) AS avg_likes,
              COALESCE(AVG(po."comment_count"), 0.0) AS avg_comments,
              COUNT(po.id) FILTER (WHERE po.id IS NOT NULL) AS posts_analyzed_for_engagement
          FROM PlanUsers pu
          LEFT JOIN "public"."post" po ON pu."userId" = po."user_id"
          GROUP BY pu.plan_id, pu.plan_name
      )
      SELECT
          pu.plan_name AS "planName",
          pu.users_on_plan::int AS "usersAnalyzedForPostCount",
          pu.posts_count_by_plan_users::int AS "totalPostsByUsersOnPlan", -- New field for calculation in JS
          pu.avg_likes::float AS "averageLikesPerPostByUsersOnPlan",
          pu.avg_comments::float AS "averageCommentsPerPostByUsersOnPlan",
          pu.posts_analyzed_for_engagement::int AS "postsAnalyzedForEngagement"
      FROM PlanUserPostCounts pu
      ORDER BY pu.plan_name;
    `;

    return insights.map((insight) => ({
      planName: insight.planName,
      averagePostsPerUserOnPlan: this.calculateAverage(
        insight.totalPostsByUsersOnPlan,
        insight.usersAnalyzedForPostCount,
      ),
      averageLikesPerPostByUsersOnPlan: parseFloat(
        insight.averageLikesPerPostByUsersOnPlan.toFixed(2),
      ),
      averageCommentsPerPostByUsersOnPlan: parseFloat(
        insight.averageCommentsPerPostByUsersOnPlan.toFixed(2),
      ),
      postsAnalyzedForEngagement: insight.postsAnalyzedForEngagement,
      usersAnalyzedForPostCount: insight.usersAnalyzedForPostCount,
    }));
  }

  private async getAiContentEngagement(): Promise<AiContentEngagementDto> {
    const [stats] = await this.prisma.$queryRaw<
      {
        averageLikesAiPosts: number;
        averageCommentsAiPosts: number;
        averageViewsAiPosts: number;
        aiPostsAnalyzed: number;
        averageLikesNonAiPosts: number;
        averageCommentsNonAiPosts: number;
        averageViewsNonAiPosts: number;
        nonAiPostsAnalyzed: number;
      }[]
    >`
      SELECT
          COALESCE(AVG(CASE WHEN "ai_created" = true THEN "like_count" END), 0.0)::float AS "averageLikesAiPosts",
          COALESCE(AVG(CASE WHEN "ai_created" = true THEN "comment_count" END), 0.0)::float AS "averageCommentsAiPosts",
          COALESCE(AVG(CASE WHEN "ai_created" = true THEN "view_count" END), 0.0)::float AS "averageViewsAiPosts",
          COUNT(CASE WHEN "ai_created" = true THEN 1 END)::int AS "aiPostsAnalyzed",
          COALESCE(AVG(CASE WHEN "ai_created" = false THEN "like_count" END), 0.0)::float AS "averageLikesNonAiPosts",
          COALESCE(AVG(CASE WHEN "ai_created" = false THEN "comment_count" END), 0.0)::float AS "averageCommentsNonAiPosts",
          COALESCE(AVG(CASE WHEN "ai_created" = false THEN "view_count" END), 0.0)::float AS "averageViewsNonAiPosts",
          COUNT(CASE WHEN "ai_created" = false THEN 1 END)::int AS "nonAiPostsAnalyzed"
      FROM "public"."post";
    `;

    return {
      averageLikesAiPosts: parseFloat(stats.averageLikesAiPosts.toFixed(2)),
      averageCommentsAiPosts: parseFloat(
        stats.averageCommentsAiPosts.toFixed(2),
      ),
      averageViewsAiPosts: parseFloat(stats.averageViewsAiPosts.toFixed(2)),
      aiPostsAnalyzed: stats.aiPostsAnalyzed,
      averageLikesNonAiPosts: parseFloat(
        stats.averageLikesNonAiPosts.toFixed(2),
      ),
      averageCommentsNonAiPosts: parseFloat(
        stats.averageCommentsNonAiPosts.toFixed(2),
      ),
      averageViewsNonAiPosts: parseFloat(
        stats.averageViewsNonAiPosts.toFixed(2),
      ),
      nonAiPostsAnalyzed: stats.nonAiPostsAnalyzed,
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
