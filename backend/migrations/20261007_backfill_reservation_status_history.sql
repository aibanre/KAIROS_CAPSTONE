INSERT INTO Reservation_Status_History
  (
    reservation_id,
    from_status,
    to_status,
    actor_type,
    changed_by,
    changed_by_customer_id,
    reason,
    created_at
  )
SELECT
  r.reservation_id,
  NULL,
  r.status,
  'system',
  NULL,
  NULL,
  'Backfilled from existing reservation (original history unavailable)',
  COALESCE(r.updated_at, r.created_at)
FROM Reservations r
WHERE NOT EXISTS (
  SELECT 1
  FROM Reservation_Status_History h
  WHERE h.reservation_id = r.reservation_id
);
