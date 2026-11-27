-- Mobile Physical Count tables (ADDITIVE ONLY). Apply with:
--   npx prisma db execute --file prisma/sql/2026-11-27-mobile-count.sql --schema prisma/schema.prisma
-- Do NOT use 'npm run db:push' on production: it would DROP the inventory_repair_backup_* tables.
-- AlterTable
ALTER TABLE "inventory_corrections" ADD COLUMN     "count_session_id" INTEGER;




-- CreateTable
CREATE TABLE "count_sessions" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "location_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "active_location_id" INTEGER,
    "started_by" INTEGER NOT NULL,
    "started_by_name" VARCHAR(191) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_by" INTEGER,
    "submitted_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "send_back_note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "count_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "count_session_counters" (
    "session_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_name" VARCHAR(191) NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMP(3),

    CONSTRAINT "count_session_counters_pkey" PRIMARY KEY ("session_id","user_id")
);

-- CreateTable
CREATE TABLE "count_lines" (
    "id" VARCHAR(36) NOT NULL,
    "session_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_variation_id" INTEGER NOT NULL,
    "qty" DECIMAL(22,4) NOT NULL,
    "spot" VARCHAR(100),
    "counted_by" INTEGER NOT NULL,
    "counted_by_name" VARCHAR(191) NOT NULL,
    "counted_at" TIMESTAMP(3) NOT NULL,
    "system_qty_at_count" DECIMAL(22,4) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "count_line_edits" (
    "id" SERIAL NOT NULL,
    "line_id" VARCHAR(36) NOT NULL,
    "old_qty" DECIMAL(22,4) NOT NULL,
    "new_qty" DECIMAL(22,4),
    "edited_by" INTEGER NOT NULL,
    "edited_by_name" VARCHAR(191) NOT NULL,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "count_line_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "count_unknown_items" (
    "id" VARCHAR(36) NOT NULL,
    "session_id" INTEGER NOT NULL,
    "scanned_code" VARCHAR(191),
    "description" VARCHAR(500) NOT NULL,
    "qty" DECIMAL(22,4) NOT NULL,
    "counted_by" INTEGER NOT NULL,
    "counted_by_name" VARCHAR(191) NOT NULL,
    "counted_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "count_unknown_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "count_sessions_active_location_id_key" ON "count_sessions"("active_location_id");

-- CreateIndex
CREATE INDEX "count_sessions_business_id_status_idx" ON "count_sessions"("business_id", "status");

-- CreateIndex
CREATE INDEX "count_sessions_location_id_idx" ON "count_sessions"("location_id");

-- CreateIndex
CREATE INDEX "count_lines_session_id_product_variation_id_idx" ON "count_lines"("session_id", "product_variation_id");

-- CreateIndex
CREATE INDEX "count_line_edits_line_id_idx" ON "count_line_edits"("line_id");

-- CreateIndex
CREATE INDEX "count_unknown_items_session_id_idx" ON "count_unknown_items"("session_id");

-- AddForeignKey
ALTER TABLE "count_session_counters" ADD CONSTRAINT "count_session_counters_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_line_edits" ADD CONSTRAINT "count_line_edits_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "count_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_unknown_items" ADD CONSTRAINT "count_unknown_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One posting per item per count session (existing rows have NULL count_session_id, so they are unaffected)
CREATE UNIQUE INDEX "inventory_corrections_count_session_id_product_variation_id_key" ON "inventory_corrections"("count_session_id", "product_variation_id");
