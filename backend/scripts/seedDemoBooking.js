require('dotenv').config();
const pool = require('../config/db');
const { calculateBalance, calculateDeposit, fromCents, toCents } = require('../config/paymentPolicy');

const fakeDomain = '@pilot.invalid';

async function seedDemoBookings() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[staff]] = await connection.query(
      "SELECT user_id FROM Users WHERE role IN ('admin', 'receptionist') AND is_active = TRUE LIMIT 1"
    );
    const [[room]] = await connection.query("SELECT * FROM Rooms WHERE status = 'available' ORDER BY room_id LIMIT 1");
    const [[cash]] = await connection.query("SELECT payment_method_id FROM PaymentMethods WHERE method_type = 'cash' AND is_active = TRUE LIMIT 1");
    if (!staff || !room || !cash) throw new Error('An active staff user, room, and Cash payment method are required.');

    const guests = [
      ['Pilot', 'Deposit', `deposit${fakeDomain}`, '09000000001'],
      ['Pilot', 'Completed', `completed${fakeDomain}`, '09000000002'],
      ['Pilot', 'Walk In', `walkin${fakeDomain}`, '09000000003'],
    ];
    const customerIds = [];
    for (const guest of guests) {
      const [[existing]] = await connection.query('SELECT customer_id FROM Customer WHERE email=? LIMIT 1', [guest[2]]);
      if (existing) customerIds.push(existing.customer_id);
      else {
        const [result] = await connection.query(
          `INSERT INTO Customer (first_name,last_name,email,phone_number,is_registered,is_active)
           VALUES (?,?,?,?,FALSE,TRUE)`, guest
        );
        customerIds.push(result.insertId);
      }
    }

    const nightsTotal = fromCents(toCents(room.price_per_night) * 2);
    const deposit = fromCents(calculateDeposit(nightsTotal));
    const bookings = [
      { reference: 'PILOT-DEPOSIT-01', customerId: customerIds[0], source: 'online', checkIn: '2099-01-10', checkOut: '2099-01-12', status: 'confirmed', total: nightsTotal, payments: [[deposit, 'deposit']] },
      { reference: 'PILOT-COMPLETE-01', customerId: customerIds[1], source: 'online', checkIn: '2026-01-10', checkOut: '2026-01-12', status: 'completed', total: nightsTotal, payments: [[deposit, 'deposit'], [fromCents(calculateBalance(nightsTotal, deposit)), 'balance']] },
      { reference: 'PILOT-WALKIN-01', customerId: customerIds[2], source: 'walk-in', checkIn: '2099-02-10', checkOut: '2099-02-11', status: 'confirmed', total: fromCents(toCents(room.price_per_night)), payments: [[room.price_per_night, 'full']] },
    ];
    for (const booking of bookings) {
      const [[existing]] = await connection.query('SELECT reservation_id FROM Reservations WHERE booking_reference=?', [booking.reference]);
      if (existing) continue;
      const [reservation] = await connection.query(
        `INSERT INTO Reservations
         (customer_id,room_id,booking_source,booking_reference,check_in_date,check_out_date,num_guests,total_amount,status,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [booking.customerId, room.room_id, booking.source, booking.reference, booking.checkIn, booking.checkOut, 2, booking.total, booking.status, staff.user_id]
      );
      for (const [amount, paymentType] of booking.payments) {
        await connection.query(
          `INSERT INTO Payments
           (reservation_id,amount,payment_type,payment_method_id,payment_status,verified_by,verified_at)
           VALUES (?,?,?,?,'verified',?,NOW())`,
          [reservation.insertId, amount, paymentType, cash.payment_method_id, staff.user_id]
        );
      }
      await connection.query(
        `INSERT INTO Reservation_Status_History (reservation_id,to_status,actor_type,changed_by,reason)
         VALUES (?,?,'staff',?,'Pilot demo booking')`,
        [reservation.insertId, booking.status, staff.user_id]
      );
    }
    await connection.commit();
    console.log('[seedDemoBookings] Created/kept three @pilot.invalid demo guests: deposit, completed, and walk-in.');
  } catch (error) {
    await connection.rollback();
    console.error(`[seedDemoBookings] Failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedDemoBookings();
