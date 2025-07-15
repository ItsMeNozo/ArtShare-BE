/*
  Warnings:

  - You are about to drop the column `collectionId` on the `post` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "post" DROP CONSTRAINT "post_collectionId_fkey";

-- AlterTable
ALTER TABLE "post" DROP COLUMN "collectionId";

-- CreateTable
CREATE TABLE "_CollectionToPost" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CollectionToPost_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CollectionToPost_B_index" ON "_CollectionToPost"("B");

-- AddForeignKey
ALTER TABLE "_CollectionToPost" ADD CONSTRAINT "_CollectionToPost_A_fkey" FOREIGN KEY ("A") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionToPost" ADD CONSTRAINT "_CollectionToPost_B_fkey" FOREIGN KEY ("B") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
