# KAIROS Admin Module Context

## Purpose

`KAIROS/src/admin` contains the React frontend for the resort management portal. It is mounted at `/admin/*` from `KAIROS/src/App.jsx`.

The module currently provides the admin UI structure and mock/default data. Most page components are presentational: they accept data and optional callback props, but they do not yet fetch or mutate backend data themselves.

## Folder Structure

```text
src/admin/
├── ADMIN_CONTEXT.md                 # This guide
├── components/                      # Reusable admin UI and chart components
│   ├── AdminSidebar.jsx             # Fixed left navigation for admin pages
│   ├── BookingTrendsChart.jsx       # Recharts area chart
│   ├── MonthlyRevenueChart.jsx       # Recharts revenue chart
│   ├── OccupancyDonutChart.jsx       # Recharts occupancy donut chart
│   ├── PercentageListCard.jsx       # Percentage/progress list card
│   ├── QrScannerModal.jsx            # Camera/manual reservation QR scanner
│   ├── RankedListCard.jsx            # Ranked list card
│   └── StatCard.jsx                  # Dashboard metric card
├── layouts/
│   └── AdminLayout.jsx               # Shared sidebar + Outlet shell
├── context/
│   └── AdminAuthContext.jsx          # Cookie-backed admin/receptionist session state
├── pages/                            # Route-level admin screens
│   ├── AuditLogsPage.jsx
│   ├── ChatbotPage.jsx
│   ├── CustomersPage.jsx
│   ├── DashboardPage.jsx
│   ├── LoginPage.jsx                 # Staff/admin login form
│   ├── PaymentsPage.jsx
│   ├── ReportsPage.jsx
│   ├── ReservationsPage.jsx
│   ├── WalkInBookingsPage.jsx
│   ├── RoomsPage.jsx
│   ├── SettingsPage.jsx
│   └── VenuesPage.jsx
├── routes/
    └── AdminRoutes.jsx               # React Router route definitions
└── utils/
    └── parseReservationQr.js         # Validates QR/manual booking references
```

## Route Map

`AdminRoutes.jsx` is rendered by the `/admin/*` route in `App.jsx`.

| URL | Component | Layout |
|---|---|---|
| `/admin/login` | `pages/LoginPage.jsx` | Standalone login page |
| `/admin` | `pages/DashboardPage.jsx` | `AdminLayout` |
| `/admin/reservations` | `pages/ReservationsPage.jsx` | `AdminLayout` |
| `/admin/walk-in` | `pages/WalkInBookingsPage.jsx` | `AdminLayout` |
| `/admin/rooms` | `pages/RoomsPage.jsx` | `AdminLayout` |
| `/admin/venues` | `pages/VenuesPage.jsx` | `AdminLayout` |
| `/admin/payments` | `pages/PaymentsPage.jsx` | `AdminLayout` |
| `/admin/customers` | `pages/CustomersPage.jsx` | `AdminLayout` |
| `/admin/chatbot` | `pages/ChatbotPage.jsx` | `AdminLayout` |
| `/admin/reports` | `pages/ReportsPage.jsx` | `AdminLayout` |
| `/admin/audit-logs` | `pages/AuditLogsPage.jsx` | `AdminLayout` |
| `/admin/settings` | `pages/SettingsPage.jsx` | `AdminLayout` |

## Role Access

| Page | Admin | Receptionist | Backend enforcement |
|---|---|---|---|
| Dashboard | Yes | Yes | `GET /api/admin/dashboard` allows `admin` and `receptionist` |
| Reservations | Yes | Yes, including check-in/check-out | Reservation listing and attendance endpoints allow `admin` and `receptionist` |
| Walk-in Bookings | Yes | Yes | Walk-in endpoints allow `admin` and `receptionist` |
| Rooms | Yes | No | `requireRole('admin')` |
| Venues | Yes | No | `requireRole('admin')` |
| Payments | Yes | Yes, including approval and decline | List and review routes allow `admin` and `receptionist` |
| Customers | Yes | No | `requireRole('admin')` |
| Chatbot | Yes | No | Frontend guard; future APIs must use `requireRole('admin')` |
| Reports | Yes | Yes | `GET /api/admin/reports` allows `admin` and `receptionist` |
| Audit Logs | Yes | No | `requireRole('admin')` |
| Settings | Yes | No | Frontend guard; future APIs must use `requireRole('admin')` |

## Main Responsibilities

### `routes/AdminRoutes.jsx`

