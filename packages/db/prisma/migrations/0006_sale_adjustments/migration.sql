-- Add post-sale adjustment audit records for finished ticket corrections.

CREATE TYPE "sale_adjustment_type" AS ENUM ('worker_correction', 'service_label_correction', 'note');

CREATE TABLE "sale_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "sale_item_id" UUID,
    "type" "sale_adjustment_type" NOT NULL,
    "previous_value_json" JSONB NOT NULL,
    "new_value_json" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "approved_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_adjustments_sale_id_idx" ON "sale_adjustments"("sale_id");
CREATE INDEX "sale_adjustments_sale_item_id_idx" ON "sale_adjustments"("sale_item_id");

ALTER TABLE "sale_adjustments" ADD CONSTRAINT "sale_adjustments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_adjustments" ADD CONSTRAINT "sale_adjustments_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
