-- Normalize customer phone numbers, backfill missing values, then enforce required + unique.
WITH normalized AS (
  SELECT
    id,
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') AS digits,
    row_number() OVER (ORDER BY created_at, id) AS rn
  FROM customers
), fixed AS (
  SELECT
    id,
    CASE
      WHEN length(digits) = 10 THEN '+1' || digits
      WHEN length(digits) = 11 AND digits LIKE '1%' THEN '+' || digits
      WHEN length(digits) > 0 THEN '+' || digits
      ELSE '+199900' || lpad(rn::text, 5, '0')
    END AS normalized_phone
  FROM normalized
), deduped AS (
  SELECT
    id,
    normalized_phone,
    row_number() OVER (PARTITION BY normalized_phone ORDER BY id) AS phone_rank
  FROM fixed
)
UPDATE customers c
SET phone = CASE
  WHEN d.phone_rank = 1 THEN d.normalized_phone
  ELSE d.normalized_phone || '-' || d.phone_rank::text
END
FROM deduped d
WHERE c.id = d.id;

ALTER TABLE customers
  ALTER COLUMN phone SET NOT NULL;

CREATE UNIQUE INDEX customers_phone_key ON customers(phone);
