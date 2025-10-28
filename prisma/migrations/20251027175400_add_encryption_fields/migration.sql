-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "encrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "iv" TEXT,
ADD COLUMN     "keyId" TEXT;
