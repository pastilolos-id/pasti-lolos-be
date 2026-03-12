-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_subject_id_fkey";

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
