// execute: npx tsx ./scripts/deleteUser.ts <userId>

import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { PrismaClient } from '../src/generated';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Get userId from command line arguments
const userIdToDelete = process.argv[2];

if (!userIdToDelete) {
  console.error('Usage: npx tsx ./scripts/deleteUser.ts <userId>');
  process.exit(1);
}

console.log(`Target user ID: ${userIdToDelete}`);

// Firebase service account configuration
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

async function deleteUserAndVerify(userId: string) {
  console.log(`\n🗑️  Attempting to delete user: ${userId} and their associated data...`);

  try {
    // ─── 1. Check if user exists in database ────────────────────────────────────
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      console.log(`❌ User with ID ${userId} not found in database. Nothing to delete.`);
      return;
    }

    console.log(`✅ User found in database: ${userExists.username} (${userExists.email})`);

    // ─── 2. Delete from Firebase Auth ───────────────────────────────────────────
    console.log(`🔥 Deleting user ${userId} from Firebase Auth...`);
    let firebaseDeleted = false;
    
    try {
      await admin.auth().deleteUser(userId);
      console.log(`✅ Successfully deleted Firebase Auth user ${userId}`);
      firebaseDeleted = true;
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.warn(`⚠️  Firebase Auth user ${userId} not found. Continuing with database cleanup...`);
      } else {
        console.error(`❌ Error deleting Firebase Auth user ${userId}:`, authError.message);
        throw authError;
      }
    }

    // ─── 3. Delete from database with proper counter updates ────────────────────
    console.log(`🗄️  Starting database deletion transaction...`);
    
    // Use longer timeout for large datasets and optimize the transaction
    await prisma.$transaction(async (tx) => {
      // Fetch all relationships that need counter updates
      console.log(`📊 Fetching user relationships for counter updates...`);
      
      const [
        followers, 
        followings, 
        userComments, 
        userLikes, 
        userCommentLikes
      ] = await Promise.all([
        tx.follow.findMany({ where: { followingId: userId } }),
        tx.follow.findMany({ where: { followerId: userId } }),
        tx.comment.findMany({ where: { userId } }),
        tx.like.findMany({ where: { userId } }),
        tx.commentLike.findMany({ where: { userId } })
      ]);

      console.log(`📈 Found relationships:
        - ${followers.length} followers
        - ${followings.length} followings
        - ${userComments.length} comments
        - ${userLikes.length} likes
        - ${userCommentLikes.length} comment likes`);

      // Update follower counts
      const followerIds = followers.map(f => f.followerId);
      if (followerIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: followerIds } },
          data: { followingsCount: { decrement: 1 } },
        });
        console.log(`📉 Decremented followingsCount for ${followerIds.length} user(s)`);
      }

      // Update following counts
      const followingIds = followings.map(f => f.followingId);
      if (followingIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: followingIds } },
          data: { followersCount: { decrement: 1 } },
        });
        console.log(`📉 Decremented followersCount for ${followingIds.length} user(s)`);
      }

      // Update comment counts for posts (batch by post ID)
      const postCommentMap: Record<number, number> = {};
      userComments.forEach(comment => {
        if (comment.targetType === 'POST' && comment.targetId) {
          postCommentMap[comment.targetId] = (postCommentMap[comment.targetId] || 0) + 1;
        }
      });
      
      // Process posts with error handling for missing records
      const postIds = Object.keys(postCommentMap);
      let updatedPosts = 0;
      if (postIds.length > 0) {
        for (const postId of postIds) {
          try {
            await tx.post.update({
              where: { id: Number(postId) },
              data: { commentCount: { decrement: postCommentMap[Number(postId)] } },
            });
            updatedPosts++;
          } catch (error: any) {
            if (error.code === 'P2025') {
              console.warn(`⚠️  Post ${postId} not found - skipping comment count update`);
            } else {
              throw error;
            }
          }
        }
        console.log(`📉 Updated comment counts for ${updatedPosts}/${postIds.length} post(s)`);
      }

      // Update comment counts for blogs (batch by blog ID)
      const blogCommentMap: Record<number, number> = {};
      userComments.forEach(comment => {
        if (comment.targetType === 'BLOG' && comment.targetId) {
          blogCommentMap[comment.targetId] = (blogCommentMap[comment.targetId] || 0) + 1;
        }
      });
      
      const blogIds = Object.keys(blogCommentMap);
      let updatedBlogs = 0;
      if (blogIds.length > 0) {
        for (const blogId of blogIds) {
          try {
            await tx.blog.update({
              where: { id: Number(blogId) },
              data: { commentCount: { decrement: blogCommentMap[Number(blogId)] } },
            });
            updatedBlogs++;
          } catch (error: any) {
            if (error.code === 'P2025') {
              console.warn(`⚠️  Blog ${blogId} not found - skipping comment count update`);
            } else {
              throw error;
            }
          }
        }
        console.log(`📉 Updated comment counts for ${updatedBlogs}/${blogIds.length} blog(s)`);
      }

      // Update like counts for posts (with error handling)
      const likedPostIds = userLikes
        .filter(like => like.postId !== null)
        .map(like => like.postId!);
      
      if (likedPostIds.length > 0) {
        try {
          const result = await tx.post.updateMany({
            where: { id: { in: likedPostIds } },
            data: { likeCount: { decrement: 1 } },
          });
          console.log(`📉 Decremented like counts for ${result.count}/${likedPostIds.length} post(s)`);
        } catch (error: any) {
          console.warn(`⚠️  Error updating post like counts - some posts may have been deleted`);
        }
      }

      // Update like counts for blogs (with error handling)
      const likedBlogIds = userLikes
        .filter(like => like.blogId !== null)
        .map(like => like.blogId!);
      
      if (likedBlogIds.length > 0) {
        try {
          const result = await tx.blog.updateMany({
            where: { id: { in: likedBlogIds } },
            data: { likeCount: { decrement: 1 } },
          });
          console.log(`📉 Decremented like counts for ${result.count}/${likedBlogIds.length} blog(s)`);
        } catch (error: any) {
          console.warn(`⚠️  Error updating blog like counts - some blogs may have been deleted`);
        }
      }

      // Update like counts for comments (with error handling)
      const likedCommentIds = userCommentLikes.map(like => like.commentId);
      if (likedCommentIds.length > 0) {
        try {
          const result = await tx.comment.updateMany({
            where: { id: { in: likedCommentIds } },
            data: { likeCount: { decrement: 1 } },
          });
          console.log(`📉 Decremented like counts for ${result.count}/${likedCommentIds.length} comment(s)`);
        } catch (error: any) {
          console.warn(`⚠️  Error updating comment like counts - some comments may have been deleted`);
        }
      }

      // Handle non-cascading relationships (with error handling)
      console.log(`🔧 Handling non-cascading relationships...`);
      
      try {
        const [updatedReports, deletedConversations] = await Promise.all([
          // Set moderatorId to null for reports where user was moderator
          tx.report.updateMany({
            where: { moderatorId: userId },
            data: { moderatorId: null }
          }),
          
          // Delete conversations (these don't cascade in your schema)
          tx.conversation.deleteMany({ where: { userId } })
        ]);

        if (updatedReports.count > 0) {
          console.log(`🔧 Updated ${updatedReports.count} report(s) - removed moderator assignment`);
        }
        
        if (deletedConversations.count > 0) {
          console.log(`🗑️  Deleted ${deletedConversations.count} conversation(s)`);
        }
      } catch (error: any) {
        console.warn(`⚠️  Error handling non-cascading relationships:`, error.message);
      }

      // Finally, delete the user (this will cascade delete most relationships)
      console.log(`🗑️  Deleting user record - this will cascade delete related data...`);
      await tx.user.delete({ where: { id: userId } });
      console.log(`✅ User ${userId} successfully deleted from database`);
    }, {
      timeout: 30000, // 30 seconds timeout for large datasets
      maxWait: 35000, // Max wait time
    });

    console.log(`✅ Database transaction completed successfully`);

    // ─── 4. Verification ─────────────────────────────────────────────────────────
    console.log(`\n🔍 Verifying deletion...`);
    const isClean = await verifyUserDeletion(userId);
    
    if (isClean) {
      console.log(`\n🎉 SUCCESS: User ${userId} has been completely deleted!`);
      console.log(`   - Firebase: ${firebaseDeleted ? '✅ Deleted' : '❌ Not found'}`);
      console.log(`   - Database: ✅ Deleted`);
    } else {
      console.log(`\n⚠️  WARNING: Some data may still exist. Check verification results above.`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error during user deletion:`, error.message);
    
    if (error.code === 'P2025') {
      console.warn(`⚠️  User ${userId} might have already been deleted or never existed in database`);
    } else if (error.code === 'P2002') {
      console.error(`🔗 Unique constraint violation - there may be data integrity issues`);
    } else if (error.message.includes('Foreign key constraint failed')) {
      console.error(`🔗 Foreign key constraint failed - review schema cascades`);
    } else if (error.code?.startsWith('auth/')) {
      console.error(`🔥 Firebase Auth error - manual investigation may be needed`);
    } else if (error.message.includes('Transaction already closed') || error.message.includes('timeout')) {
      console.error(`⏱️  Transaction timeout - the user has too much data. Consider manual cleanup.`);
    } else if (error.message.includes('Record to update not found')) {
      console.error(`🔍 Some records referenced by user data no longer exist (data integrity issue)`);
    } else {
      console.error(`💥 Unexpected error:`, error);
    }
    
    console.log(`\n🔍 Attempting verification after error...`);
    await verifyUserDeletion(userId);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyUserDeletion(userId: string): Promise<boolean> {
  console.log(`\n📋 Verification Report for User ${userId}:`);
  console.log(`${'─'.repeat(60)}`);
  
  let allClear = true;

  try {
    // Check if user still exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log(`👤 User record: ${user ? '❌ STILL EXISTS' : '✅ Deleted'}`);
    if (user) allClear = false;

    // Check related records that should be cascaded
    const [
      userRoles,
      posts,
      blogs,
      likes,
      commentLikes,
      comments,
      shares,
      follows,
      bookmarks,
      ratings,
      collections,
      reports,
      userAccess,
      userUsage,
      artGenerations,
      conversations,
      notifications,
      autoProjects,
      platforms,
    ] = await Promise.all([
      prisma.userRole.count({ where: { userId } }),
      prisma.post.count({ where: { userId } }),
      prisma.blog.count({ where: { userId } }),
      prisma.like.count({ where: { userId } }),
      prisma.commentLike.count({ where: { userId } }),
      prisma.comment.count({ where: { userId } }),
      prisma.share.count({ where: { userId } }),
      prisma.follow.count({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      prisma.bookmark.count({ where: { userId } }),
      prisma.rating.count({ where: { userId } }),
      prisma.collection.count({ where: { userId } }),
      prisma.report.count({ where: { reporterId: userId } }),
      prisma.userAccess.count({ where: { userId } }),
      prisma.userUsage.count({ where: { userId } }),
      prisma.artGeneration.count({ where: { userId } }),
      prisma.conversation.count({ where: { userId } }),
      prisma.notification.count({ where: { userId } }),
      prisma.autoProject.count({ where: { userId } }),
      prisma.platform.count({ where: { userId } }),
    ]);

    const checks = [
      { name: 'User Roles', count: userRoles },
      { name: 'Posts', count: posts },
      { name: 'Blogs', count: blogs },
      { name: 'Likes', count: likes },
      { name: 'Comment Likes', count: commentLikes },
      { name: 'Comments', count: comments },
      { name: 'Shares', count: shares },
      { name: 'Follows', count: follows },
      { name: 'Bookmarks', count: bookmarks },
      { name: 'Ratings', count: ratings },
      { name: 'Collections', count: collections },
      { name: 'Reports (as reporter)', count: reports },
      { name: 'User Access', count: userAccess },
      { name: 'User Usage', count: userUsage },
      { name: 'Art Generations', count: artGenerations },
      { name: 'Conversations', count: conversations },
      { name: 'Notifications', count: notifications },
      { name: 'Auto Projects', count: autoProjects },
      { name: 'Platforms', count: platforms },
    ];

    checks.forEach(check => {
      const status = check.count === 0 ? '✅ Clean' : '❌ Found';
      console.log(`📊 ${check.name.padEnd(20)}: ${check.count.toString().padStart(3)} records - ${status}`);
      if (check.count > 0) allClear = false;
    });

    console.log(`${'─'.repeat(60)}`);
    console.log(`🎯 Overall Status: ${allClear ? '✅ ALL CLEAN' : '❌ ISSUES FOUND'}`);
    
    return allClear;
    
  } catch (error) {
    console.error(`❌ Error during verification:`, error);
    return false;
  }
}

// Main execution
async function main() {
  try {
    await deleteUserAndVerify(userIdToDelete);
    console.log(`\n🏁 Process completed.`);
  } catch (error) {
    console.error(`\n💥 Unhandled error:`, error);
    process.exit(1);
  }
}

main();