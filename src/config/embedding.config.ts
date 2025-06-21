import { registerAs } from '@nestjs/config';

export default registerAs('embedding', () => ({
  vectorDimension: 768,
  postsCollectionName: process.env.POST_COLLECTION_NAME || 'posts',
  blogsCollectionName: process.env.BLOG_COLLECTION_NAME || 'blogs',
  categoriesCollectionName:
    process.env.CATEGORY_COLLECTION_NAME || 'categories',
}));
