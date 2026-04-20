/*
  Warnings:

  - You are about to drop the column `category_id` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `category_id` on the `subjects` table. All the data in the column will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_category_id_fkey";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "category_id",
ADD COLUMN     "topic_id" INTEGER;

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "category_id";

-- DropTable
DROP TABLE "categories";