- Defines all nested admin routes.
- Renders `LoginPage` outside the shared layout.
- Wraps guarded pages in `AdminLayout` and `RequireRole`. Dashboard, Reservations, Walk-in Bookings, Payments, and Reports allow both staff roles; the remaining pages are admin-only.
- Uses `AdminAuthContext` to load the cookie-backed session from `GET /api/auth/me`.
- Redirects unauthenticated users to `/admin/login` and receptionists away from admin-only pages to `/admin/walk-in`.

### `layouts/AdminLayout.jsx`

- Renders the fixed `AdminSidebar`.
- Renders child route content through React Router's `<Outlet />`.
- Uses a left offset of `pl-64` to make room for the 16rem sidebar.

### `components/AdminSidebar.jsx`

- Owns the visible admin navigation list.
- Uses `NavLink` from `react-router-dom`.
- Navigation paths are absolute `/admin/...` paths.
- Navigation items are filtered by role: receptionists see Dashboard, Reservations, Walk-in Bookings, Payments, and Reports; admins see all items.
- The profile block displays the authenticated user's `full_name` and role from `AdminAuthContext`.
- Logout calls `POST /api/auth/logout`, clears in-memory auth state, and redirects to `/admin/login`.

### `context/AdminAuthContext.jsx`

- Loads the current session from `GET /api/auth/me` with `credentials: 'include'`.
- Exposes `user`, `role`, `loading`, `refreshUser()`, and `logout()`.
- Stores no JWT or user data in `localStorage`; authentication remains cookie-backed.

## Page Status and Data Pattern

| Page | Current state |
|---|---|
| `DashboardPage` | Fetches the live Manila dashboard aggregate for admins and receptionists, maps it to the existing cards/charts, and shows action items plus recent reservations. |
| `RoomsPage` | Fetches live admin room data and maps it to the existing `id/name/type/capacity/price/status/image` display shape. Supports optional `rooms`, `onAddRoom`, `onEditRoom`, `onViewImage`, and `onDeleteRoom` props. |
| `VenuesPage` | Fetches live admin venue data and maps it to the existing `id/name/type/capacity/price/status/image` display shape. Supports optional `venues`, `onAddVenue`, `onEditVenue`, `onViewImage`, and `onDeleteVenue` props. |
| `ReservationsPage` | Fetches live reservation data for admins and receptionists, preserves local search/status/date filters, and supports attendance check-in/check-out for both roles. |
| `WalkInBookingsPage` | Fetches date-specific room or single-day venue availability, creates walk-in reservations with upfront payment, and validates guest/resource details locally. |
| `CustomersPage` | Uses `defaultCustomers`; local All/Registered/Guest filters and search. |
| `PaymentsPage` | Fetches live payment data, maps it to the existing display shape, provides local search/status filters, and lets both admins and receptionists accept or decline pending verification. |
| `ReportsPage` | Fetches live report aggregates for a Manila date range for admins and receptionists and maps them to the existing cards, charts, and ranked/percentage lists. |
| `AuditLogsPage` | Audit log UI with local/default presentation data. |
| `ChatbotPage` | Chatbot administration UI. |
| `SettingsPage` | The Resort Information card is live; it loads and saves the four resort fields. All other cards remain unchanged. |
| `LoginPage` | Calls `POST ${VITE_API_URL}/api/auth/login` with `credentials: 'include'`; accepts `admin` and `receptionist`, redirects admins to `/admin`, and redirects receptionists to `/admin/walk-in`. |

When wiring a page to an API, preserve its existing normalization/display shape or add a small mapper at the page boundary. Do not leak database column naming assumptions throughout reusable presentational components.

## Backend Integration Points

The backend is in the sibling `backend/` folder:

- Public/staff auth: `backend/routes/authRoutes.js`
- Auth controller: `backend/controllers/authController.js`
- Auth middleware: `backend/middleware/auth.js`
- Admin room API: `backend/routes/adminRoomRoutes.js`
- Admin venue API: `backend/routes/adminVenueRoutes.js`
- Admin payment API: `backend/routes/adminPaymentRoutes.js`
- Admin reservations API: `backend/routes/adminReservationRoutes.js`
- Admin walk-in booking API: `backend/routes/adminWalkInRoutes.js`
- Admin dashboard API: `backend/routes/adminDashboardRoutes.js`
- Admin reports API: `backend/routes/adminReportRoutes.js`
- Server mounting: `backend/server.js`

