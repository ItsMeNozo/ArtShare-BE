-- AlterTable
ALTER TABLE "conversation" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "user_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "message" ALTER COLUMN "conversation_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "daily_quota_credits" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_usage" ALTER COLUMN "feature_key" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "user_id" DROP DEFAULT;
