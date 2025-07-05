/*
  Warnings:

  - You are about to drop the column `createdAt` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastMessageAt` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `conversation` table. All the data in the column will be lost.
  - You are about to drop the column `conversationId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `dailyQuotaCredits` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripeProductId` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `user_usage` table. All the data in the column will be lost.
  - You are about to drop the column `featureKey` on the `user_usage` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user_usage` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `user_usage` table. All the data in the column will be lost.
  - You are about to drop the `Collection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostsOnCollections` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[stripe_product_id]` on the table `plans` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,feature_key,cycle_started_at]` on the table `user_usage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `conversation_id` to the `message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `daily_quota_credits` to the `plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `feature_key` to the `user_usage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `user_usage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `user_usage` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_user_id_fkey";

-- DropForeignKey
ALTER TABLE "PostsOnCollections" DROP CONSTRAINT "PostsOnCollections_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "PostsOnCollections" DROP CONSTRAINT "PostsOnCollections_postId_fkey";

-- DropForeignKey
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_userId_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_usage" DROP CONSTRAINT "user_usage_userId_fkey";

-- DropIndex
DROP INDEX "conversation_userId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "message_conversationId_createdAt_idx";

-- DropIndex
DROP INDEX "plans_stripeProductId_key";

-- DropIndex
DROP INDEX "user_usage_userId_featureKey_cycle_ends_at_idx";

-- DropIndex
DROP INDEX "user_usage_userId_featureKey_cycle_started_at_key";

-- AlterTable
ALTER TABLE "conversation" DROP COLUMN "createdAt",
DROP COLUMN "lastMessageAt",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "message" DROP COLUMN "conversationId",
DROP COLUMN "createdAt",
ADD COLUMN     "conversation_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "userId",
ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "createdAt",
DROP COLUMN "dailyQuotaCredits",
DROP COLUMN "stripeProductId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "daily_quota_credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripe_product_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_usage" DROP COLUMN "createdAt",
DROP COLUMN "featureKey",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "feature_key" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "Collection";

-- DropTable
DROP TABLE "PostsOnCollections";

-- CreateTable
CREATE TABLE "collection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail_url" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts_on_collections" (
    "postId" INTEGER NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_on_collections_pkey" PRIMARY KEY ("postId","collectionId")
);

-- CreateIndex
CREATE INDEX "collection_user_id_idx" ON "collection"("user_id");

-- CreateIndex
CREATE INDEX "conversation_user_id_last_message_at_idx" ON "conversation"("user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "message_conversation_id_created_at_idx" ON "message"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripe_product_id_key" ON "plans"("stripe_product_id");

-- CreateIndex
CREATE INDEX "user_usage_user_id_feature_key_cycle_ends_at_idx" ON "user_usage"("user_id", "feature_key", "cycle_ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_usage_user_id_feature_key_cycle_started_at_key" ON "user_usage"("user_id", "feature_key", "cycle_started_at");

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_on_collections" ADD CONSTRAINT "posts_on_collections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_on_collections" ADD CONSTRAINT "posts_on_collections_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