### Admin Rooms and Venues UI Integration

`RoomsPage.jsx` and `VenuesPage.jsx` own their API requests and mutation state. Reusable components remain presentational and continue to receive the existing display shape and callback props.

The pages use these authenticated endpoints:

```text
GET   /api/admin/rooms
POST  /api/admin/rooms
PUT   /api/admin/rooms/:id
PATCH /api/admin/rooms/:id/deactivate

GET   /api/admin/venues
POST  /api/admin/venues
PUT   /api/admin/venues/:id
PATCH /api/admin/venues/:id/deactivate
```

All requests use `credentials: 'include'`. A `401` or `403` redirects to `/admin/login`; other request failures are shown inline. Successful create, edit, and deactivate actions show an inline success message.

The page-level mappers translate database fields without exposing them to the table UI:

- Rooms: `room_id` -> `id`, `room_number` -> `name`, `room_type` -> `type`, `price_per_night` -> `price`, and `images` -> `image`.
- Venues: `venue_id` -> `id`, `venue_name` -> `name`, `venue_type` -> `type`, and `images` -> `image`.
- Both pages format numeric `capacity` as `"N guests"` and normalize status values for the existing badges.
- The `Venues` table has no database price field, so its preserved `price` display value is `null` and renders as `N/A`.

The UI's delete action calls the deactivate endpoint only. It never calls the backend hard-delete route, preserving reservation history.

### Admin Payments UI Integration

The payment router exposes only these routes:

```text
GET   /api/admin/payments                         # admin, receptionist
PATCH /api/admin/payments/:id/accept              # admin, receptionist
PATCH /api/admin/payments/:id/decline             # admin, receptionist
```

There are no proof-download, export, or refund routes in `adminPaymentRoutes.js`. Any future route that is not the list or payment review actions must remain admin-only. Payment-method settings are mounted separately at `/api/admin/payment-methods` and remain behind `requireRole('admin')`.

`PaymentsPage.jsx` fetches payment records from `GET /api/admin/payments` with `credentials: 'include'`. The endpoint allows `admin` and `receptionist`, joins payment records to reservations, customers, and payment methods, and returns display-safe payment, proof, and verification fields. Both roles can accept or decline pending payments. Review actions lock the payment and reservation rows, require both records to remain pending verification, record the authenticated reviewer id and role in audit metadata, and send the existing accepted/declined email only after commit. A second review returns a generic `409` without an audit entry or email. A `401` or `403` redirects to `/admin/login`; other failures are shown inline.

The page-level mapper translates `payment_id` -> `id`, `booking_reference` -> `booking`, `method_name` -> `method`, `created_at` -> `date`, and `payment_status` -> `status`. Customer `first_name` and `last_name` become `guest`, falling back to `Guest` when no customer is present. Summary totals are computed from the fetched records.

### Admin Reservations UI Integration

`ReservationsPage.jsx` fetches reservation records from `GET /api/admin/reservations` with `credentials: 'include'`. The endpoint requires authentication and allows both `admin` and `receptionist` roles, joins reservations to customers and the reserved room or venue, and returns display-safe reservation and payment fields. The page remains read-only for both roles, with attendance check-in and check-out available to both roles. A `401` or `403` redirects to `/admin/login`; other failures are shown inline.

The Reservations header includes a `Scan QR` action for both staff roles. `QrScannerModal.jsx` is presentational: it requests the rear-facing camera when available, throttles `jsqr` decoding to roughly 12 frames per second, and stops every media track and animation frame on scan, close, unmount, and StrictMode cleanup. Camera access requires HTTPS or `localhost`; permission, camera, or insecure-context failures leave the manual booking-reference form usable. `parseReservationQr.js` accepts only a bare or URL-contained `KAB-YYYY-MM-####` reference, never navigates to scanned URLs, and rejects invalid codes with a brief inline notice. Valid scans close the scanner and update the existing `?ref=` deep-link flow, so lookup and attendance modal behavior remain centralized in `ReservationsPage.jsx`.

Staff can also fetch one display-safe reservation with `GET /api/admin/reservations/lookup?ref=KAB-YYYY-MM-####`. The route requires `admin` or `receptionist`, validates the booking-reference format, returns `400` for an invalid reference and `404` for an unknown reference, and includes the same customer, room/venue, dates, status, payment fields, and `payment_summary` as the list endpoint. It returns only safe display fields and generic errors.

