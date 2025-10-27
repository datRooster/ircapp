/*
  Warnings:

  - Added the required column `createdBy` to the `channels` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChannelCategory" AS ENUM ('GENERAL', 'ADMIN', 'MODERATION', 'PRIVATE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'OWNER');

-- AlterTable
ALTER TABLE "channel_members" ADD COLUMN     "canBan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canInvite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canKick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canRead" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canWrite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "category" "ChannelCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxMembers" INTEGER,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "requiredRole" TEXT NOT NULL DEFAULT 'user';

-- Update existing channels to have admin as creator
UPDATE "channels" SET "createdBy" = 'cmh3mmgnj000010ltgvxfwdc3' WHERE "createdBy" IS NULL;

-- Make createdBy NOT NULL after updating existing records
ALTER TABLE "channels" ALTER COLUMN "createdBy" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedUntil" TIMESTAMP(3),
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "primaryRole" "UserRole" NOT NULL DEFAULT 'USER';

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
