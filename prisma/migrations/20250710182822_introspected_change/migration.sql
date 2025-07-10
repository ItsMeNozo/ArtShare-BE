-- Step 1: Drop the old constraints and indexes that use the old names.
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_user_id_fkey";
ALTER TABLE "PostsOnCollections" DROP CONSTRAINT "PostsOnCollections_collectionId_fkey";
ALTER TABLE "PostsOnCollections" DROP CONSTRAINT "PostsOnCollections_postId_fkey";
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_userId_fkey";
ALTER TABLE "message" DROP CONSTRAINT "message_conversationId_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";
ALTER TABLE "user_usage" DROP CONSTRAINT "user_usage_userId_fkey";
DROP INDEX "conversation_userId_lastMessageAt_idx";
DROP INDEX "message_conversationId_createdAt_idx";
DROP INDEX "plans_stripeProductId_key";
DROP INDEX "user_usage_userId_featureKey_cycle_ends_at_idx";
DROP INDEX "user_usage_userId_featureKey_cycle_started_at_key";
ALTER TABLE "PostsOnCollections" DROP CONSTRAINT "PostsOnCollections_pkey";

-- Step 2: Safely rename the tables.
ALTER TABLE "Collection" RENAME TO "collection";
ALTER TABLE "PostsOnCollections" RENAME TO "posts_on_collections";

-- Step 3: Safely rename the columns in each table, one statement per rename.

-- AlterTable "conversation"
ALTER TABLE "conversation" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "conversation" RENAME COLUMN "lastMessageAt" TO "last_message_at";
ALTER TABLE "conversation" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "conversation" RENAME COLUMN "userId" TO "user_id";

-- AlterTable "message"
ALTER TABLE "message" RENAME COLUMN "conversationId" TO "conversation_id";
ALTER TABLE "message" RENAME COLUMN "createdAt" TO "created_at";

-- AlterTable "notifications"
ALTER TABLE "notifications" RENAME COLUMN "userId" TO "user_id";

-- AlterTable "plans"
ALTER TABLE "plans" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "plans" RENAME COLUMN "dailyQuotaCredits" TO "daily_quota_credits";
ALTER TABLE "plans" RENAME COLUMN "stripeProductId" TO "stripe_product_id";
ALTER TABLE "plans" RENAME COLUMN "updatedAt" TO "updated_at";

-- AlterTable "user_usage"
ALTER TABLE "user_usage" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "user_usage" RENAME COLUMN "featureKey" TO "feature_key";
ALTER TABLE "user_usage" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "user_usage" RENAME COLUMN "userId" TO "user_id";

-- Step 4: Re-create the primary key for the renamed posts_on_collections table.
ALTER TABLE "posts_on_collections" ADD CONSTRAINT "posts_on_collections_pkey" PRIMARY KEY ("postId", "collectionId");

-- Step 5: Re-create all the constraints and indexes using the new, correct names.

-- CreateIndex
CREATE INDEX "collection_user_id_idx" ON "collection"("user_id");
CREATE INDEX "conversation_user_id_last_message_at_idx" ON "conversation"("user_id", "last_message_at");
CREATE INDEX "message_conversation_id_created_at_idx" ON "message"("conversation_id", "created_at");
CREATE UNIQUE INDEX "plans_stripe_product_id_key" ON "plans"("stripe_product_id");
CREATE INDEX "user_usage_user_id_feature_key_cycle_ends_at_idx" ON "user_usage"("user_id", "feature_key", "cycle_ends_at");
CREATE UNIQUE INDEX "user_usage_user_id_feature_key_cycle_started_at_key" ON "user_usage"("user_id", "feature_key", "cycle_started_at");

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts_on_collections" ADD CONSTRAINT "posts_on_collections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts_on_collections" ADD CONSTRAINT "posts_on_collections_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;