The page-level mapper translates `booking_reference` -> `id`, `check_in_date`/`event_date` -> `checkIn`, `check_out_date`/`event_date` -> `checkOut`, `reservation_status` -> `status`, and the room number or venue name -> `room`. Customer `first_name` and `last_name` become `guest`, falling back to `Guest` when no customer is present. Reservation statuses are normalized to the existing table badges, and payment statuses are normalized to `Paid` or `Pending`.

The page accepts an optional `reservations` prop to override fetched data. It remains read-only: the existing view, edit, delete, and filter callbacks are preserved, but no reservation mutations are sent to the backend.

Paid room reservations now open an attendance modal. Unpaid reservations and venue reservations remain non-clickable. Confirmed reservations offer check-in; checked-in reservations offer check-out; other paid room reservations show a read-only summary. The modal defaults to the current Asia/Manila time, allows corrections, previews the server-calculated fee and rounded-up hours, requires a fee-collected checkbox and confirmation when a fee is greater than zero, and refreshes the list after success.

Attendance endpoints require `admin` or `receptionist` and use the existing authenticated cookie:

```text
GET   /api/admin/reservations/:id/attendance-preview?action=check-in|check-out&actual_time=YYYY-MM-DDTHH:mm
PATCH /api/admin/reservations/:id/check-in
PATCH /api/admin/reservations/:id/check-out
```

Check-in requires a confirmed room reservation with a verified payment and an actual date matching `check_in_date`. Check-out requires `checked_in`, cannot precede the actual check-in, and may occur on or after `check_out_date`. Actual times cannot be more than five minutes in the future. Early and late fees use named backend constants for PHP 500 per started hour, with standard times of 2:00 PM and 12:00 noon in Asia/Manila. Check-out transitions to `completed`, which no longer blocks room availability. Each successful action writes an audit log with the fee and hours charged.

The approved manual migration is `backend/migrations/20261005_add_reservation_attendance_fees.sql`. It adds actual timestamps, separate early/late fee columns, and `fees_collected_at`; `total_amount` remains unchanged. The application does not run this migration automatically. From the repository root, apply it manually with `mysql -u root -p kairos_db < backend/migrations/20261005_add_reservation_attendance_fees.sql` after reviewing the database credentials and target database.

### Walk-in Bookings UI Integration

`WalkInBookingsPage.jsx` uses these authenticated endpoints:

```text
GET  /api/admin/walk-in/availability?type=room&check_in=YYYY-MM-DD&check_out=YYYY-MM-DD
GET  /api/admin/walk-in/availability?type=venue&event_date=YYYY-MM-DD
GET  /api/admin/walk-in/payment-methods
POST /api/admin/walk-in/bookings
```

The endpoints require a valid cookie and either the `admin` or `receptionist` role. All requests use `credentials: 'include'`; a `401` or `403` redirects to `/admin/login`, and other failures are shown inline.

Room availability excludes inactive rooms and overlapping active reservations. Room totals are calculated from `price_per_night` multiplied by the number of nights. Venue availability is single-day only and stores `event_date`; venues have no database price field, so the page requires staff to enter a non-negative manual `total_amount`.

The create endpoint locks the selected room or venue, re-checks active reservation conflicts inside a transaction, validates capacity and dates including server-side Asia/Manila past-date checks, creates or updates the guest in `Customer` with `is_registered = FALSE` when a new record is needed, and sets `booking_source` to `walk-in`. Booking references use the existing `KAB-YYYY-MM-####` format and `created_by` stores the authenticated staff user. Walk-in creation requires an active payment method, records a verified `Payments` row for the booking total, and associates it with the confirmed reservation.

The page accepts an optional `onBookingCreated` callback. Guest notes are included in the reservation audit metadata because the existing schema has no reservation notes column; no schema changes are made.

Walk-in on-site payments use `POST /api/admin/walk-in/bookings` as `multipart/form-data`. The request keeps the existing JSON-shaped `guest` and `payment` fields as JSON parts and uses `proof_of_payment` for a receipt image. The route reuses the online upload middleware (JPEG, PNG, or WebP; maximum 5 MB), uploads non-cash/card receipts to Cloudinary folder `kairos/payment-proofs`, and stores the returned URL in `Payments.proof_of_payment_url`. If the transaction fails after upload, the Cloudinary asset is deleted. Walk-in payments are inserted as `verified` with the authenticated staff member and timestamp.

