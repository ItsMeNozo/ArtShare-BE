import { ApiProperty } from '@nestjs/swagger';

export class ContentFunnelDto {
  @ApiProperty({
    example: 100,
    description: 'Number of unique users who have created at least one post.',
  })
  usersWhoPostedCount: number;

  @ApiProperty({
    example: 500,
    description: 'Number of posts that have at least one view.',
  })
  postsWithViewsCount: number;

  @ApiProperty({
    example: 350,
    description: 'Number of posts that have at least one like or one comment.',
  })
  postsWithEngagementCount: number;
}

export class FollowerEngagementTierDto {
  @ApiProperty({
    example: '0-100 followers',
    description: 'Description of the follower tier.',
  })
  tierDescription: string;

  @ApiProperty({
    example: 5.5,
    description: 'Average likes per post for users in this tier.',
  })
  averageLikesPerPost: number;

  @ApiProperty({
    example: 1.2,
    description: 'Average comments per post for users in this tier.',
  })
  averageCommentsPerPost: number;

  @ApiProperty({
    example: 50,
    description: 'Number of posts analyzed for this tier.',
  })
  postsAnalyzed: number;
}

export class PlanContentInsightDto {
  @ApiProperty({
    example: 'ARTISTPRO',
    description: 'Name of the subscription plan.',
  })
  planName: string;

  @ApiProperty({
    example: 10.2,
    description: 'Average number of posts created by users on this plan.',
  })
  averagePostsPerUserOnPlan: number;

  @ApiProperty({
    example: 15.7,
    description: 'Average likes per post from users on this plan.',
  })
  averageLikesPerPostByUsersOnPlan: number;

  @ApiProperty({
    example: 3.1,
    description: 'Average comments per post from users on this plan.',
  })
  averageCommentsPerPostByUsersOnPlan: number;

  @ApiProperty({
    example: 200,
    description: 'Number of posts analyzed for this plan.',
  })
  postsAnalyzedForEngagement: number;

  @ApiProperty({
    example: 20,
    description: 'Number of users on this plan analyzed for post count.',
  })
  usersAnalyzedForPostCount: number;
}

export class AiContentEngagementDto {
  @ApiProperty({ example: 12.0 })
  averageLikesAiPosts: number;
  @ApiProperty({ example: 2.5 })
  averageCommentsAiPosts: number;
  @ApiProperty({ example: 150.0 })
  averageViewsAiPosts: number;
  @ApiProperty({ example: 100 })
  aiPostsAnalyzed: number;

  @ApiProperty({ example: 8.0 })
  averageLikesNonAiPosts: number;
  @ApiProperty({ example: 1.8 })
  averageCommentsNonAiPosts: number;
  @ApiProperty({ example: 120.0 })
  averageViewsNonAiPosts: number;
  @ApiProperty({ example: 400 })
  nonAiPostsAnalyzed: number;
}

export class TimeToActionDto {
  @ApiProperty({
    example: 48.5,
    description:
      'Average time in hours from user signup to their first post. Null if no users have posted.',
    nullable: true,
  })
  avgHoursSignupToFirstPost: number | null;

  @ApiProperty({
    example: 2.75,
    description:
      'Average time in hours from post creation to its first like or comment. Null if no posts have interactions.',
    nullable: true,
  })
  avgHoursPostToFirstInteraction: number | null;
}

export class PlatformWideStatsDto {
  @ApiProperty({ type: ContentFunnelDto })
  contentFunnel: ContentFunnelDto;

  @ApiProperty({ type: [FollowerEngagementTierDto] })
  followerEngagementInsights: FollowerEngagementTierDto[];

  @ApiProperty({ type: [PlanContentInsightDto] })
  planContentInsights: PlanContentInsightDto[];

  @ApiProperty({ type: AiContentEngagementDto })
  aiContentEngagement: AiContentEngagementDto;

  @ApiProperty({ type: TimeToActionDto })
  timeToAction: TimeToActionDto;
}
