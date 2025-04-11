-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_parent_comment_id_fkey";

-- AlterTable
ALTER TABLE "blog" ADD COLUMN     "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "is_protected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "bookmark" (
    "user_id" TEXT NOT NULL,
    "blog_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmark_pkey" PRIMARY KEY ("user_id","blog_id")
);

-- CreateTable
CREATE TABLE "rating" (
    "user_id" TEXT NOT NULL,
    "blog_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_pkey" PRIMARY KEY ("user_id","blog_id")
);

-- CreateTable
CREATE TABLE "_CategoryToBlog" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CategoryToBlog_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "bookmark_blog_id_idx" ON "bookmark"("blog_id");

-- CreateIndex
CREATE INDEX "rating_blog_id_idx" ON "rating"("blog_id");

-- CreateIndex
CREATE INDEX "_CategoryToBlog_B_index" ON "_CategoryToBlog"("B");

-- CreateIndex
CREATE INDEX "blog_user_id_idx" ON "blog"("user_id");

-- CreateIndex
CREATE INDEX "blog_created_at_idx" ON "blog"("created_at");

-- CreateIndex
CREATE INDEX "comment_parent_comment_id_idx" ON "comment"("parent_comment_id");

-- CreateIndex
CREATE INDEX "follow_follower_id_idx" ON "follow"("follower_id");

-- CreateIndex
CREATE INDEX "follow_following_id_idx" ON "follow"("following_id");

-- CreateIndex
CREATE INDEX "media_post_id_idx" ON "media"("post_id");

-- CreateIndex
CREATE INDEX "post_user_id_idx" ON "post"("user_id");

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToBlog" ADD CONSTRAINT "_CategoryToBlog_A_fkey" FOREIGN KEY ("A") REFERENCES "blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToBlog" ADD CONSTRAINT "_CategoryToBlog_B_fkey" FOREIGN KEY ("B") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