Walk-in receipt requirements are classified server-side from `PaymentMethods.method_type` using `NO_RECEIPT_METHOD_TYPES = ['cash', 'card']`. Cash and card do not require a receipt; cash alone shows optional amount received and display-only change. Other active method types require a receipt photo. The frontend camera uses `getUserMedia` with capture/retake and falls back to `input type="file" accept="image/*" capture="environment"`; camera streams stop after capture and on unmount.

The public `GET /api/payment-methods` endpoint excludes `cash` and `card`, so customer online payment selection continues to show only receipt-based methods. Admin payment-method settings support nullable QR images for cash/card. The approved, non-automatic migration is `backend/migrations/20261005_add_cash_card_payment_methods.sql`; review it, then run `mysql -u root -p kairos_db < backend/migrations/20261005_add_cash_card_payment_methods.sql` from the repository root when ready.

Accepted online payment emails include an inline PNG QR code only when the reservation is `confirmed`. The QR encodes only `${ADMIN_APP_URL}/admin/reservations?ref=<booking_reference>`, uses error correction level `M`, and is attached with a Nodemailer CID; the booking reference and a plain-text instruction remain visible as fallbacks. Declined emails, initial receipt emails, cancelled reservations, and walk-in bookings do not include a QR. QR generation or attachment failures are logged and do not block payment acceptance or email delivery. `ADMIN_APP_URL` belongs in `backend/.env`; `STAFF_PORTAL_BASE_URL` remains a backwards-compatible fallback.

`ReservationsPage.jsx` reads the `?ref=` query parameter, calls the lookup endpoint, and passes the mapped result through the existing attendance-modal path. Confirmed and checked-in paid room reservations open the normal check-in/check-out modal; completed paid rooms show its read-only summary. Venue, unpaid, cancelled, invalid, and unknown references remain non-actionable and show an inline notice or error. Closing the modal clears `ref`, and successful attendance actions refresh the list as usual.

When a staff member scans a QR without a session, the admin route preserves the original `/admin/reservations?ref=...` path in the login `redirect` query parameter. After successful login, only redirect targets beginning with `/admin/` are accepted; otherwise the existing admin or receptionist default is used. `RequireRole` owns the unauthenticated redirect, preventing a deep-link login loop.

Current auth endpoints:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/register       # Customer registration, not admin registration
```

The login endpoint sets an httpOnly JWT cookie. `requireAuth` trusts the signed JWT payload for `user_id` and `role`; it does not perform a database lookup on each request. Therefore, a demoted user retains the old role until the token expires or the user logs out. Frontend requests that need the session must use:

```js
fetch(url, { credentials: 'include' })
```

### Email Notifications

The backend email service is in `backend/services/emailService.js`, with templates in `backend/templates/emails/`. It reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_NAME`, and `MAIL_FROM_EMAIL` from `backend/.env` and uses Brevo SMTP on port 587 with STARTTLS. Customers with an email on file receive a reservation receipt after an online payment proof and payment record are committed, then a payment accepted or declined notification after an admin or receptionist reviews the payment. Walk-in bookings do not send these emails. Email failures are logged server-side and are non-blocking for reservation and payment API actions; missing SMTP configuration disables sending with one warning.

Admin room, venue, customer, audit-log, payment-method, and user-management backend routes require a valid cookie and the `admin` role. Dashboard, reports, payments, reservations, and walk-in routes allow both `admin` and `receptionist` where documented. The frontend keeps Chatbot and Settings admin-only.

## Important Data/Schema Boundary

- `Users` is for staff accounts only: `admin` and `receptionist`.
- `Customer` is the separate customer account table and also supports guest bookings.
- Do not put customer accounts in `Users`.
- Do not add schema changes while wiring the admin UI unless explicitly requested.
- Never return `password_hash` to the frontend.

## Styling and Component Conventions

- React uses JSX and React Router.
- Styling is primarily Tailwind utility classes.
- Icons come from `react-icons/fa`.
- Charts use `recharts`.
- Admin pages generally use slate backgrounds, white bordered panels, sky-blue actions, and compact tables/cards.
- Page components use optional callback props for actions, for example `onEditRoom?.(room)`.
- Keep route-level data fetching and mutation logic separate from reusable display components when adding real backend integration.

## Recommended Work Pattern for Claude

1. Check `AdminRoutes.jsx` and `AdminLayout.jsx` before changing navigation or page composition.
2. Check the target page's default data and prop callbacks before replacing mock data.
3. Check the matching backend route/controller before inventing an API contract.
4. Use `credentials: 'include'` for authenticated requests; never use localStorage for the JWT.

