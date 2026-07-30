ALTER TABLE donations
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE donations
ADD COLUMN IF NOT EXISTS review_action varchar(20);

UPDATE donations
SET reviewed_at = updated_at
WHERE reviewed_by IS NOT NULL
  AND reviewed_at IS NULL;

UPDATE donations AS d
SET review_action = CASE
  WHEN d.status = 'rejected'
    AND EXISTS (
      SELECT 1
      FROM donation_items AS i
      WHERE i.donation_id = d.id
        AND i.checked_at IS NOT NULL
    ) THEN 'accepted'
  WHEN d.status = 'rejected' THEN 'rejected'
  ELSE 'accepted'
END
WHERE d.reviewed_by IS NOT NULL
  AND d.review_action IS NULL;
