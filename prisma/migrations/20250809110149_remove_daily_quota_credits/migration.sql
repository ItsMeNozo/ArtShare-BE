/*
  Warnings:

  - You are about to drop the column `daily_quota_credits` on the `plans` table. All the data in the column will be lost.
  - Made the column `monthly_quota_credits` on table `plans` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "plans" DROP COLUMN "daily_quota_credits",
ALTER COLUMN "monthly_quota_credits" SET NOT NULL;
