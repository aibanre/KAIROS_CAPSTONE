async function recordReservationStatusHistory(connection, reservationId, fromStatus, toStatus, actorType = 'system', actorId = null, reason = null) {
  if (fromStatus === toStatus) return;
  if (!['customer', 'staff', 'system'].includes(actorType)) {
    throw new Error(`Invalid reservation status history actor type: ${actorType}`);
  }
  if (actorType !== 'system' && (!Number.isInteger(Number(actorId)) || Number(actorId) <= 0)) {
    throw new Error(`A valid ${actorType} actor id is required for reservation status history.`);
  }
  const changedBy = actorType === 'staff' ? Number(actorId) : null;
  const changedByCustomerId = actorType === 'customer' ? Number(actorId) : null;
  await connection.query(
    `INSERT INTO Reservation_Status_History
      (reservation_id, from_status, to_status, actor_type, changed_by, changed_by_customer_id, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reservationId, fromStatus || null, toStatus, actorType, changedBy, changedByCustomerId, reason]
  );
}

module.exports = { recordReservationStatusHistory };