## Payment Policy (2026-10-06)

Any new manual migration must also be folded into `backend/database/schema.sql` in the same change, so fresh databases and upgraded databases have the same structure. Migration files remain manual upgrade scripts and are never run automatically.

Online room reservations require a 50% deposit. `DEPOSIT_PERCENTAGE = 50` is a named backend constant. All money calculations use integer centavos: deposit is rounded to two decimals and balance is effective total minus deposit. The deposit confirms the reservation and is non-refundable. It is never deleted, voided, or altered when a reservation is cancelled. Verified payments on cancelled reservations remain cash-basis revenue, while cancelled reservations owe no balance.

The payment helper is `backend/utils/paymentSummary.js`. It returns `base_total`, `addons_total`, `total`, `amount_paid`, `deposit_due`, `balance_due`, `payment_summary` (`unpaid`, `deposit_paid`, or `fully_paid`), and bed counts. Verified payment amounts determine `amount_paid`; pending and rejected payments and attendance fees are excluded. Legacy rows without `payment_type` are treated as `full`, so existing paid reservations have zero balance.

Fresh schema compatibility is deliberately graceful. Reads treat a missing add-on table as zero and a missing `Rooms.max_extra_beds` column as cap zero. Writes that need the approved schema return `503` without inserting an untyped payment or charging the guest.

### Manual migrations

The project targets MySQL 8.0.16 or later. The add-on `CHECK` constraints require that version for enforcement; application validation also enforces positive quantities and non-negative prices on older servers.

Apply in this order, manually, and do not run automatically:

```text
mysql -u root -p kairos_db < backend/migrations/20261006_add_payment_type_to_payments.sql
mysql -u root -p kairos_db < backend/migrations/20261006_add_reservation_addons_and_bed_caps.sql
```

The first migration adds `Payments.payment_type` (`deposit`, `balance`, `full`) and an index on reservation/payment status. Every new payment insert sets the type explicitly. The second adds `Rooms.max_extra_beds INT NOT NULL DEFAULT 0` and `Reservation_Addons`, where each extra-bed row stores its quantity, the unit price in force, collector user, and creation time.

`EXTRA_BED_PRICE` is `PHP 450`, defined in `backend/config/paymentPolicy.js`. Existing add-on rows retain their stored price if the constant changes. The room cap is limited to 20 by application validation, and each request is limited to 10 beds. The Rooms admin form accepts `max_extra_beds` and remains disabled with a migration note when the column is unavailable. Each extra bed increases the effective guest capacity by one; the original reservation guest-capacity check is unchanged.

### Payment and attendance endpoints

`POST /api/reservations` calculates and returns the base total, deposit due, and balance due. `POST /api/reservations/:id/payment` accepts only the proof and method, ignores client amounts, inserts a typed deposit, rejects a second pending proof with `409`, and returns `503` before the payment-type migration. Public venue booking is not implemented; the helper is resource-agnostic for future venue support.

Admin and receptionist routes:

```text
POST /api/admin/reservations/:id/balance
POST /api/admin/reservations/:id/addons/extra-bed
```

Balance collection is multipart, reuses walk-in receipt rules, requires the exact outstanding amount, locks and recomputes the reservation, rejects cancelled/completed/settled/no-deposit cases with `409`, and returns `503` when its migration is missing. Extra-bed requests accept JSON `{ quantity }`, lock the reservation and room, enforce the cap, and return the refreshed payment summary, beds added, and remaining cap. Both endpoints audit the actor user id and role. Cash received/change is display-only. Walk-ins continue to use one verified `full` payment upfront and send no email.

Check-in is allowed with an outstanding balance after a verified deposit. Check-out is blocked with `409` while `balance_due > 0`; balance collection may occur at check-in or before check-out. Early/late fees remain separate from deposits, balances, add-ons, and revenue.

### Reporting and notifications

Dashboard and Reports use the shared helper and agree on cash-basis revenue: every verified deposit, balance, and walk-in full payment grouped by the existing verified-date field. Outstanding balances are separate, covering confirmed and checked-in reservations only. Reports additionally show deposit, balance, and full-payment lines, informational add-on charges billed, informational deposits retained from cancelled reservations, and completed reservations that still have a balance as a data-quality flag. Attendance fees remain separate.

