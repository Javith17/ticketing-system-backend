-- Ticketing System schema.
-- This file is executed on every application deployment (see scripts/migrate.js
-- and docker-entrypoint.sh). synchronize is disabled in TypeORM, so ALL schema
-- changes must be made here using idempotent statements (IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS) so re-running this file on an existing database is safe.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The old ticket_comments/ticket_attachments tables (from the previous
-- tickets module design) were dropped and are not coming back; removes them
-- from any database that still has them from before that change.
DROP TABLE IF EXISTS "ticket_attachments" CASCADE;
DROP TABLE IF EXISTS "ticket_comments" CASCADE;

CREATE TABLE IF NOT EXISTS "features" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "feature" character varying NOT NULL,
    "is_approval" boolean NOT NULL DEFAULT false,
    "description" character varying NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "roles" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "role_name" character varying NOT NULL,
    "role_code" character varying NOT NULL UNIQUE,
    "features" jsonb DEFAULT '[]'::jsonb,
    "approvals" jsonb DEFAULT '[]'::jsonb,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "full_name" character varying NOT NULL,
    "email" character varying NOT NULL UNIQUE,
    "password" character varying NOT NULL,
    "employee_code" character varying UNIQUE,
    "first_name" character varying,
    "last_name" character varying,
    "designation" character varying,
    "role_id" uuid NOT NULL,
    "phone" character varying,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_users_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id")
);

CREATE TABLE IF NOT EXISTS "sources" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "source_name" character varying NOT NULL,
    "description" text,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "categories" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "category_code" character varying NOT NULL UNIQUE,
    "category_name" character varying NOT NULL,
    "description" text,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "assets" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "asset_name" character varying NOT NULL,
    "panel" character varying,
    "site" character varying,
    "location" character varying,
    "coordinates" jsonb,
    "description" text,
    "barcode" character varying NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public_users" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "guest_id" character varying NOT NULL,
    "first_name" character varying,
    "last_name" character varying,
    "email" character varying,
    "is_verified" boolean NOT NULL DEFAULT false,
    "os_type" character varying NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "tickets" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "ticket_id" character varying NOT NULL UNIQUE,
    "issue" character varying NOT NULL,
    "description" text NOT NULL,
    "asset_id" uuid NOT NULL,
    "source" character varying NOT NULL,
    "user_id" uuid,
    "public_user_id" uuid,
    "status" character varying NOT NULL DEFAULT 'Open',
    "priority" character varying NOT NULL DEFAULT 'Medium',
    "assigned_to" uuid,
    "due_at" timestamptz,
    "resolved_at" timestamptz,
    "image_path" character varying,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fk_tickets_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id"),
    CONSTRAINT "fk_tickets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
    CONSTRAINT "fk_tickets_public_user" FOREIGN KEY ("public_user_id") REFERENCES "public_users"("id"),
    CONSTRAINT "fk_tickets_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "idx_users_role_id" ON "users" ("role_id");
