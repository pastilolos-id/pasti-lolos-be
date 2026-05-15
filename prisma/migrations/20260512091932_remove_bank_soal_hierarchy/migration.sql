/*
  Warnings:

  - You are about to drop the column `package_id_bank` on the `question_banks` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "question_banks" DROP CONSTRAINT "question_banks_package_id_bank_fkey";

-- AlterTable
ALTER TABLE "question_banks" DROP COLUMN "package_id_bank";
