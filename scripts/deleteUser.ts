// execute: npx tsx ./scripts/deleteUser.ts <userId>

import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { PrismaClient } from 'src/generated';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Get userId from command line arguments
const userIdToDelete = process.argv[2];
console.log(`Target user ID: ${userIdToDelete}`);

// Since this is a standalone script, we need to access process.env directly
// In a NestJS application context, these would use ConfigService instead
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Replace escaped newlines
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

// ─── 1. Initialize Firebase Admin SDK ─────────────────────────────────────────
// We assume you have downloaded a service account JSON and saved it to ../firebase-service-account.json
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
}); // :contentReference[oaicite:5]{index=5}

async function deleteUserAndVerify(userId: string) {
  console.log(
    `Attempting to delete user: ${userId} and their associated data...`,
  );

  try {
    // ─── 2. Check if user exists in Prisma before proceeding ────────────────────
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      console.log(
        `User with ID ${userId} not found in database. Nothing to delete.`,
      ); // :contentReference[oaicite:6]{index=6}
      return;
    }

    // ─── 3. Delete from Firebase Auth first ────────────────────────────────────
    console.log(`Deleting user ${userId} from Firebase Auth...`);
    try {
      await admin.auth().deleteUser(userId); // :contentReference[oaicite:7]{index=7}
      console.log(`Successfully deleted Auth user ${userId}.`);
    } catch (authError: any) {
      console.error(`Error deleting Auth user ${userId}:`, authError);
      // If the Auth user does not exist, you can choose to continue to Prisma cleanup:
      if (authError.code === 'auth/user-not-found') {
        console.warn(
          `Auth user ${userId} not found. Continuing Prisma cleanup...`,
        ); // :contentReference[oaicite:8]{index=8}
      } else {
        throw authError;
      }
    }

    // ─── 4. Start a Prisma transaction to delete all related records ────────────
    await prisma.$transaction(async (tx) => {
      console.log('Starting Prisma transaction...');

      // 4.1 Delete any collections explicitly if not cascaded:
      console.log(`Deleting collections for user ${userId}...`);
      const deletedCollections = await tx.collection.deleteMany({
        where: { user_id: userId },
      });
      console.log(`Deleted ${deletedCollections.count} collection(s).`); // :contentReference[oaicite:9]{index=9}

      // 4.2 Delete art generations by user:
      console.log(`Deleting art generations for user ${userId}...`);
      const deletedArtGenerations = await tx.artGeneration.deleteMany({
        where: { user_id: userId },
      });
      console.log(`Deleted ${deletedArtGenerations.count} art generation(s).`); // :contentReference[oaicite:10]{index=10}

      // 4.3 (Optional) If you must clean up orphan Media by creator_id:
      // console.log(`Deleting media records with creator_id ${userId} (if exist)...`);
      // const deletedMediaByCreator = await tx.media.deleteMany({
      //   where: { creator_id: userId }
      // });
      // console.log(`Deleted ${deletedMediaByCreator.count} media record(s) by creator_id.`);

      // 4.4 Delete the User record (cascade should handle other relations):
      console.log(`Deleting user ${userId} from Prisma...`);
      await tx.user.delete({ where: { id: userId } }); // :contentReference[oaicite:11]{index=11}
      console.log(`User ${userId} deleted successfully from Prisma.`);
      console.log('Prisma transaction committed.');
    });

    // ─── 5. Verification step ─────────────────────────────────────────────────────
    console.log('\n--- Verification ---');
    await verifyUserDeletion(userId);
  } catch (error: any) {
    console.error('Error during user deletion process:', error);
    // Prisma-specific error for record not found
    if (error.code === 'P2025') {
      // :contentReference[oaicite:12]{index=12}
      console.warn(
        `User with ID ${userId} might have already been deleted or never existed in Prisma.`,
      );
    } else if (error.message.includes('Foreign key constraint failed')) {
      console.error(
        'A foreign key constraint failed. Review schema cascades/manual deletes.',
      );
    } else if (error.code && error.code.startsWith('auth/')) {
      console.error(
        'A Firebase Auth error occurred. Manual investigation may be needed.',
      );
    }
    console.log('\n--- Attempting Verification After Error ---');
    await verifyUserDeletion(userId);
  } finally {
    await prisma.$disconnect(); // :contentReference[oaicite:13]{index=13}
  }
}

