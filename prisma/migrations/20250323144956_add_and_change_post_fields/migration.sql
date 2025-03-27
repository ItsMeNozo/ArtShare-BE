/*
  Warnings:

  - Added the required column `thumbnail_url` to the `post` table without a default value. This is not possible if the table is not empty.
  - Made the column `title` on table `post` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "post" ADD COLUMN     "thumbnail_url" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ALTER COLUMN "title" SET NOT NULL;
