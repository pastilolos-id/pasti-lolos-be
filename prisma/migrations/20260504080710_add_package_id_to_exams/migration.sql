-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "package_id" INTEGER;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
