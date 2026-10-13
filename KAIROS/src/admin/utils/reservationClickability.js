export function canOpenReservation(reservation) {
    const isCompleted = reservation.databaseStatus === 'completed' || reservation.status === 'Completed'
    const isFullyPaid = reservation.paymentSummary === 'fully_paid'
    const hadRoomAction = reservation.isRoom && reservation.payment !== 'Unpaid'
    const hadVenueAction = !reservation.isRoom
        && reservation.databaseStatus === 'confirmed'
        && reservation.payment === 'Deposit paid'
        && reservation.balanceDue > 0

    return isCompleted || isFullyPaid || hadRoomAction || hadVenueAction
}

