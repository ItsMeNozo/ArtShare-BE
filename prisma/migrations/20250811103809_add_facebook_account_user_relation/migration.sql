-- AddForeignKey
ALTER TABLE "facebook_accounts" ADD CONSTRAINT "facebook_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
