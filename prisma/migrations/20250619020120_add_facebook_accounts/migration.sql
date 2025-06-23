-- AlterTable
ALTER TABLE "platform" ADD COLUMN     "facebook_account_id" INTEGER;

-- CreateTable
CREATE TABLE "facebook_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "facebook_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picture_url" TEXT,
    "long_lived_user_access_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facebook_accounts_facebook_user_id_key" ON "facebook_accounts"("facebook_user_id");

-- AddForeignKey
ALTER TABLE "platform" ADD CONSTRAINT "platform_facebook_account_id_fkey" FOREIGN KEY ("facebook_account_id") REFERENCES "facebook_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
