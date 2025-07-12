/*
  Warnings:

  - You are about to drop the column `assignedAt` on the `posts_on_collections` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "collection" RENAME CONSTRAINT "Collection_pkey" TO "collection_pkey";

-- AlterTable
ALTER TABLE "posts_on_collections" DROP COLUMN "assignedAt",
ADD COLUMN     "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