Receipts and payment accepted/declined emails show amount paid now, total, balance due on arrival, and the notice that the 50% deposit confirms the reservation and is non-refundable. Email failures remain non-blocking. No customer-facing cancellation workflow exists in the current application; the existing expired-hold cleanup only marks reservations cancelled and never alters verified Payments rows. No refund or forfeiture workflow was added.
5. Keep `Users` staff-only and `Customer` customer-only.
6. Preserve existing route paths and display shapes unless the task explicitly changes them.
7. Validate with `npm run build` from `KAIROS` after frontend changes.

## Reports UI Integration

`ReportsPage.jsx` fetches the live report aggregate from `GET /api/admin/reports?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` with `credentials: 'include'`. The backend route uses `requireAuth` and allows `admin` and `receptionist`; the endpoint is read-only and validates both dates, their order, and a maximum 24-month range. Without filters, the endpoint and page default to the current Asia/Manila calendar month.

The response includes verified payment revenue by month and payment method, booking trends, reservation status/source counts, room occupancy, venue utilization, top five rooms and venues, and registered-vs-guest customer percentages. The page-level mapper translates those fields to the existing chart and list shapes. Customer percentages are based on customers with at least one reservation created in the selected period, not the whole `Customer` table. The UI preserves the existing four stat cards, two charts, and three list-card layout, adds date inputs, and shows an empty state independently for each card or chart.

Revenue uses verified `Payments` rows and groups by `Payments.verified_at` in Asia/Manila when that column exists; it falls back to `Payments.created_at` otherwise. The implementation assumes timestamp values are stored in UTC and converts them to the Manila offset for grouping and boundaries. Attendance fees are never included in revenue; when the manually-applied attendance-fee columns exist, they are grouped by `Reservations.fees_collected_at` and displayed separately, including monthly fee data. The controller checks `information_schema.COLUMNS`; if the migration is not applied, the response returns `fees_available: false` and zero fees without failing the report.

Reservation bookings and top performers include only `confirmed`, `checked_in`, and `completed` reservations. Cancellation rate is `cancelled / all reservations created in the period`, with a zero-total guard. Room occupancy is occupied room-nights divided by active rooms with `status = 'available'` multiplied by the number of days in the period; overlapping reservations are clipped to the selected boundaries. Venue utilization is active venue-days divided by active venues multiplied by period days. Average stay is the average room-reservation nights for active reservations created in the selected period. Months are zero-filled, and ranges spanning calendar years use labels such as `Jan 2026`.

The current schema does not support the former demographic categories such as international, couples, families, or solo travelers, so Reports uses only the supported registered-vs-guest customer breakdown. No schema changes or migrations were added.

## Resort Information and public resort details

The public endpoint `GET /api/resort-info` returns `resort_name`, `address`, `contact_number`, and `email` without authentication, with a short public cache. The landing page shares one fetch through `src/context/ResortInfoContext.jsx`; `Header.jsx`, `HeroSection.jsx`, and `Footer.jsx` render the returned values, and the document title follows the returned resort name. If the request fails or the database table/row is unavailable, the page uses these fallback values: `Kai Azul Beach Resort`, `123 Shoreline Drive, Beach City`, `+63 912 345 6789`, and `info@kaiazul.com`. Phone and email links use `tel:` and `mailto:` values.

Admin settings use cookie authentication and `requireRole('admin')`:

```text
GET /api/admin/settings/resort
PUT /api/admin/settings/resort
```

The Settings page loads and saves the Resort Information card with controlled inputs, client/server validation, dirty-state save disabling, inline loading/errors/success, and `/admin/login` redirects for `401`/`403`. The other Settings cards remain unchanged.

`ResortSettings` is a single-row table containing the four public fields, `updated_by`, and `updated_at`. The approved migration is `backend/migrations/20261006_add_resort_settings.sql`; it is manual and must also be folded into `backend/database/schema.sql`. Apply it with:

```text
mysql -u root -p kairos_db < backend/migrations/20261006_add_resort_settings.sql
```

Reads degrade gracefully to the fallback values when the migration is not applied. Writes return a generic `503` until the table exists. Successful admin updates record `resort_settings_updated` with the actor user id/role and old/new values in the audit log.

## Dashboard UI Integration

`DashboardPage.jsx` fetches the live aggregate from `GET /api/admin/dashboard` with `credentials: 'include'`. The route is mounted from `backend/routes/adminDashboardRoutes.js`, requires `requireAuth` and allows `admin` and `receptionist`, and returns a safe aggregate response. A `401` or `403` redirects the page to `/admin/login`; other failures are shown inline. Dashboard refreshes manually and every 60 seconds while the tab is visible, aborting stale requests.

