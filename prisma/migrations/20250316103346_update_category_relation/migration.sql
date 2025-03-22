/*
  Warnings:

  - The primary key for the `like` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `like` table. All the data in the column will be lost.
  - You are about to drop the `_CategoryToMedia` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[url]` on the table `category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `url` to the `category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `comment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_CategoryToMedia" DROP CONSTRAINT "_CategoryToMedia_A_fkey";

-- DropForeignKey
ALTER TABLE "_CategoryToMedia" DROP CONSTRAINT "_CategoryToMedia_B_fkey";

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "like" DROP CONSTRAINT "like_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "like_pkey" PRIMARY KEY ("user_id", "target_id");

-- DropTable
DROP TABLE "_CategoryToMedia";

-- CreateTable
CREATE TABLE "_CategoryToPost" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CategoryToPost_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CategoryToPost_B_index" ON "_CategoryToPost"("B");

-- CreateIndex
CREATE UNIQUE INDEX "category_url_key" ON "category"("url");

-- AddForeignKey
ALTER TABLE "_CategoryToPost" ADD CONSTRAINT "_CategoryToPost_A_fkey" FOREIGN KEY ("A") REFERENCES "category"("cate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToPost" ADD CONSTRAINT "_CategoryToPost_B_fkey" FOREIGN KEY ("B") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
