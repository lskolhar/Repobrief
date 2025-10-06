/*
  Warnings:

  - A unique constraint covering the columns `[commitHash]` on the table `Commit` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Commit_commitHash_key" ON "Commit"("commitHash");
