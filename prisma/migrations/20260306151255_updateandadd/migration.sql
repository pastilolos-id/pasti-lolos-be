/*
  Warnings:

  - Made the column `topic_id` on table `courses` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "topic_id" SET NOT NULL;