async function verifyUserDeletion(userId: string) {
  let allClear = true;
  const checks: Array<{ model: string; exists: boolean; count: number }> = [];

  // 1. Check if Prisma user still exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  checks.push({ model: 'User', exists: !!user, count: user ? 1 : 0 }); // :contentReference[oaicite:14]{index=14}
  if (user) allClear = false;

  // 2. Check related Prisma counts in parallel
  const [
    countUserRoles,
    countPosts,
    countBlogs,
    countMediaViaPost,
    countLikes,
    countCommentLikes,
    countComments,
    countShares,
    countFollows,
    countBookmarks,
    countRatings,
    countCollections,
    countReportsAsReporter,
    countUserAccess,
    countUserUsage,
    countArtGenerations,
  ] = await prisma.$transaction([
    prisma.userRole.count({ where: { user_id: userId } }), // :contentReference[oaicite:15]{index=15}
    prisma.post.count({ where: { user_id: userId } }), // :contentReference[oaicite:16]{index=16}
    prisma.blog.count({ where: { user_id: userId } }), // :contentReference[oaicite:17]{index=17}
    prisma.media.count({ where: { post: { user_id: userId } } }), // :contentReference[oaicite:18]{index=18}
    prisma.like.count({ where: { user_id: userId } }), // :contentReference[oaicite:19]{index=19}
    prisma.commentLike.count({ where: { user_id: userId } }), // :contentReference[oaicite:20]{index=20}
    prisma.comment.count({ where: { user_id: userId } }), // :contentReference[oaicite:21]{index=21}
    prisma.share.count({ where: { user_id: userId } }), // :contentReference[oaicite:22]{index=22}
    prisma.follow.count({
      where: { OR: [{ follower_id: userId }, { following_id: userId }] },
    }), // :contentReference[oaicite:23]{index=23}
    prisma.bookmark.count({ where: { user_id: userId } }), // :contentReference[oaicite:24]{index=24}
    prisma.rating.count({ where: { user_id: userId } }), // :contentReference[oaicite:25]{index=25}
    prisma.collection.count({ where: { user_id: userId } }), // :contentReference[oaicite:26]{index=26}
    prisma.report.count({ where: { reporter_id: userId } }), // :contentReference[oaicite:27]{index=27}
    prisma.userAccess.count({ where: { userId: userId } }), // :contentReference[oaicite:28]{index=28}
    prisma.userUsage.count({ where: { userId: userId } }), // :contentReference[oaicite:29]{index=29}
    prisma.artGeneration.count({ where: { user_id: userId } }), // :contentReference[oaicite:30]{index=30}
  ]);

  const modelNames = [
    'UserRole',
    'Post',
    'Blog',
    'Media (via Post)',
    'Like (by user)',
    'CommentLike (by user)',
    'Comment (by user)',
    'Share (by user)',
    'Follow (as follower/following)',
    'Bookmark (by user)',
    'Rating (by user)',
    'Collection (by user)',
    'Report (as reporter)',
    'UserAccess',
    'UserUsage',
    'ArtGeneration (by user)',
  ];

  const relatedCounts = [
    countUserRoles,
    countPosts,
    countBlogs,
    countMediaViaPost,
    countLikes,
    countCommentLikes,
    countComments,
    countShares,
    countFollows,
    countBookmarks,
    countRatings,
    countCollections,
    countReportsAsReporter,
    countUserAccess,
    countUserUsage,
    countArtGenerations,
  ];

  relatedCounts.forEach((cnt, idx) => {
    checks.push({ model: modelNames[idx], exists: cnt > 0, count: cnt }); // :contentReference[oaicite:31]{index=31}
    if (cnt > 0) allClear = false;
  });

  console.log('\nVerification Results:');
  checks.forEach((check) => {
    console.log(
      `- ${check.model}: ${check.count} record(s) found. ${check.exists ? 'Problem!' : 'OK.'}`,
    );
  });

  if (allClear) {
    console.log(
      '\nSUCCESS: All data associated with user seems deleted from Prisma.',
    );
  } else {
    console.warn(
      '\nWARNING: Some data associated with the user still exists. Review logs above.',
    );
  }
  return allClear;
}

// Run the function
deleteUserAndVerify(userIdToDelete)
  .then(() => console.log('Process finished.'))
  .catch((e) => console.error('Unhandled error in main execution:', e)); // :contentReference[oaicite:32]{index=32}
