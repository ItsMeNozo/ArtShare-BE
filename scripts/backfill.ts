import axios from 'axios';
import * as dotenv from 'dotenv';
import sharp from 'sharp';
import { PrismaClient } from '../src/generated';

dotenv.config();
const prisma = new PrismaClient();

async function backfillPostThumbnailDimensions() {
  console.log('--- Starting Backfill Process for Post Thumbnails ---');

  const postsToProcess = await prisma.post.findMany({
    where: { thumbnailWidth: null },
  });

  console.log(`Found ${postsToProcess.length} posts to process.`);
  let successCount = 0;
  let errorCount = 0;

  for (const post of postsToProcess) {
    if (!post.thumbnailUrl) {
      console.warn(`Skipping Post ID ${post.id} due to missing thumbnailUrl.`);
      errorCount++;
      continue;
    }

    try {
      const response = await axios.get(post.thumbnailUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(response.data, 'binary');

      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;

      if (width && height) {
        await prisma.post.update({
          where: { id: post.id },
          data: { thumbnailWidth: width, thumbnailHeight: height },
        });
        console.log(
          `SUCCESS: Post ID ${post.id} thumbnail updated -> ${width}x${height}`,
        );
        successCount++;
      } else {
        console.warn(
          `WARNING: Could not determine dimensions for Post ID ${post.id}`,
        );
        errorCount++;
      }
    } catch (error: any) {
      console.error(
        `ERROR processing Post ID ${post.id} (URL: ${post.thumbnailUrl}): ${error.message}`,
      );
      errorCount++;
    }
  }

  console.log('\n--- Post Thumbnail Backfill Complete ---');
  console.log(`Successfully processed: ${successCount}`);
  console.log(`Failed to process: ${errorCount}`);
}

backfillPostThumbnailDimensions()
  .catch((e) => {
    console.error(
      'An unexpected error occurred during the backfill process:',
      e,
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
