-- AlterTable
ALTER TABLE "category" ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "comment" ALTER COLUMN "updated_at" DROP NOT NULL;
