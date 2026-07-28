-- One conversation per group-user pair.
-- Apply to communication_db before deploying communication-service changes.
BEGIN;

CREATE TEMP TABLE conversation_merge_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY group_id, user_id
      ORDER BY last_message_at DESC NULLS LAST, created_at ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY group_id, user_id
      ORDER BY last_message_at DESC NULLS LAST, created_at ASC
    ) AS position
  FROM conversations
)
SELECT id AS old_id, keep_id
FROM ranked
WHERE position > 1;

UPDATE messages m
SET conversation_id = map.keep_id
FROM conversation_merge_map map
WHERE m.conversation_id = map.old_id;

INSERT INTO message_reads (conversation_id, user_id, last_read_at)
SELECT map.keep_id, mr.user_id, max(mr.last_read_at)
FROM message_reads mr
JOIN conversation_merge_map map ON map.old_id = mr.conversation_id
GROUP BY map.keep_id, mr.user_id
ON CONFLICT (conversation_id, user_id) DO UPDATE
SET last_read_at = GREATEST(
  message_reads.last_read_at,
  EXCLUDED.last_read_at
);

DELETE FROM message_reads mr
USING conversation_merge_map map
WHERE mr.conversation_id = map.old_id;

DELETE FROM conversations c
USING conversation_merge_map map
WHERE c.id = map.old_id;

ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_context_type_context_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_group_user
ON conversations(group_id, user_id);

COMMIT;
