-- Create table to store historical X and Z reading summaries
CREATE TABLE IF NOT EXISTS "cashier_shift_readings" (
    "id" SERIAL PRIMARY KEY,
    "business_id" INTEGER NOT NULL,
    "location_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" CHAR(1) NOT NULL,
    "reading_number" INTEGER NOT NULL DEFAULT 1,
    "reading_time" TIMESTAMP(3) NOT NULL,
    "gross_sales" DECIMAL(22, 4) NOT NULL DEFAULT 0,
    "net_sales" DECIMAL(22, 4) NOT NULL DEFAULT 0,
    "total_discounts" DECIMAL(22, 4) NOT NULL DEFAULT 0,
    "expected_cash" DECIMAL(22, 4),
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "report_number" VARCHAR(100),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "cashier_shift_readings_shift_type_number_idx"
    ON "cashier_shift_readings" ("shift_id", "type", "reading_number");

CREATE INDEX IF NOT EXISTS "cashier_shift_readings_business_id_idx"
    ON "cashier_shift_readings" ("business_id");

CREATE INDEX IF NOT EXISTS "cashier_shift_readings_location_id_idx"
    ON "cashier_shift_readings" ("location_id");

CREATE INDEX IF NOT EXISTS "cashier_shift_readings_shift_id_idx"
    ON "cashier_shift_readings" ("shift_id");

CREATE INDEX IF NOT EXISTS "cashier_shift_readings_user_id_idx"
    ON "cashier_shift_readings" ("user_id");

CREATE INDEX IF NOT EXISTS "cashier_shift_readings_type_idx"
    ON "cashier_shift_readings" ("type");

CREATE INDEX IF NOT EXISTS "cashier_shift_readings_time_idx"
    ON "cashier_shift_readings" ("reading_time");

ALTER TABLE "cashier_shift_readings"
    ADD CONSTRAINT "cashier_shift_readings_shift_id_fkey"
        FOREIGN KEY ("shift_id") REFERENCES "cashier_shifts" ("id") ON DELETE CASCADE;
