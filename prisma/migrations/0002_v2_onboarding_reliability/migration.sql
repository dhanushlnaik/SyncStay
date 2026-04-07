-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HotelRegistrationStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('PROPERTY_LOGO', 'PROPERTY_IMAGE', 'GSTIN_DOC', 'PAN_DOC', 'TRADE_LICENSE_DOC', 'ADDRESS_PROOF_DOC');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReconciliationIssueStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReplayRequestStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ONBOARDING_SUBMITTED', 'ONBOARDING_APPROVED', 'ONBOARDING_REJECTED', 'SYNC_FAILURE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ownerApprovalStatus" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN "registrationStatus" "HotelRegistrationStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- AlterTable
ALTER TABLE "SyncLog" ADD COLUMN "idempotencyKey" TEXT;

-- Grandfather existing users/hotels
UPDATE "User" SET "ownerApprovalStatus" = 'APPROVED' WHERE "role" IN ('OWNER', 'MASTER_ADMIN');
UPDATE "Hotel" SET "registrationStatus" = 'ACTIVE';

-- CreateTable
CREATE TABLE "OwnerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "legalBusinessName" TEXT NOT NULL,
  "gstin" TEXT NOT NULL,
  "pan" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerOnboarding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyRegistration" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
  "legalPropertyName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "hotelId" TEXT,
  "propertyRegistrationId" TEXT,
  "assetType" "MediaAssetType" NOT NULL,
  "visibility" "MediaVisibility" NOT NULL,
  "cloudinaryPublicId" TEXT NOT NULL,
  "secureUrl" TEXT NOT NULL,
  "version" INTEGER,
  "bytes" INTEGER,
  "mimeType" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeState" JSONB,
  "afterState" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "responseCode" INTEGER,
  "responseBody" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncReconciliationRun" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "triggeredById" TEXT,
  "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "totalChecked" INTEGER NOT NULL DEFAULT 0,
  "issuesFound" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncReconciliationIssue" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "platformConfigId" TEXT,
  "roomTypeId" TEXT,
  "date" TIMESTAMP(3),
  "expectedAvailable" INTEGER,
  "actualAvailable" INTEGER,
  "severity" "ReconciliationIssueSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "ReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
  "payload" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncReplayRequest" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "syncLogId" TEXT,
  "requestedById" TEXT NOT NULL,
  "status" "ReplayRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncReplayRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerProfile_userId_key" ON "OwnerProfile"("userId");
CREATE INDEX "OwnerProfile_gstin_idx" ON "OwnerProfile"("gstin");
CREATE INDEX "OwnerProfile_pan_idx" ON "OwnerProfile"("pan");

CREATE UNIQUE INDEX "OwnerOnboarding_userId_key" ON "OwnerOnboarding"("userId");
CREATE INDEX "OwnerOnboarding_status_idx" ON "OwnerOnboarding"("status");
CREATE INDEX "OwnerOnboarding_reviewedById_idx" ON "OwnerOnboarding"("reviewedById");

CREATE UNIQUE INDEX "PropertyRegistration_hotelId_key" ON "PropertyRegistration"("hotelId");
CREATE UNIQUE INDEX "PropertyRegistration_slug_key" ON "PropertyRegistration"("slug");
CREATE INDEX "PropertyRegistration_ownerId_idx" ON "PropertyRegistration"("ownerId");
CREATE INDEX "PropertyRegistration_status_idx" ON "PropertyRegistration"("status");

CREATE UNIQUE INDEX "MediaAsset_cloudinaryPublicId_key" ON "MediaAsset"("cloudinaryPublicId");
CREATE INDEX "MediaAsset_ownerId_idx" ON "MediaAsset"("ownerId");
CREATE INDEX "MediaAsset_hotelId_idx" ON "MediaAsset"("hotelId");
CREATE INDEX "MediaAsset_assetType_idx" ON "MediaAsset"("assetType");
CREATE INDEX "MediaAsset_propertyRegistrationId_idx" ON "MediaAsset"("propertyRegistrationId");

CREATE INDEX "ApprovalAuditLog_actorId_idx" ON "ApprovalAuditLog"("actorId");
CREATE INDEX "ApprovalAuditLog_entityType_entityId_idx" ON "ApprovalAuditLog"("entityType", "entityId");
CREATE INDEX "ApprovalAuditLog_createdAt_idx" ON "ApprovalAuditLog"("createdAt");

CREATE UNIQUE INDEX "IdempotencyKey_key_userId_key" ON "IdempotencyKey"("key", "userId");
CREATE INDEX "IdempotencyKey_status_idx" ON "IdempotencyKey"("status");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

CREATE INDEX "SyncReconciliationRun_hotelId_idx" ON "SyncReconciliationRun"("hotelId");
CREATE INDEX "SyncReconciliationRun_status_idx" ON "SyncReconciliationRun"("status");
CREATE INDEX "SyncReconciliationRun_createdAt_idx" ON "SyncReconciliationRun"("createdAt");

CREATE INDEX "SyncReconciliationIssue_runId_idx" ON "SyncReconciliationIssue"("runId");
CREATE INDEX "SyncReconciliationIssue_hotelId_idx" ON "SyncReconciliationIssue"("hotelId");
CREATE INDEX "SyncReconciliationIssue_status_idx" ON "SyncReconciliationIssue"("status");
CREATE INDEX "SyncReconciliationIssue_severity_idx" ON "SyncReconciliationIssue"("severity");

CREATE INDEX "SyncReplayRequest_jobId_idx" ON "SyncReplayRequest"("jobId");
CREATE INDEX "SyncReplayRequest_hotelId_idx" ON "SyncReplayRequest"("hotelId");
CREATE INDEX "SyncReplayRequest_status_idx" ON "SyncReplayRequest"("status");

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

CREATE INDEX "User_ownerApprovalStatus_idx" ON "User"("ownerApprovalStatus");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "Hotel_registrationStatus_idx" ON "Hotel"("registrationStatus");
CREATE INDEX "SyncLog_correlationId_idx" ON "SyncLog"("correlationId");

-- AddForeignKey
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerOnboarding" ADD CONSTRAINT "OwnerOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerOnboarding" ADD CONSTRAINT "OwnerOnboarding_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyRegistration" ADD CONSTRAINT "PropertyRegistration_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyRegistration" ADD CONSTRAINT "PropertyRegistration_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_propertyRegistrationId_fkey" FOREIGN KEY ("propertyRegistrationId") REFERENCES "PropertyRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalAuditLog" ADD CONSTRAINT "ApprovalAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncReconciliationRun" ADD CONSTRAINT "SyncReconciliationRun_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncReconciliationRun" ADD CONSTRAINT "SyncReconciliationRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncReconciliationIssue" ADD CONSTRAINT "SyncReconciliationIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncReconciliationIssue" ADD CONSTRAINT "SyncReconciliationIssue_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncReconciliationIssue" ADD CONSTRAINT "SyncReconciliationIssue_platformConfigId_fkey" FOREIGN KEY ("platformConfigId") REFERENCES "HotelPlatformConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncReconciliationIssue" ADD CONSTRAINT "SyncReconciliationIssue_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncReplayRequest" ADD CONSTRAINT "SyncReplayRequest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncReplayRequest" ADD CONSTRAINT "SyncReplayRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncReplayRequest" ADD CONSTRAINT "SyncReplayRequest_syncLogId_fkey" FOREIGN KEY ("syncLogId") REFERENCES "SyncLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
