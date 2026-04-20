/*
  Warnings:

  - Added the required column `subjectsId` to the `courses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_subject_id_fkey";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "subjectsId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectsId_fkey" FOREIGN KEY ("subjectsId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
