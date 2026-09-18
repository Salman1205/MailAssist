-- Speed up the tickets list + counts, which filter by mailbox (user_email) and
-- status and sort by recency. With 10k+ tickets per mailbox and no supporting
-- index, every tab switch and every count did a sequential scan (multi-second).
--
-- Safe to run on a live table: 10k rows builds in well under a second. If you
-- prefer zero write-locking, run each statement with CREATE INDEX CONCURRENTLY
-- instead (one at a time, outside a transaction).

-- List: filter by mailbox + status, order by last customer reply (default sort).
CREATE INDEX IF NOT EXISTS tickets_useremail_status_lastreply_idx
  ON tickets (user_email, status, last_customer_reply_at DESC);

-- List (alternate sort) + generic recency ordering.
CREATE INDEX IF NOT EXISTS tickets_useremail_created_idx
  ON tickets (user_email, created_at DESC);

-- Counts: assigned / unassigned badges filter by mailbox + status + assignee.
CREATE INDEX IF NOT EXISTS tickets_useremail_status_assignee_idx
  ON tickets (user_email, status, assignee_user_id);