CREATE INDEX IF NOT EXISTS "idx_assets_site" ON "assets" ("site");
CREATE INDEX IF NOT EXISTS "idx_assets_location" ON "assets" ("location");
CREATE INDEX IF NOT EXISTS "idx_assets_panel" ON "assets" ("panel");
CREATE INDEX IF NOT EXISTS "idx_public_users_guest_id" ON "public_users" ("guest_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_asset_id" ON "tickets" ("asset_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_status" ON "tickets" ("status");
CREATE INDEX IF NOT EXISTS "idx_tickets_public_user_id" ON "tickets" ("public_user_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_assigned_to" ON "tickets" ("assigned_to");

-- Backs the application-level duplicate-name validation on these master-data tables.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_roles_role_name" ON "roles" ("role_name");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_features_feature" ON "features" ("feature");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sources_source_name" ON "sources" ("source_name");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_category_name" ON "categories" ("category_name");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_assets_name_panel_location" ON "assets" ("asset_name", "panel", "location");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_assets_barcode" ON "assets" ("barcode");

-- Existing databases created before "features"/"approvals" were added to roles,
-- and before employee_code/first_name/last_name/designation were added to users
-- (CREATE TABLE IF NOT EXISTS above only applies to brand new databases).
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "features" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "approvals" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employee_code" character varying UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" character varying;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" character varying;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "designation" character varying;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "barcode" character varying;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "image_path" character varying;

-- Seed default role and admin user (local/dev only - change the password after first login).
-- Password: admin123
INSERT INTO "roles" ("id", "role_name", "role_code", "features", "approvals")
VALUES ('9cf85834-0841-4c25-adf8-b4d2e077ec4b', 'Administrator', 'ADMIN', '["*"]'::jsonb, '["*"]'::jsonb)
ON CONFLICT ("role_code") DO NOTHING;

INSERT INTO "users" ("id", "full_name", "email", "password", "role_id")
VALUES (
    '64f62c4e-0766-49f6-9a6b-e3a8bc6a1562',
    'Administrator',
    'admin@example.com',
    '$2a$10$oxMhSgaAcywZvf5dCNUkEObrshLVtwXRgP8qU0RZ.bIsym0d7/uGG',
    '9cf85834-0841-4c25-adf8-b4d2e077ec4b'
)
ON CONFLICT ("email") DO NOTHING;

-- Example of how future schema changes should be appended below, idempotently:
-- ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "notes" text;

-- RSM/Technician assignment workflow (Under Review -> Open -> Assigned RSM -> Assigned Technician).
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "assigned_rsm" uuid;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "return_remarks" jsonb DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS "idx_tickets_assigned_rsm" ON "tickets" ("assigned_rsm");

CREATE TABLE IF NOT EXISTS "ticket_history" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "ticket_id" uuid NOT NULL,
    "event_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" character varying NOT NULL,
    "event_user" uuid,
    "event_detail" text NOT NULL,
    CONSTRAINT "fk_ticket_history_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id"),
    CONSTRAINT "fk_ticket_history_user" FOREIGN KEY ("event_user") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "idx_ticket_history_ticket_id" ON "ticket_history" ("ticket_id");

-- Technician execution workflow (Assigned Technician -> In Progress -> Started ->
-- Closure Approval -> Ticket Closed), plus the log-only "Add Findings" event.
CREATE TABLE IF NOT EXISTS "ticket_details" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "ticket_id" uuid NOT NULL,
    "event" character varying NOT NULL,
    "event_by" uuid,
    "event_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" text,
    "test_values" text,
    "attachments" jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT "fk_ticket_details_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id"),
    CONSTRAINT "fk_ticket_details_user" FOREIGN KEY ("event_by") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "idx_ticket_details_ticket_id" ON "ticket_details" ("ticket_id");

-- Who assigned RSM/Technician and when, as a jsonb object: {assigned_by, assigned_at}.
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "rsm_assigned" jsonb;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "technician_assigned" jsonb;

-- FCM device token for push notifications, set via PATCH /users/update-notification-token.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_token" character varying;

-- NCR (Non-Conformance Report) workflow: raised by a technician against a
-- ticket, reviewed by Quality, approved/rejected by PM_DH, an optional
-- material-request/approval cycle with Production Head, then closed in three
-- stages (Technician -> PM_DH -> Quality).
CREATE TABLE IF NOT EXISTS "ncr_tickets" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "ticket_id" character varying NOT NULL UNIQUE,        -- e.g. NCR_000001
  "linked_tickets" jsonb DEFAULT '[]'::jsonb,            -- [{ticket_id (uuid of tickets.id), ticket_no (tickets.ticket_id)}]
  "description" text NOT NULL,
  "status" character varying NOT NULL DEFAULT 'In-Review',
  "raised_by" uuid REFERENCES "users"("id"),             -- technician who raised it (needed for audit/attribution)
  "review_detail" jsonb DEFAULT '[]'::jsonb,             -- [{review_type, reviewed_by, reviewed_at, review_remarks}]
  "approval_details" jsonb DEFAULT '[]'::jsonb,          -- [{approval_type, approved_by, approved_at, approval_remarks}]
  "closure_details" jsonb DEFAULT '[]'::jsonb,           -- [{closure_type, closure_remarks, closure_by, closure_at, closure_attachments:[]}]
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Who actually created the NCR row. Normally the same as raised_by (the
-- technician); differs when a super admin (ADMIN) raises an NCR from the web
-- app on behalf of a technician - raised_by is then the chosen technician and
-- created_by the admin, so the audit trail keeps both.
ALTER TABLE "ncr_tickets" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "users"("id");

CREATE TABLE IF NOT EXISTS "ncr_material_request" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "ncr_ticket_id" uuid NOT NULL REFERENCES "ncr_tickets"("id"),
  "remarks" text,
  "status" character varying NOT NULL DEFAULT 'Initiated',   -- Initiated -> Approved -> Issued -> Received -> Returned -> Dispositioned
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ncr_material_request_detail" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "ncr_ticket_id" uuid NOT NULL REFERENCES "ncr_tickets"("id"),
  "ncr_material_request_id" uuid NOT NULL REFERENCES "ncr_material_request"("id"),
  "material_name" character varying NOT NULL,
  "material_qty" numeric NOT NULL,
  "approved_qty" numeric,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- NCR numbers (NCR_000001, ...) come from this sequence instead of
-- COUNT(*) + 1, so two NCRs raised at the same moment can never get the same
-- number. On every run the sequence is moved up to the highest NCR number
-- already in the table (never down), so existing databases continue from
-- where they are.
CREATE SEQUENCE IF NOT EXISTS "ncr_ticket_no_seq";
DO $$
DECLARE
  max_no bigint;
  seq_no bigint;
BEGIN
  SELECT COALESCE(MAX(CAST(substring("ticket_id" FROM '^NCR_([0-9]+)$') AS bigint)), 0)
    INTO max_no
    FROM "ncr_tickets";
  SELECT CASE WHEN is_called THEN last_value ELSE 0 END
    INTO seq_no
    FROM "ncr_ticket_no_seq";
  IF max_no > seq_no THEN
    PERFORM setval('"ncr_ticket_no_seq"', max_no);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ncr_material_request_ncr_ticket_id" ON "ncr_material_request" ("ncr_ticket_id");
CREATE INDEX IF NOT EXISTS "idx_ncr_material_request_detail_request_id" ON "ncr_material_request_detail" ("ncr_material_request_id");

-- Stores issue / technician receipt / failed-item return cycle (process flow
-- steps #39-#44). After Production Head approves a material request it goes
-- to Stores (#39), Stores issues it with serial/batch numbers (#40), the
-- technician confirms receipt (#42), optionally returns the failed item (#43)
-- and Stores records what happens to it (#44).
ALTER TABLE "ncr_material_request" ADD COLUMN IF NOT EXISTS "issue_remarks" text;
ALTER TABLE "ncr_material_request" ADD COLUMN IF NOT EXISTS "issued_by" uuid REFERENCES "users"("id");
ALTER TABLE "ncr_material_request" ADD COLUMN IF NOT EXISTS "issued_at" timestamptz;
ALTER TABLE "ncr_material_request" ADD COLUMN IF NOT EXISTS "receipt_remarks" text;
ALTER TABLE "ncr_material_request" ADD COLUMN IF NOT EXISTS "received_by" uuid REFERENCES "users"("id");
ALTER TABLE "ncr_material_request" ADD COLUMN IF NOT EXISTS "received_at" timestamptz;
ALTER TABLE "ncr_material_request_detail" ADD COLUMN IF NOT EXISTS "issued_qty" numeric;

-- One row per issued quantity of a material line: a line can be issued as
-- several rows (e.g. 4 serialised units = 4 rows of qty 1, or one batch row).
CREATE TABLE IF NOT EXISTS "ncr_material_issue" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "ncr_ticket_id" uuid NOT NULL REFERENCES "ncr_tickets"("id"),
  "ncr_material_request_id" uuid NOT NULL REFERENCES "ncr_material_request"("id"),
  "ncr_material_request_detail_id" uuid NOT NULL REFERENCES "ncr_material_request_detail"("id"),
  "quantity" numeric NOT NULL,
  "serial_no" character varying,
  "batch_no" character varying,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_ncr_material_issue_request_id" ON "ncr_material_issue" ("ncr_material_request_id");

-- Failed items the technician hands back to Stores, and Stores' disposition
-- of each one. detail_id is optional: the failed part need not match an
-- issued line.
CREATE TABLE IF NOT EXISTS "ncr_material_return" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "ncr_ticket_id" uuid NOT NULL REFERENCES "ncr_tickets"("id"),
  "ncr_material_request_id" uuid NOT NULL REFERENCES "ncr_material_request"("id"),
  "ncr_material_request_detail_id" uuid REFERENCES "ncr_material_request_detail"("id"),
  "item_name" character varying NOT NULL,
  "quantity" numeric NOT NULL,
  "serial_no" character varying,
  "batch_no" character varying,
  "condition_remarks" text,
  "attachments" jsonb DEFAULT '[]'::jsonb,
  "returned_by" uuid REFERENCES "users"("id"),
  "returned_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "disposition" character varying,      -- Scrap | Repair & reuse | Return to vendor / warranty claim | Quarantine for Quality
  "disposition_remarks" text,
  "disposition_by" uuid REFERENCES "users"("id"),
  "disposition_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_ncr_material_return_request_id" ON "ncr_material_return" ("ncr_material_request_id");

-- Stores role used by the NCR material issue / disposition steps. Features
-- give it field ops app access; adjust on the Roles & Features page. DO
-- NOTHING (no target) also skips it if a role named 'Stores' already exists.
INSERT INTO "roles" ("role_name", "role_code", "features", "approvals")
VALUES ('Stores', 'STORES', '["Mobile App"]'::jsonb, '[]'::jsonb)
ON CONFLICT DO NOTHING;

-- Email account used to send outgoing mail (ticket/NCR notifications, test
-- emails from Settings > Email Settings). Only one active row is expected;
-- email_password_encrypted is AES-256-GCM encrypted (EMAIL_ENCRYPTION_KEY),
-- never returned in API responses.
CREATE TABLE IF NOT EXISTS "email_settings" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "email_id" character varying NOT NULL,
  "email_password_encrypted" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Tickets move from Asset-based to Pole-based (Location -> Section -> Pole,
-- served by the external master-data API via /master-details). Poles are not
-- a local table, so these are denormalized columns, not FKs. pole_id/pole_name
-- are the only strictly required fields going forward; location_id/section_id
-- are optional (absent when the ticket was created via a mobile barcode scan,
-- which only resolves to pole/section/location names, not ids).
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "location_id" integer;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "location_name" character varying;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "section_id" integer;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "section_name" character varying;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pole_id" integer;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pole_name" character varying;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "longitude" double precision;
ALTER TABLE "tickets" ALTER COLUMN "asset_id" DROP NOT NULL;
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "fk_tickets_asset";
CREATE INDEX IF NOT EXISTS "idx_tickets_pole_id" ON "tickets" ("pole_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_section_id" ON "tickets" ("section_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_location_id" ON "tickets" ("location_id");

-- NCR Threshold alerting: one configurable row per scope (Location/Section/
-- Pole) with a max ticket count and a rolling day-window; breaches are logged
-- here and trigger an email to the same roles notified when an NCR is raised.
CREATE TABLE IF NOT EXISTS "ncr_alert_threshold" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "scope" character varying NOT NULL UNIQUE,
  "max_tickets" integer NOT NULL,
  "window_days" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ncr_alert_log" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "scope" character varying NOT NULL,
  "entity_name" character varying NOT NULL,
  "entity_id" integer,
  "ticket_count" integer NOT NULL,
  "window_days" integer NOT NULL,
  "alert_date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seen" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_ncr_alert_log_alert_date" ON "ncr_alert_log" ("alert_date");
CREATE INDEX IF NOT EXISTS "idx_ncr_alert_log_seen" ON "ncr_alert_log" ("seen");

-- Set once an NCR is raised directly from an alert (POST /ncr-alerts/:id/raise-ncr),
-- linking all tickets that matched the alert's scope/entity at that time.
-- Lets the alert popup show "View NCR" instead of "Raise NCR" afterwards.
ALTER TABLE "ncr_alert_log" ADD COLUMN IF NOT EXISTS "ncr_ticket_id" uuid;

