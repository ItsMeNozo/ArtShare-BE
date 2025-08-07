-- AlterTable
ALTER TABLE "media" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "thumbnail_height" INTEGER,
ADD COLUMN     "thumbnail_width" INTEGER;
