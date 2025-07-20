-- AlterTable
ALTER TABLE "auto_post" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "collection" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "conversation" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "facebook_accounts" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "rating" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "trending_prompts" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_access" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_usage" ALTER COLUMN "updated_at" DROP NOT NULL;