The page-boundary mapper preserves the existing display components and maps the response as follows:

- `today.arrivals` -> `TODAY'S CHECK INS`; `today.departures` -> `TODAY'S CHECK OUTS`.
- The final bucket in `booking_trend` -> `BOOKINGS (MONTH-TO-DATE)`. It counts `confirmed`, `checked_in`, and `completed` reservations created in the current Manila month; cancelled reservations are excluded.
- `occupancy.occupied_percentage` -> `OCCUPANCY RATE` and the occupied/available percentages -> `OccupancyDonutChart`.
- `revenue.current_month` -> `REVENUE (MONTH-TO-DATE)`. Only verified payments are included, grouped by `verified_at` when available and otherwise `created_at`. Attendance fees remain separate and are shown as a secondary line only when `fees_available` is true.
- `action_items.pending_payments.count` -> `PENDING PAYMENTS`. The filter is exactly `payment_status = 'pending_verification'`, matching the Payments page's Pending verification filter; the five oldest records are ordered by payment `created_at` and expose only booking, guest, method, amount, and creation time.
- `booking_trend`, `popular.rooms`, and `popular.venues` map to the existing `BookingTrendsChart` and `RankedListCard` components. Popular resources use the shared active status rules over the last 90 days and stable name tie-breaking.
- `recent_reservations` is rendered as a safe five-row display of booking reference, guest, room/venue, status, and booking source. Missing customer names fall back to `Guest`.

Action cards link to absolute `/admin/payments` or `/admin/reservations` paths; pending payment rows use Payments, while arrivals, departures, and overdue reservation rows use Reservations. Each dashboard section has its own loading, empty, or inline failure state. Non-critical aggregate failures return `null` for that section and a `section_errors` entry; core reservation snapshot or occupancy failures return a normal endpoint error without exposing raw database messages.

Shared date, month, status, percentage, attendance-column, and room-occupancy definitions live in `backend/utils/reportMetrics.js` and are reused by Reports and Dashboard. Dashboard occupancy means rooms occupied tonight: an active room with a `confirmed` or `checked_in` room reservation where `check_in_date <= today < check_out_date`, divided by active rooms. It excludes `completed` because completed stays have checked out. Reports intentionally uses the same shared occupancy query with `confirmed`, `checked_in`, and `completed` over its selected period, where completed reservations contribute to historical room-nights. Both donut percentages use zero-division guards and sum to 100 when rooms exist.

The current schema supports the requested snapshot, action, revenue, trend, popular-resource, and recent-reservation fields. Attendance fees return zero with `fees_available: false` when the attendance-fee columns are not present. No schema changes or migrations were added.

## Local-network development

The frontend API base URL is configured with `VITE_API_URL` in `KAIROS/.env`; when it is unset or empty, requests use same-origin `/api/...` paths. Vite proxies those paths to the backend at `http://localhost:5000`. For a Cloudflare quick tunnel, use the tunnel URL for both `ADMIN_APP_URL` and the backend `ALLOWED_ORIGINS` value, set `COOKIE_SECURE=true` and `TRUST_PROXY=true`, then open the tunnel URL in the browser. `ADMIN_APP_URL` is also used for reservation QR links in accepted-payment emails.

## Real-time Staff Notifications

`GET /api/admin/notifications/stream` is an authenticated Server-Sent Events stream available to both `admin` and `receptionist`. `AdminNotificationsProvider` is mounted inside `AdminLayout`, so it runs on every authenticated admin page and not on the standalone login page. It uses the cookie-backed session with credentials and closes the stream when the staff session is logged out or the layout unmounts.

The in-memory notification hub publishes ephemeral events after the database commit for:

- `POST /api/reservations`: `reservation_created`
- `POST /api/reservations/:id/payment`: `payment_submitted`

Walk-in creation, balance collection, and payment review actions do not publish events. Every event contains only this display-safe payload:

```json
{
  "type": "reservation_created",
  "booking_reference": "KAB-2026-10-0004",
  "guest_name": "Juan Dela Cruz",
  "resource_name": "101",
  "created_at": "2026-10-06T13:52:35.621Z"
}
```

The hub is process-local and in-memory, so real-time notifications work only when the frontend and all staff connections use a single backend instance. No Redis or database notification storage is used. Notification failures are logged without changing the customer's successful reservation or payment response.
