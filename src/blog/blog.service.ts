import { Injectable } from '@nestjs/common';
import { Blog } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

type UserPreferences = {
  categories?: string[];
  keywords?: string[];
};

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async getBlogs(
    userId: number | null,
    take: number,
    skip: number,
  ): Promise<Blog[]> {
    const validTake = Math.max(1, take || 10);
    const validSkip = Math.max(0, skip || 0);

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      if (!user) {
        return [];
      }

      const preferences: UserPreferences =
        (user.preferences as UserPreferences) || {};
      const categories = Array.isArray(preferences.categories)
        ? preferences.categories
        : [];
      const keywords = Array.isArray(preferences.keywords)
        ? preferences.keywords.join(' ')
        : '';

      return this.prisma.blog.findMany({
        where: {
          OR: [
            { category: { in: categories } },
            { content: { contains: keywords } },
          ],
        },
        orderBy: [{ likes: 'desc' }, { views: 'desc' }, { created_at: 'desc' }],
        take: validTake,
        skip: validSkip,
      });
    } else {
      return this.prisma.blog.findMany({
        orderBy: [{ likes: 'desc' }, { views: 'desc' }, { created_at: 'desc' }],
        take: validTake,
        skip: validSkip,
      });
    }
  }

  async findMyBlogs(userId: number): Promise<Blog[]> {
    return this.prisma.blog.findMany({ where: { user_id: userId } });
  }

  async createBlog(data: {
    user_id: number;
    title: string;
    content: string;
  }): Promise<Blog> {
    return this.prisma.blog.create({ data });
  }

  async findBlogById(id: number): Promise<Blog | null> {
    return this.prisma.blog.findUnique({ where: { id } });
  }

  async updateBlog(id: number, data: Partial<Blog>): Promise<Blog> {
    return this.prisma.blog.update({ where: { id }, data });
  }

  async deleteBlog(id: number): Promise<Blog> {
    return this.prisma.blog.delete({ where: { id } });
  }
}
