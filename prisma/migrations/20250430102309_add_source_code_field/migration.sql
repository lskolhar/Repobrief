/*
  Warnings:

  - Added the required column `sourceCode` to the `SourceCodeEmbedding` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SourceCodeEmbedding" ADD COLUMN     "sourceCode" TEXT NOT NULL;
