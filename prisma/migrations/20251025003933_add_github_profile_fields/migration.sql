-- AlterTable
ALTER TABLE "users" ADD COLUMN     "githubBio" TEXT,
ADD COLUMN     "githubFollowers" INTEGER,
ADD COLUMN     "githubLocation" TEXT,
ADD COLUMN     "githubRepos" INTEGER,
ADD COLUMN     "githubUrl" TEXT;
