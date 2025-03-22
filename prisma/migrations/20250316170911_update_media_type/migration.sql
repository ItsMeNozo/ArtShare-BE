/*
  Warnings:

  - The values [IMAGE,VIDEO] on the enum `MediaType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MediaType_new" AS ENUM ('image', 'video');
ALTER TABLE "media" ALTER COLUMN "media_type" TYPE "MediaType_new" USING ("media_type"::text::"MediaType_new");
ALTER TYPE "MediaType" RENAME TO "MediaType_old";
ALTER TYPE "MediaType_new" RENAME TO "MediaType";
DROP TYPE "MediaType_old";
COMMIT;
