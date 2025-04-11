/*
  Warnings:

  - The primary key for the `like` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "like" DROP CONSTRAINT "like_pkey",
ADD CONSTRAINT "like_pkey" PRIMARY KEY ("user_id", "target_id", "target_type");

-- CreateTable
CREATE TABLE "blog" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "blog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_target_id_target_type_idx" ON "comment"("target_id", "target_type");

-- CreateIndex
CREATE INDEX "like_target_id_target_type_idx" ON "like"("target_id", "target_type");

-- CreateIndex
CREATE INDEX "share_target_id_target_type_idx" ON "share"("target_id", "target_type");

-- RenameForeignKey
ALTER TABLE "comment" RENAME CONSTRAINT "comment_target_id_fkey" TO "comment_post_fkey";

-- RenameForeignKey
ALTER TABLE "like" RENAME CONSTRAINT "like_target_id_fkey" TO "like_post_fkey";

-- RenameForeignKey
ALTER TABLE "share" RENAME CONSTRAINT "share_target_id_fkey" TO "share_post_fkey";

-- AddForeignKey
ALTER TABLE "blog" ADD CONSTRAINT "blog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "like" ADD CONSTRAINT "like_blog_fkey" FOREIGN KEY ("target_id") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_blog_fkey" FOREIGN KEY ("target_id") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share" ADD CONSTRAINT "share_blog_fkey" FOREIGN KEY ("target_id") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
