-- Email verification, user account management and OTP lifecycle.
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve existing accounts created before this migration; new registrations remain unverified.
UPDATE "User" SET "emailVerified" = true;

CREATE TABLE "EmailVerificationCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailVerificationCode_userId_createdAt_idx" ON "EmailVerificationCode"("userId", "createdAt");
CREATE INDEX "EmailVerificationCode_expiresAt_consumedAt_idx" ON "EmailVerificationCode"("expiresAt", "consumedAt");
ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
