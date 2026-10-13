import { canOpenReservation } from './reservationClickability.js'

const cases = [
    { name: 'confirmed room with deposit paid', reservation: { databaseStatus: 'confirmed', isRoom: true, payment: 'Deposit paid', paymentSummary: 'deposit_paid', balanceDue: 50 }, expected: true },
    { name: 'confirmed room fully paid', reservation: { databaseStatus: 'confirmed', isRoom: true, payment: 'Fully paid', paymentSummary: 'fully_paid', balanceDue: 0 }, expected: true },
    { name: 'completed room', reservation: { databaseStatus: 'completed', isRoom: true, payment: 'Unpaid', paymentSummary: 'unpaid', balanceDue: 50 }, expected: true },
    { name: 'confirmed venue with deposit paid', reservation: { databaseStatus: 'confirmed', isRoom: false, payment: 'Deposit paid', paymentSummary: 'deposit_paid', balanceDue: 50 }, expected: true },
    { name: 'confirmed venue fully paid', reservation: { databaseStatus: 'confirmed', isRoom: false, payment: 'Paid', paymentSummary: 'fully_paid', balanceDue: 0 }, expected: true },
    { name: 'cancelled unpaid', reservation: { databaseStatus: 'cancelled', isRoom: true, payment: 'Unpaid', paymentSummary: 'unpaid', balanceDue: 100 }, expected: false },
    { name: 'pending unpaid', reservation: { databaseStatus: 'payment_pending', isRoom: false, payment: 'Unpaid', paymentSummary: 'unpaid', balanceDue: 100 }, expected: false },
]

for (const testCase of cases) {
    if (canOpenReservation(testCase.reservation) !== testCase.expected) {
        throw new Error(`Reservation clickability check failed: ${testCase.name}`)
    }
}

