# Reservation attendance regression check

Run from the admin Reservations page with test reservations that cover the listed statuses and payment states:

1. Open a confirmed, deposit-paid room reservation. The Check-in view must not show an inventory checklist or inspection error, and Check-in must be enabled. Submit it and verify the reservation becomes checked in.
2. Open the checked-in reservation. The Check-out view must show the inventory checklist; clearing guest name, attendant name, or signature must keep Check-out disabled or show the inspection validation error only in this view.
3. Trigger the Check-out validation error, close the modal, and open another confirmed reservation for Check-in. The Check-in view must have no inspection error or leftover checklist state.
4. Open a confirmed reservation whose attendance preview has a fee greater than zero. Check-in must remain disabled until the fee-collected checkbox is selected and the confirmation is accepted.
5. Open a confirmed reservation with an outstanding balance that still has a verified deposit. Check-in must remain allowed under the payment policy.
6. Open a completed or fully paid reservation. The read-only attendance and signed inspection display must remain unchanged.
