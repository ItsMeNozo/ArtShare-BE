/*
  Warnings:

  - You are about to drop the column `creator` on the `media` table. All the data in the column will be lost.
  - Added the required column `creator_id` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "media" DROP COLUMN "creator",
ADD COLUMN     "creator_id" INTEGER NOT NULL;
