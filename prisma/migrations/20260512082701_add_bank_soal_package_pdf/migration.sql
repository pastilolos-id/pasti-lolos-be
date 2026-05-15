/*
  Warnings:

  - You are about to drop the column `link` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "link",
DROP COLUMN "type",
ADD COLUMN     "notification_type" VARCHAR(50) NOT NULL DEFAULT 'info',
ADD COLUMN     "target_url" TEXT;

-- AlterTable
ALTER TABLE "question_banks" ADD COLUMN     "package_id_bank" INTEGER,
ADD COLUMN     "pdf_name" VARCHAR(255),
ADD COLUMN     "pdf_url" TEXT;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_package_id_bank_fkey" FOREIGN KEY ("package_id_bank") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
