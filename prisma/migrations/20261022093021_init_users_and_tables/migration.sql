-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "rolesJson" TEXT NOT NULL DEFAULT '["employee"]',
    "department" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "endorsement_count" INTEGER NOT NULL DEFAULT 0,
    "publish_credit_on_approval" INTEGER NOT NULL DEFAULT 1,
    "public_credit_json" TEXT,
    "decision_reason" TEXT,
    "author_subject" TEXT NOT NULL,
    "author_display_name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "accused_person_ids_json" TEXT NOT NULL,
    "council_version" INTEGER NOT NULL,
    "council_roster_hash" TEXT NOT NULL,
    "voter_count" INTEGER,
    "quorum_required" INTEGER,
    "voting_request_id" TEXT,
    "reporter_subject" TEXT NOT NULL,
    "reporter_display_name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "voting_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "resource_kind" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "voter_count" INTEGER NOT NULL,
    "quorum_required" INTEGER NOT NULL,
    "voters_json" TEXT NOT NULL,
    "valid_approvals" INTEGER NOT NULL DEFAULT 0,
    "independent_approved" INTEGER NOT NULL DEFAULT 0,
    "council_version" INTEGER NOT NULL,
    "context_hash" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "council" (
    "version" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roster_hash" TEXT NOT NULL,
    "members_json" TEXT NOT NULL,
    "selection_policy_json" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "resource_kind" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "actor_display_name" TEXT,
    "request_id" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_subject_key" ON "users"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
