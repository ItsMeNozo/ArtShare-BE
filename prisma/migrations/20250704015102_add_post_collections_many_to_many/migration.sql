/*
  Warnings:

  - You are about to drop the `_CollectionToPost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CollectionToPost" DROP CONSTRAINT "_CollectionToPost_A_fkey";

-- DropForeignKey
ALTER TABLE "_CollectionToPost" DROP CONSTRAINT "_CollectionToPost_B_fkey";

-- DropTable
DROP TABLE "_CollectionToPost";

-- CreateTable
CREATE TABLE "PostsOnCollections" (
    "postId" INTEGER NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostsOnCollections_pkey" PRIMARY KEY ("postId","collectionId")
);

-- AddForeignKey
ALTER TABLE "PostsOnCollections" ADD CONSTRAINT "PostsOnCollections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostsOnCollections" ADD CONSTRAINT "PostsOnCollections_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
