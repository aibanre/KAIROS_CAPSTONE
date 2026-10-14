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
│   ├── PackageManager.jsx            # Conference Hall package CRUD/reordering
│   ├── Pagination.jsx                # Reusable client-side pagination controls
│   ├── ReservationPaymentsList.jsx   # Reservation payment history presentation
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
| `/admin/change-password` | `pages/ChangePasswordPage.jsx` | Standalone forced/self-service password change |
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

## Admin responsive layout

- The persistent sidebar remains visible at `lg` and above. Below `lg`, `AdminLayout` renders a compact top bar and an off-canvas navigation drawer. The drawer closes from the backdrop, Escape, or a selected navigation link, and locks body scrolling while open.
- The page shell uses `min-w-0`, `overflow-x-hidden`, and `p-3 sm:p-4 lg:p-6`. Mobile modal panels use a bounded `90dvh` scroll area; desktop panels retain their centered or side-panel presentation.
- Payment lists render stacked, actionable cards below `md`; reservation rows currently use the existing scrollable table at all breakpoints rather than a separate mobile card renderer. Other wide admin tables retain local horizontal scrolling rather than causing page-level overflow.
- Dashboard metric cards use one column on phones, two columns from `sm`, and four columns from `lg`. Recharts widgets use `ResponsiveContainer` so they resize with their cards.

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
| Settings | Yes | No | `requireRole('admin')`; includes Resort Information, Payment Methods, and Staff Accounts cards |

## Main Responsibilities

### `routes/AdminRoutes.jsx`

- Defines all nested admin routes.
- Renders `LoginPage` outside the shared layout.
- Renders `ChangePasswordPage` outside the shared layout; `RequireRole` redirects staff with `must_change_password` there before any other admin route.
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

### Staff account management and password reset

The staff-management backend already exposes `GET /api/admin/users`, `POST
/api/admin/users`, `PUT /api/admin/users/:id`, and
`PATCH /api/admin/users/:id/deactivate|reactivate`. `SettingsPage.jsx` already
renders the admin-only Staff Accounts card and uses the display-safe list
response; it does not receive password hashes. There was no staff
change-password or password-reset endpoint before this change.

`PATCH /api/admin/users/:id/reset-password` is mounted beneath the existing
`requireAuth` + `requireRole('admin')` router guard and is limited to 10
requests per IP per 60 minutes. It accepts only existing active `admin` or
`receptionist` rows in `Users`; it never reads or writes `Customer`. An admin
cannot reset their own account and deactivated staff accounts cannot be reset.
The temporary password is generated server-side, returned once with
`Cache-Control: no-store`, and is absent from logs and audit values.

Logged-in staff use `POST /api/auth/change-password` with
`current_password` and `new_password`. New passwords are 8–128 characters,
must differ from the current/temporary password, clear the forced-change flag,
update the password version timestamp, and reissue `kairos_auth`.

The `Users` table additions are `must_change_password BOOLEAN NOT NULL DEFAULT
FALSE` and `password_changed_at TIMESTAMP(6) NULL DEFAULT NULL`. Apply the manual
migration (startup does not run migrations):

```text
mysql -u root -p kairos_db < backend/migrations/20261008_add_staff_password_reset.sql
```

Staff login responses and `/api/auth/me` include `must_change_password`.
New staff JWTs include `password_changed_at`; `requireAuth` performs one
lightweight staff lookup and rejects sessions whose version no longer matches,
so reset and self-service changes invalidate existing sessions. Tokens without
the claim are accepted only when issued before the running server introduced the
claim once the columns are present; login/session reads continue to degrade
safely before migration. Customer authentication remains on the separate
`Customer` table path. Reset/change-password writes return a generic `503`
until the migration is applied. Role changes still follow the existing JWT
expiry/logout behavior; password reset and password change invalidate sessions
immediately through the version timestamp.

## Page Status and Data Pattern

| Page | Current state |
|---|---|
| `DashboardPage` | Fetches the live Manila dashboard aggregate for admins and receptionists, maps it to the existing cards/charts, and shows action items plus recent reservations. |
| `RoomsPage` | Fetches live admin room data and maps it to the existing `id/name/type/capacity/price/status/image` display shape. Supports optional `rooms`, `onAddRoom`, `onEditRoom`, `onViewImage`, and `onDeleteRoom` props. |
| `VenuesPage` | Fetches live admin venue data and maps it to the existing `id/name/type/capacity/price/status/image` display shape. Supports optional `venues`, `onAddVenue`, `onEditVenue`, `onViewImage`, and `onDeleteVenue` props. |
| `ReservationsPage` | Fetches live reservation data for admins and receptionists, preserves local search/status/date filters, supports attendance check-in/check-out for both roles, and makes pending-payment rows navigate to the matching record in `PaymentsPage`. |
| `WalkInBookingsPage` | Fetches date-specific room or single-day venue availability, creates walk-in reservations with upfront payment, and validates guest/resource details locally. |
| `CustomersPage` | Fetches live data from `GET /api/admin/customers` on mount with `credentials: 'include'`, maps rows to the existing display shape, keeps local All/Registered/Guest filters and search, opens a detail modal via `GET /api/admin/customers/:id`, and supports deactivate/reactivate for registered accounts only; `defaultCustomers` is only the initial fallback state. |
| `PaymentsPage` | Fetches every live payment record (deposit, balance, and full), maps it to the existing display shape, provides local search/status filters, lets both admins and receptionists accept or decline pending verification, and opens a payment targeted by the `paymentId`/`booking` query parameters. |
| `ReportsPage` | Fetches live report aggregates for a Manila date range for admins and receptionists and maps them to the existing cards, charts, and ranked/percentage lists. |
| `AuditLogsPage` | Audit log UI with local/default presentation data. |
| `ChatbotPage` | Loads admin-only FAQ, unanswered-question, conversation, knowledge, and stats endpoints; supports FAQ CRUD/deactivation/reordering, unanswered promotion/dismissal, read-only conversation inspection, and editable non-live knowledge topics. Customer display names are first name plus last initial only. |
| `SettingsPage` | The admin-only page contains live Resort Information, Payment Methods, and Staff Accounts cards. Staff Accounts also links to the self-service Change My Password page; notification toasts remain provided independently by `AdminNotificationsProvider`. |
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

GET   /api/admin/images
GET   /api/admin/venues/:id/packages
POST  /api/admin/venues/:id/packages
PUT   /api/admin/venues/:id/packages/:packageId
PATCH /api/admin/venues/:id/packages/:packageId/deactivate
```

All requests use `credentials: 'include'`. A `401` or `403` redirects to `/admin/login`; other request failures are shown inline. Successful create, edit, and deactivate actions show an inline success message.

The page-level mappers translate database fields without exposing them to the table UI:

- Rooms: `room_id` -> `id`, `room_number` -> `name`, `room_type` -> `type`, `price_per_night` -> `price`, and `images` -> `image`.
- Venues: `venue_id` -> `id`, `venue_name` -> `name`, `venue_type` -> `type`, and `images` -> `image`.
- Both pages format numeric `capacity` as `"N guests"` and normalize status values for the existing badges.
- Venue records include `flat_price` for day-use cottages; the venue mapper exposes it as the admin price value.

The UI's delete action calls the deactivate endpoint only. It never calls the backend hard-delete route, preserving reservation history.

`VenuesPage.jsx` also manages venue booking rules and Conference Hall packages.
The venue form edits name, type, capacity, description, amenities, images,
status, booking mode, flat price, start/end times, earliest/latest hall times,
slot step, and buffer. The package manager creates, edits, deactivates, and
reorders packages with name, description, inclusions, pricing type, price,
minimum/maximum pax, included hours, and extra-hour rate. Backend validation
requires price greater than zero, `min_pax >= 1`, `max_pax >= min_pax` when
provided, and `earliest_start < latest_end`. The edit form currently shows all
rule fields for every venue; hall-only fields are blank or unused for cottages.
`PackageManager.jsx` is rendered only for saved venues whose stored
`booking_mode = "packaged"`; day-use cottages show no package section. The
package manager creates, edits, deactivates, and reorders packages through the
four endpoints listed above. Package-manager rendering is
wrapped in an error boundary so a component failure does not blank the venue
management page. Its requests use the existing package endpoints and
credentials-backed admin request helper. All package routes are covered by
`requireAuth` and `requireRole('admin')` in `adminVenueRoutes.js`; `401` and `403` redirect to
`/admin/login`.

`GET /api/admin/images` is the read-only, admin-only uploaded-image library
used by both edit modals. It derives distinct image URLs and their room/venue
labels from the `Rooms.images` and `Venues.images` columns. Room and venue
create/update requests may send `existing_image_url` instead of an image file;
the backend accepts only an image already referenced by one of those tables or
a URL under the configured Cloudinary folder. A newly uploaded file takes
precedence when both are submitted. Existing handlers do not delete old
Cloudinary assets when records are replaced, deactivated, or hard-deleted, so
shared assets are not removed.

The configured venues are Small Cottage and Big Cottage (`day_use`, fixed
08:00–17:00, flat per-day price, one booking blocks a date) and Conference Hall
(`packaged`, package/date/start-time/pax/optional-extra-hours booking). Hall
packages are Free Venue (Per Person) at ₱590 per person with a 100-pax minimum,
Package 10K, Package 15K, and Package 20K as flat packages. Inclusions for the
three flat packages are placeholders until edited in the admin UI.

### Admin Payments UI Integration

The payment router exposes only these routes:

```text
GET   /api/admin/payments                         # admin, receptionist
PATCH /api/admin/payments/:id/accept              # admin, receptionist
PATCH /api/admin/payments/:id/decline             # admin, receptionist
```

There are no proof-download, export, or refund routes in `adminPaymentRoutes.js`. Any future route that is not the list or payment review actions must remain admin-only. Payment-method settings are mounted separately at `/api/admin/payment-methods` and remain behind `requireRole('admin')`.

`PaymentsPage.jsx` fetches every payment record from `GET /api/admin/payments` with `credentials: 'include'`, including deposit, balance, and full payments. The endpoint allows `admin` and `receptionist`, joins payment records to reservations, customers, and payment methods, and returns display-safe payment, proof, and verification fields. Both roles can accept or decline pending payments. Review actions lock the payment and reservation rows, require both records to remain pending verification, record the authenticated reviewer id and role in audit metadata, and send the existing accepted/declined email only after commit. A second review returns a generic `409` without an audit entry or email. A `401` or `403` redirects to `/admin/login`; other failures are shown inline. The page opens a targeted record when `paymentId` or `booking` is present in the query string.

The page-level mapper translates `payment_id` -> `id`, `booking_reference` -> `booking`, `method_name` -> `method`, `created_at` -> `date`, and `payment_status` -> `status`. Customer `first_name` and `last_name` become `guest`, falling back to `Guest` when no customer is present. Summary totals are computed from the fetched records.

### Admin Chatbot Management

`/api/admin/chatbot` is protected by `requireAuth` and `requireRole('admin')`; receptionists receive `403` on every endpoint. It exposes `GET/POST /faqs`, `PUT/PATCH /faqs/:id`, `PATCH /faqs/reorder`, `GET/PUT /knowledge`, `GET /unanswered`, `POST /unanswered/:id/promote`, `PATCH /unanswered/:id/dismiss`, `GET /conversations`, `GET /conversations/:id`, and `GET /stats`. FAQ and unanswered writes create audit-log entries. Live knowledge topics are generated from current rooms, venues, active packages, ResortSettings, and the payment policy; only stored free-text topics are editable. Missing chatbot management tables return empty reads and generic `503` write responses.

Chatbot tables are `Chatbot_Faqs`, `Chatbot_Knowledge`, `Chatbot_Unanswered`, `Chatbot_Conversations`, and `Chatbot_Messages`; the latter retains the existing `assistant` role for customer compatibility and adds FAQ/answered metadata. Apply the manual migration with:

```text
mysql -u root -p kairos_db < backend/migrations/20261008_add_chatbot_management.sql
```

Conversation history never exposes customer email, phone, address, or other contact fields; the admin mapper receives only first name plus last initial.

### Admin Reservations UI Integration

`ReservationsPage.jsx` fetches reservation records from `GET /api/admin/reservations` with `credentials: 'include'`. The endpoint requires authentication and allows both `admin` and `receptionist` roles, joins reservations to customers and the reserved room or venue, and returns display-safe reservation and payment fields. The page remains read-only for both roles, with attendance check-in and check-out available to both roles. A `401` or `403` redirects to `/admin/login`; other failures are shown inline.

The Reservations header includes a `Scan QR` action for both staff roles. `QrScannerModal.jsx` is presentational: it requests the rear-facing camera when available, throttles `jsqr` decoding to roughly 12 frames per second, and stops every media track and animation frame on scan, close, unmount, and StrictMode cleanup. Camera access requires HTTPS or `localhost`; permission, camera, or insecure-context failures leave the manual booking-reference form usable. `parseReservationQr.js` accepts only a bare or URL-contained `KAB-YYYY-MM-####` reference, never navigates to scanned URLs, and rejects invalid codes with a brief inline notice. Valid scans close the scanner and update the existing `?ref=` deep-link flow, so lookup and attendance modal behavior remain centralized in `ReservationsPage.jsx`.

Staff can also fetch one display-safe reservation with `GET /api/admin/reservations/lookup?ref=KAB-YYYY-MM-####`. The route requires `admin` or `receptionist`, validates the booking-reference format, returns `400` for an invalid reference and `404` for an unknown reference, and includes the same customer, room/venue, dates, status, payment fields, and `payment_summary` as the list endpoint. It returns only safe display fields and generic errors.

The page-level mapper translates `booking_reference` -> `id`, room
`check_in_date`/`check_out_date` or venue `event_date` -> the date fields,
`reservation_status` -> `status`, and the room number or venue name -> `room`.
Venue rows also retain the event date, start/end time, package name, and pax.
Customer `first_name` and `last_name` become `guest`, falling back to `Guest`
when no customer is present. Reservation statuses are normalized to the
existing table badges, and payment statuses are normalized to `Paid` or
`Pending`.

Each reservation maps the pending-verification payment ID when one exists and
falls back to the latest payment ID otherwise. A reservation whose
`has_pending_payment` flag is true, or whose status/payment label is `Pending
payment` or `Pending verification`, is represented by one keyboard-accessible
clickable table row. Clicking or pressing Enter/Space anywhere on that row,
including the plain visual badges, navigates to
`/admin/payments?paymentId=<id>&booking=<reference>`, where `PaymentsPage.jsx`
opens the matching payment details panel for review. Pending rows use a
pointer cursor, hover state, and focus-visible ring. Non-actionable rows do
not receive row keyboard focus or pointer/hover treatment.

The page accepts an optional `reservations` prop to override fetched data. It
remains read-only and no longer renders an Actions column or view/edit/delete
row controls; row clicks are reserved for payment review or the existing
attendance/balance/read-only modal flows.

Paid room reservations now open an attendance modal. A confirmed venue reservation with a verified deposit and an outstanding balance opens the shared balance-only payment modal; it shows the booking reference, guest, venue, event date, payment summary, payment method, receipt capture when required, and display-only cash change. Venue balance collection does not change the reservation status, which remains `confirmed`. Unpaid, pending, and cancelled reservations remain non-clickable in the list; venue deep links show a read-only summary for other venue states. Confirmed room reservations offer check-in; checked-in reservations offer check-out; other paid room reservations show a read-only summary. The room modal defaults to the current Asia/Manila time, allows corrections, previews the server-calculated fee and rounded-up hours, requires a fee-collected checkbox and confirmation when a fee is greater than zero, and refreshes the list after success.

Attendance endpoints require `admin` or `receptionist` and use the existing authenticated cookie:

```text
GET   /api/admin/reservations/:id/attendance-preview?action=check-in|check-out&actual_time=YYYY-MM-DDTHH:mm
PATCH /api/admin/reservations/:id/check-in
PATCH /api/admin/reservations/:id/check-out
```

Check-in requires a confirmed room reservation with a verified payment, an actual date on or after `check_in_date`, and an actual datetime before the scheduled `check_out_date` at the standard 12:00 noon Manila check-out time. Check-out requires `checked_in`, cannot precede the actual check-in, and may occur on or after `check_out_date`. Actual times cannot be more than five minutes in the future. Early and late fees use named backend constants for PHP 500 per started hour, with standard times of 2:00 PM and 12:00 noon in Asia/Manila. A later-date arrival has no early fee or discount; successful late check-ins audit the late-arrival flag and days late. Check-out transitions to `completed`, which no longer blocks room availability. Each successful action writes an audit log with the fee and hours charged.

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

Room availability excludes inactive rooms and overlapping active reservations. Room totals are calculated from `price_per_night` multiplied by the number of nights. Venue availability is single-day only and stores `event_date`; venue walk-ins collect the event start time, package when applicable, pax, and extra hours, then the backend validates the schedule and calculates the package or day-use total.

The create endpoint locks the selected room or venue, re-checks active reservation conflicts inside a transaction, validates capacity and dates including server-side Asia/Manila past-date checks, validates venue time windows and active packages, calculates venue pricing server-side, snapshots venue timing/package fields, creates or updates the guest in `Customer` with `is_registered = FALSE` when a new record is needed, and sets `booking_source` to `walk-in`. Booking references use the existing `KAB-YYYY-MM-####` format and `created_by` stores the authenticated staff user. Walk-in creation requires an active payment method, records a verified `Payments` row for the booking total, and associates it with the confirmed reservation.

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

The balance endpoint accepts confirmed venue reservations as well as confirmed or checked-in room reservations. Venue rows include display-safe `total`, `amount_paid`, `deposit_due`, `balance_due`, `payment_summary`, booking reference, guest, venue name, and event date in the list and lookup responses. Check-in, check-out, attendance-preview, and extra-bed endpoints reject venue reservations with a generic `409`; venue balance collection does not transition status.

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

Income PDF export is available at `GET /api/admin/reports/income/pdf?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`. It uses the same date validation/defaults and shared verified-payment row helper as the Reports aggregate, is restricted to `admin` (receptionists receive `403`), and is limited to 30 requests per IP per 60 minutes. The Reports page's `Preview Income Report` button generates the PDF once, keeps the response blob in memory, and shows it in a full-screen modal. `Download PDF` saves that same blob using the server filename without another request; `Print` prints the embedded viewer or opens the blob in a new tab when the browser blocks embedded printing. Narrow screens and iframe failures offer `Open preview in new tab` and `Download PDF` instead of a blank frame. Closing the modal, changing the date range, or unmounting revokes the object URL; closing during generation aborts the request. Each preview generation writes the existing `report.income_export` audit action, which remains accurate because a preview is an income report generation; downloading or printing the already-generated blob adds no audit entry. The server uses `pdfkit`, bundled Noto Sans fonts in `backend/assets/fonts/`, and the copied logo at `backend/assets/transparent-kaiazul.png`; install with `cd backend; npm install`.

The PDF revenue basis is cash basis: verified deposits, balances, and walk-in full payments grouped by verification date in Asia/Manila (falling back to `created_at` when `verified_at` is unavailable). It includes payment type, month, method, online/walk-in source, and room/venue breakdowns, plus a privacy-safe transaction appendix. Attendance fees, add-ons, retained cancelled deposits, and outstanding balances are explicitly informational and not revenue. Attendance fees display as unavailable when their optional columns are missing. Resort identity is read from `ResortSettings` with the same public fallback values. The Reports page keeps its existing cards/charts, adds Manila quick ranges, and shows the export button only to admins.

## Resort Information and public resort details

The public endpoint `GET /api/resort-info` returns `resort_name`, `address`, `contact_number`, and `email` without authentication, with a short public cache. The landing page shares one fetch through `src/public/context/ResortInfoContext.jsx`; `src/public/components/Header.jsx`, `src/public/components/HeroSection.jsx`, and `src/public/components/Footer.jsx` render the returned values, and the document title follows the returned resort name. If the request fails or the database table/row is unavailable, the page uses these fallback values: `Kai Azul Beach Resort`, `123 Shoreline Drive, Beach City`, `+63 912 345 6789`, and `info@kaiazul.com`. Phone and email links use `tel:` and `mailto:` values.

Admin settings use cookie authentication and `requireRole('admin')`:

```text
GET /api/admin/settings/resort
PUT /api/admin/settings/resort
```

The Settings page contains the Resort Information, Payment Methods, Staff Accounts, and Room Inventory Checklist cards. Resort Information loads and saves four controlled fields with client/server validation, dirty-state save disabling, inline loading/errors/success, and `/admin/login` redirects for `401`/`403`. Staff Accounts includes account management, one-time reset-password modals, and a Change My Password link. Room Inventory Checklist lists active and inactive items, uses row-click edit modals, and manages names, peso charges, and activation without hard deletion. Notification toasts are unrelated to this page and continue through `AdminNotificationsProvider` in `AdminLayout`.

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

Reservations use the status label `Completed` for completed stays; `Checked In`
remains the label for active stays and `Check-out` remains action wording.
Completed room rows are keyboard-accessible clickable rows and open a
read-only modal. The modal fetches the signed checkout inventory inspection
only when opened, including its item charges, condition checks, collection
status, guest/attendant names, signed time, and signature image. Older
completed reservations without an inspection show `No inventory inspection on
record.` The Reservations table has no Actions column; its Scan QR header
action remains available.

The current schema supports the requested snapshot, action, revenue, trend, popular-resource, and recent-reservation fields. Attendance fees return zero with `fees_available: false` when the attendance-fee columns are not present. No schema changes or migrations were added.

## Local-network development

The frontend API base URL is configured with `VITE_API_URL` in `KAIROS/.env`; when it is unset or empty, requests use same-origin `/api/...` paths. Vite proxies those paths to the backend at `http://localhost:5000`. For a Cloudflare quick tunnel, use the tunnel URL for both `ADMIN_APP_URL` and the backend `ALLOWED_ORIGINS` value, set `COOKIE_SECURE=true` and `TRUST_PROXY=true`, then open the tunnel URL in the browser. `ADMIN_APP_URL` is also used for reservation QR links in accepted-payment emails.

### Room inventory checklist backend

#### Database setup

`backend/database/schema.sql` creates `Inventory_Items`,
`Reservation_Inventory_Checks`, and `Reservation_Inventory_Lines`, then
seeds the nine default checklist items with `INSERT IGNORE` keyed by the
unique item name. The seed is also included in
`backend/migrations/20261007_add_inventory_checklist.sql` and
`backend/database/createAdmin.js`; it never overwrites an existing item or
its charge. `Reservation_Inventory_Lines` stores `item_name` and
`unit_charge_cents` snapshots, so later item edits do not change completed
inspections. A checkout is blocked for admins and receptionists when there
are no active checklist items; the modal directs an admin to Settings.

The manual migration `backend/migrations/20261007_add_inventory_checklist.sql`
adds the checkout-only `Reservation_Inventory_Checks` and
`Reservation_Inventory_Lines` structures while retaining the existing
`Inventory_Items` shape. All charges use integer-centavo columns:
`default_charge_cents`, `unit_charge_cents`, `charge_cents`, and
`total_charge_cents`. There is one signed inspection per reservation; there is
no phase or check-in checklist.

Authenticated routes are available under `/api/admin/inventory-items`:
`GET /inventory-items` (admins and receptionists; admins may pass
`include_inactive=1`), `POST /inventory-items`, `PUT /inventory-items/:id`,
and `PATCH /inventory-items/:id/deactivate` or
`PATCH /inventory-items/:id/reactivate` (admin-only management). Inspection
routes under `/api/admin/reservations/:id/inventory` are GET inspection, POST
`.../inventory/check-out`, and PATCH `.../inventory/charges/collect`.
Admins and receptionists can read/submit inspections and collect charges;
item writes remain admin-only. Item responses use `item_id`, `item_name`,
`default_charge_cents`, and `is_active`. The Settings UI displays charges in
pesos and converts them to integer centavos at the request boundary.
Uploads use Cloudinary, writes are transaction-locked and audited, missing
tables return `503`, and check-out requires a completed inspection and blocks
until positive loss/damage charges are collected. The inspection is saved in a
separate transaction before the attendance check-out action. The migration is
prepared but has not been applied; the existing pre-inventory backup is
`backend/backups/kairos_db_20261007_pre_inventory.sql`.

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

## Reservation Status History

`Reservation_Status_History` is defined in `backend/database/schema.sql` directly after `Reservations` and mirrors `backend/migrations/20261007_add_phase_b_customer_backend.sql`: `history_id` PK, `reservation_id` FK, `from_status VARCHAR(30) NULL`, `to_status VARCHAR(30) NOT NULL`, `actor_type ENUM('customer','staff','system') NOT NULL DEFAULT 'system'`, `changed_by` FK to `Users`, `changed_by_customer_id` FK to `Customer`, the `chk_status_history_one_actor` CHECK (both actor ids cannot be set at once), `reason VARCHAR(255)`, `created_at`, and `KEY idx_status_history_reservation_created (reservation_id, created_at)`.

All writes go through `recordReservationStatusHistory(connection, reservationId, fromStatus, toStatus, actorType, actorId, reason)` in `backend/utils/reservationStatusHistory.js`. It skips no-op transitions (`fromStatus === toStatus`), throws on an unknown `actorType` or a missing/non-positive actor id for `customer`/`staff`, maps `staff` to `changed_by` and `customer` to `changed_by_customer_id`, and inserts using the caller's transaction connection so history commits or rolls back with the status change itself.

Callers — the complete list found in the codebase:

| Caller | Endpoint / job | Transition | Actor |
|---|---|---|---|
| `reservationController.js` | `POST /api/reservations` | `NULL` -> `payment_pending` | `customer` + customer id |
| `publicReservationController.js` | `POST /api/reservations/:id/payment` | `payment_pending` -> `pending_verification` | `staff` when `req.accessMode === 'staff'`, else `customer` |
| `adminPaymentController.js` | `PATCH /api/admin/payments/:id/accept` or `/decline` | previous -> `confirmed` / `rejected` | `staff` + user id, rejection reason on decline |
| `adminReservationController.js` | `PATCH /api/admin/reservations/:id/check-in` or `/check-out` | previous -> `checked_in` / `completed` | `staff` + user id |
| `adminWalkInController.js` | `POST /api/admin/walk-in/bookings` | `NULL` -> `confirmed` | `staff` + user id |
| `cleanupExpiredReservations.js` | in-process job every 60 seconds | `payment_pending` -> `cancelled` | `system`, reason `Payment hold expired.` |

Manual migrations: `backend/migrations/20261007_add_phase_b_customer_backend.sql` adds the table, indexes, and the reviews unique key to an existing database; `backend/migrations/20261007_backfill_reservation_status_history.sql` inserts one `system` row (`from_status` NULL, reason `Backfilled from existing reservation (original history unavailable)`) for every reservation that has no history yet. Neither migration runs automatically.

## Reservation Sources

`Reservations.booking_source` is `ENUM('online', 'walk-in')` — exactly two stored values. Reservations reach the admin UI through three intake paths:

1. Public guest booking: `POST /api/reservations` without a session creates a `Customer` row with `is_registered = FALSE` (`reservationController.js`) and stores `booking_source = 'online'`.
2. Logged-in portal customer booking: the same endpoint through `optionalAuth`; these customers come from `POST /api/auth/register` with `is_registered = TRUE`, and the history actor is the customer. The stored source is also `online`.
3. Staff walk-in: `POST /api/admin/walk-in/bookings` creates or updates a guest `Customer` (`is_registered = FALSE`), stores `booking_source = 'walk-in'`, inserts a `verified` full payment, and records history with a `staff` actor.

Admin display: `ReservationsPage` lists every reservation regardless of source; the Dashboard Recent Reservations table has a `Source` column rendering `booking_source`; `CustomersPage` fetches `GET /api/admin/customers` live and labels rows `Registered` or `Guest` from `is_registered`, and `adminCustomerController.js` supports `?type=registered|guest` filtering.

## No-Cancellation Policy

There is no cancellation, modification, or rebooking endpoint anywhere in the backend. Verified route inventory: `adminReservationRoutes.js` exposes only lookup, list, balance, extra-bed, attendance preview, check-in, and check-out; `customerRoutes.js` exposes only reservation/payment reads plus profile, password, and review actions; `publicReservationRoutes.js` exposes only `GET /api/reservations/:id` and `POST /api/reservations/:id/payment`. Customers therefore cannot change reservation statuses. Staff UI actions are limited to payment review and attendance. The only writer of the `cancelled` status is the system hold-expiry job in `backend/utils/cleanupExpiredReservations.js`. The 50% deposit remains non-refundable per the Payment Policy section above.

## Reservation payments and list behavior

`GET /api/admin/reservations/:id/payments` is protected by `requireAuth` and
`requireRole('admin', 'receptionist')`, and is registered before the generic
reservation id routes. It returns display-safe payment rows
(`payment_id`, `payment_type`, `method_name`, `amount`, `payment_status`,
`created_at`, and `verified_at`) plus the `payment_summary`. Because the
existing Payments list exposes receipt URLs to both staff roles, this endpoint
also includes `proof_of_payment_url` when present; reviewer ids, internal
notes, and raw database errors are not returned. Legacy databases without
`Payments.payment_type` display rows as `full`. Unknown reservation ids return
a generic 404.

Room reservations route by status first: `confirmed` opens Check-in,
`checked_in` opens Check-out regardless of payment summary, and `completed`
opens read-only. Fully paid confirmed or checked-in rooms therefore retain
their attendance action. Fully paid confirmed venues open read-only, while
confirmed venues with a verified deposit and balance open the balance-only
modal. Existing actionable room and venue rows remain clickable and show the
same Payments section. The section loads when the modal opens, aborts its
request when the modal closes, and displays loading, empty, and inline error
states followed by Total, Amount paid, and Balance due. Cancelled reservations
with verified retained deposits therefore show those deposits as paid through
the shared payment summary.

Reservations are filtered first and then paginated client-side with the
reusable `components/Pagination.jsx` control. The default page size is 10
(optional 25 or 50), filters reset to page 1, and page numbers collapse to
ellipses for long ranges. The table body scrolls within the page while its
header remains visible, and the current page clamps after the filtered list
shrinks.

The Reservations `Pending verification` filter is based on the
display-safe `has_pending_payment` flag, meaning at least one payment row has
`payment_status = 'pending_verification'`. It is independent of the
reservation status label and is combined with search, date filters, and
pagination. Matching rows display a Pending verification badge.

## Authentication and Role Enforcement

Both portals share one httpOnly JWT cookie, `kairos_auth`, so a browser holds one session at a time. Login is portal scoped: the admin login sends `portal: "staff"` and authenticates only against `Users`; customer credentials return the same generic `Invalid email or password.` response as any other failed staff login, with no cookie replacement. The admin portal's `RequireRole` in `routes/AdminRoutes.jsx` gates pages by `allowedRoles` (`['admin', 'receptionist']` layout groups for Dashboard, Reservations, Walk-in, Payments, and Reports; `['admin']` for the admin-only pages) and redirects unauthenticated users to `/admin/login`. `GET /api/auth/me?portal=staff` treats a customer session as signed out without clearing the shared cookie.

Backend enforcement lives in `backend/middleware/auth.js`: `requireAuth` trusts the signed JWT payload with no per-request database lookup, so role changes take effect only after token expiry or logout; `requireRole(...roles)` compares `req.user.role` against the allowlist. Verified router guards: rooms, venues, users, customers, audit logs, payment methods, and resort settings use `router.use(requireAuth, requireRole('admin'))`; dashboard, reports, and walk-in use `requireRole('admin', 'receptionist')`; reservations and payments use `requireAuth` plus per-route `requireRole('admin', 'receptionist')`; inventory uses `requireAuth` plus per-route two-role checks; customer and chatbot routes use `requireRole('customer')`.

## Rate Limits

`backend/middleware/rateLimit.js` keeps an in-memory bucket map keyed by `ip:req.baseUrl:req.path` (default 30 requests per 60-second window). Over-limit requests receive `429` with `{"error":"Too many requests. Please try again later."}`. Counters reset on server restart and are not shared across processes.

| Route | Limit | Where |
|---|---|---|
| `POST /api/auth/register` | 10 per 60 s | `authRoutes.js` |
| `POST /api/auth/login` | 10 per 60 s | `authRoutes.js` |
| `POST /api/reservations` | 10 per 60 minutes | `reservationRoutes.js` |
| `POST /api/reservations/:id/payment` | 5 per 60 s | `publicReservationRoutes.js` |
| `POST /api/reservations/track` | 10 per 15 minutes | `trackRoutes.js` |
| `POST /api/chatbot/message` | 20 per 60 s | `chatbotRoutes.js` (customer role) |
| `PATCH /api/admin/users/:id/reset-password` | 10 per 60 minutes | `adminUserRoutes.js` (admin role) |
| `GET /api/admin/reports/income/pdf` | 30 per 60 minutes | `adminReportRoutes.js` (admin role) |

## Image Uploads

`backend/middleware/upload.js` uses multer memory storage with a 5 MB (`5 * 1024 * 1024`) size limit and an allowlist of exactly `image/jpeg`, `image/png`, and `image/webp`. Other types return `400` "Only JPEG, PNG, and WebP images are allowed."; oversized files return `400` "Image must be 5 MB or smaller.". `singleImageUpload(fieldName)` returns the middleware for a named field; used bare it handles the `qr_image` field. It guards public payment proofs, walk-in receipts, balance-collection proofs, room and venue images, payment-method QR images, and the inventory signature. Buffers are then stored on Cloudinary: `kairos/payment-proofs` (public deposit proofs, walk-in receipts, balance receipts), `kairos/rooms`, `kairos/venues`, `kairos/payment-methods`, and `kairos/signatures`.

## Reservation and Payment Statuses

`Reservations.status` is an ENUM of `payment_pending`, `pending_verification`, `confirmed`, `checked_in`, `completed`, `cancelled`, `rejected` (schema default `payment_pending`). Who produces each value:

| Status | Produced by |
|---|---|
| `payment_pending` | Online booking creation (`reservationController.js`) |
| `pending_verification` | Receipt upload on an online booking (`publicReservationController.js`) |
| `confirmed` | Staff payment accept; walk-in creation inserts directly as `confirmed` |
| `checked_in` | Staff check-in |
| `completed` | Staff check-out |
| `cancelled` | System hold-expiry job only |
| `rejected` | Staff payment decline |

`Payments.payment_status` is an ENUM of `pending`, `pending_verification`, `verified`, `rejected`. `pending_verification` is set when an online deposit proof is inserted; `verified` is set by staff payment accept, walk-in full payments, and balance collection (all stamp `verified_by` and `verified_at` at insert or review); `rejected` is set by staff decline; `pending` exists only as the column default and no current insert path uses it.

## Database Setup

Fresh installs: `backend/database/initDb.js` runs on server startup, rewrites `CREATE DATABASE`/`USE` to the `DB_NAME` value, and executes `backend/database/schema.sql` (every statement is `CREATE ... IF NOT EXISTS`), which includes the reservation status, venue package, customer lookup, payment, and review structures. It then checks required indexes through `information_schema` and seeds the configured rooms and three venue records; it no longer seeds the old Test Sunset Pavilion venue.

Existing databases: `initDb` never alters existing tables and never runs `backend/migrations/`, so upgrades stay manual. Fold every manual migration into `schema.sql` in the same change, then apply it yourself, for example:

```text
mysql -u root -p kairos_db < backend/migrations/20261007_add_phase_b_customer_backend.sql
mysql -u root -p kairos_db < backend/migrations/20261007_backfill_reservation_status_history.sql
mysql -u root -p kairos_db < backend/migrations/20261008_drop_unused_notifications.sql
```

## Recent changes (October 13, 2026)

- October 14, 2026: Room inventory inspection and validation apply only to check-out, and reservation attendance modal state resets per action.
- October 14, 2026: Room attendance routes by status before payment summary, so fully paid confirmed and checked-in rooms retain Check-in or Check-out.
- October 13, 2026: Documented portal-scoped staff login, generic
  cross-portal failures, portal-aware session checks, and Google rejection for
  staff emails.
- October 10, 2026: Accepted-payment emails for confirmed reservations include
  a "Find us" section with the resort name and the address saved in
  `ResortSettings`, an optional Google Static Maps image, and a Google Maps
  "Get directions" button. The map follows the address saved in Settings;
  `RESORT_MAP_QUERY` can override only the map search text and
  `RESORT_MAPS_URL` can override the button URL when it starts with `https://`.
  `GOOGLE_MAPS_STATIC_API_KEY` enables the optional map image. If the settings
  table/row is unavailable, the public fallback resort information is used.
  Missing or failed map requests skip only the image, while the address and
  button remain in the email.
- October 9, 2026: Added the opt-in pilot workflow under
  `backend/scripts/`: copy `pilotData.example.json` to the ignored
  `pilotData.json`, fill in resort information, rooms, venues, Conference Hall
  packages, and payment methods, then run `node scripts/seedPilot.js` from
  `backend`. The seed upserts by room number, venue name, and package name,
  preserves existing QR image URLs when no image is supplied, deactivates
  omitted resource/package rows, never deletes rows, and prints a summary. QR
  images must be uploaded through the admin Payment Methods UI.
- October 9, 2026: Added the opt-in `seedDemoBookings.js` script. It creates
  three clearly fake `@pilot.invalid` guests with verified deposit, balance,
  completed-stay, and walk-in payment examples using the shared payment policy
  helpers. It is never run by startup or `initDb`.
- October 9, 2026: Added `resetTransactionalData.js`. It prints `DB_NAME`,
  requires an exact typed confirmation, reports counts before and after, and
  transactionally clears all rows in the listed transactional tables in
  foreign-key-safe order plus `@pilot.invalid` customers. It does not touch
  staff, rooms, venues, packages, payment methods, or resort settings. Use
  `DB_NAME` in `backend/.env` (or an explicit environment) to select the
  target database.
- October 9, 2026: Added `checkPilotReadiness.js`, which reports configuration
  and data checks without printing secret values. It covers JWT/cookie/origin,
  SMTP, Cloudinary, test/default staff data, prices/inclusions, payment-method
  images, and fallback ResortSettings.

The current fresh-install seed remains `initDb.js` plus `schema.sql`: the
startup path inserts `TEST-101`; `schema.sql` inserts Small Cottage,
Conference Hall, Big Cottage, the four original Conference Hall packages
(`Free Venue (Per Person)`, `Package 10K`, `Package 15K`, `Package 20K`), Cash
and Card payment methods without QR images, fallback ResortSettings, and
chatbot FAQ/knowledge rows. Staff users are not seeded; `createAdmin.js`
creates one from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`. Existing
databases are not migrated automatically.

Pilot workflow: apply required manual migrations, switch `DB_NAME` to the
pilot database, run `node scripts/seedPilot.js [path-to-pilotData.json]`,
upload payment QR images in the admin UI, run `node scripts/checkPilotReadiness.js`,
and manually verify bookings, payments, email, and image uploads. For a
demo-only rehearsal, run `node scripts/seedDemoBookings.js`; after the pilot,
run `node scripts/resetTransactionalData.js` against the printed database and
type its name exactly. None of these scripts is run automatically.

## Recent changes (October 8, 2026)

- October 14, 2026: Admin payment and reservation date displays now use shared,
  explicit Asia/Manila formatting. The admin payments mapper receives
  `check_in_date`, `check_out_date`, and venue `event_date` as `YYYY-MM-DD`
  strings from `DATE_FORMAT`, while submitted/processed/payment-history,
  attendance, audit, dashboard, chatbot, and customer timestamps use the same
  timezone-safe display helpers. Payment details preserve the existing review
  and decision behavior and render room ranges and venue event windows as
  friendly dates.
- October 14, 2026: Removed the unused legacy `chatbot_kb` table from fresh
  schema creation. Apply the manual destructive migration with
  `mysql -u root -p kairos_db < backend/migrations/20261014_drop_chatbot_kb.sql`;
  live chatbot content remains in `Chatbot_Faqs`, `Chatbot_Knowledge`,
  `Chatbot_Unanswered`, `Chatbot_Conversations`, and `Chatbot_Messages`.
- October 8, 2026: Removed the unused legacy `Notifications` table from fresh
  schema creation and added the manual destructive drop migration. Staff
  real-time notifications remain process-local and in-memory with no database
  notification table.
- October 8, 2026: Added admin-only staff password reset, one-time temporary
  passwords, forced next-login password changes, password-version session
  invalidation, and the standalone staff change-password screen.
- October 9, 2026: Expanded admin walk-in venue bookings with event start
  time, package selection when applicable, extra hours, server-side venue
  validation, package snapshots, and calculated venue totals. Conference Hall
  start times are restricted to hourly options.
- October 9, 2026: Moved the walk-in payment card above the booking summary
  card in the admin layout so payment method selection and receipt capture are
  accessible without scrolling past the summary.
- Documented `Reservation_Status_History`, the `recordReservationStatusHistory` helper's rules, and all six callers with their exact transitions and actors.
- Documented the three reservation intake paths behind the two-value `booking_source` enum and how Reservations, Dashboard, and Customers display them.
- Verified and documented the no-cancellation policy: no endpoint exists for cancelling, editing, or rebooking reservations; only the system hold-expiry job writes `cancelled`.
- Added the shared `kairos_auth` cookie model, backend `requireRole` guard inventory, and frontend `RequireRole` behavior.
- Added a verified rate-limit table for all six limited endpoints and the upload rules (5 MB; JPEG, PNG, WebP; Cloudinary folders).
- Added producer tables for every reservation and payment status, noting `Payments.payment_status = 'pending'` is unused by current inserts.
- Documented `initDb.js` versus manual migrations, confirming `Reservation_Status_History` and the new indexes are folded into `schema.sql` for fresh installs.
- Corrected the stale `CustomersPage` row: the page now loads live data from `GET /api/admin/customers` instead of only `defaultCustomers`.
- October 8, 2026: Documented live venue rule and package management, validation rules, venue reservation fields in the admin list, and the hall-only fields shown for cottages.
- October 8, 2026: Documented the Phase 1 venue schema, package snapshots, server-side pricing/conflicts, idempotent manual migration, and removal of the old Test Sunset Pavilion seed.
- October 8, 2026: Extracted the Conference Hall package manager into a guarded admin component, added hall-only package controls, and kept day-use cottages package-free.
- October 8, 2026: Wired Chatbot Management to live FAQ, knowledge, unanswered-question, conversation, and statistics data with admin-only mutations and privacy-safe conversation display.
- October 8, 2026: Added admin-only, rate-limited server-side Income Report PDF export with bundled Peso-capable fonts, copied logo asset, shared verified-payment metrics, privacy-safe transactions, and audit logging.
- October 13, 2026: Added an admin-only Income Report PDF preview modal with one-request blob reuse for download and print, mobile/new-tab fallback, abortable generation, and a 30-per-hour export limit.
- October 13, 2026: Fixed the reservation payment-status deep link so pending payment and pending verification badges navigate to the matching Payments page record and open its details panel.

## Known gaps

- Venue customer booking has been verified through the Vite-proxied API flow and
  frontend build, but not through a complete manual browser click-through.
- Chatbot admin/customer verification still requires a live database with the manual chatbot-management migration applied.
- Staff reset and session-invalidation click-through verification still
  requires a live database with
  `20261008_add_staff_password_reset.sql` applied.
- Income PDF generation still requires live-database verification for data totals, empty/multi-year/one-day ranges, multi-page pagination, receptionist `403`, and visual Peso glyph rendering.

## Placeholder customers and reservation holds

- Early guest room holds use the configured
  `PLACEHOLDER_CUSTOMER_MARKER`. Placeholder rows are excluded from the
  Customers list and detail lookup, chatbot customer search, and
  registered-versus-guest report percentages.
- The information step replaces the placeholder with submitted guest details,
  or switches the hold to a matching existing guest customer, in the same
  transaction. Registered-account matches retain the existing login guidance.
- Holds are `payment_pending` reservations and appear as unavailable until
  expiration or release. Cleanup cancels expired holds and only considers
  deleting placeholders that have no reservation, payment, or audit reference.

## Venue and portal holds

- Room and venue holds share the `payment_pending` lifecycle, resource-first locking, active-hold availability filtering, expiry cleanup, and release behavior.
- Logged-in portal customers attach directly to their Customer row; public guests use the configured placeholder marker until hold details replace or transfer it.

## Authentication audit ownership

- Staff authentication audit entries retain the staff `Users.user_id`. Customer IDs are never written to the `Audit_logs.user_id` foreign key because customers are stored in `Customer`; customer auth events use a null audit actor ID with event metadata preserved.

## Dev seeding

- To create reviewable completed room stays for an existing customer, run
  `node backend/scripts/seedCompletedStays.js [email] [--count=3]`.
  The default email is `ivanrocat13@gmail.com`; `--count` accepts 1-10 and
  `--no-payments` omits verified full payment rows (otherwise revenue reports
  increase on the seeded totals). The script refuses `NODE_ENV=production`,
  never creates a customer, and uses the reserved recognizable reference range
  `KAB-YYYY-MM-9xxx`.
- To remove only rows created by the seed, run
  `node backend/scripts/seedCompletedStays.js --cleanup [email]`.
  Cleanup identifies the seed's audit action plus the reserved reference range
  before deleting reviews, payments, status history, audit rows, and then
  reservations. No reviews are created by the seed.
- Reviews require a completed reservation owned by the authenticated customer;
  the unique reservation/customer constraint allows one review per stay. The
  seeded rows therefore appear under My Reviews and the completed reservation
  review action.

## Customer review refresh behavior

- `BookingContext` is the shared customer-side source for reservations and
  reviews. It exposes `refresh()` for refetching both APIs and `markReviewed()`
  for the immediate optimistic update after a successful review submission.
  My Reviews, Dashboard, and Reservation Details refresh when they receive the
  review invalidation state through router navigation.
- The review form disables its submit button while the request is in flight.
  Duplicate-review responses remain a clean `409` with a generic message; the
  UI treats them as already reviewed, refreshes the shared state, and replaces
  the review route with My Reviews. Direct or stale review links are guarded
  before the form is shown.

## Customer authentication additions

- Public customer auth remains at `POST /api/auth/login`, `POST /api/auth/register`,
  `POST /api/auth/logout`, and `GET /api/auth/me`. Customer accounts live in
  `Customer`; staff authentication and `Users` are not used by these flows.
- Password recovery uses `POST /api/auth/forgot-password` and
  `POST /api/auth/reset-password`. The forgot response is generic to prevent
  account enumeration. Reset tokens are random URL-safe values whose SHA-256
  hashes are stored in `PasswordResetTokens`, expire after 60 minutes, and are
  single-use. Recovery emails use `PUBLIC_APP_URL`; SMTP failures are
  non-blocking. Both routes use five requests per IP and identifier per 15
  minutes. The limiter is in-memory and therefore only applies reliably to one
  backend instance.
- Google Identity Services calls `POST /api/auth/google` and
  `POST /api/auth/google/complete`. The backend verifies the ID token with
  `GOOGLE_CLIENT_ID`, requires a verified email, and uses the same httpOnly
  `kairos_auth` cookie as password login. A new or incomplete Google account
  receives only a 10-minute JWT with `purpose: google_signup`; it is kept in
  React state, never local storage, and is accepted only by the complete
  endpoint.
- The customer-auth migration adds nullable `Customer.date_of_birth`,
  nullable unique `Customer.google_sub`, and `PasswordResetTokens`. Apply it
  manually (never automatically):
  `mysql -u root -p kairos_db < backend/migrations/20261010_add_customer_auth_features.sql`.
  Fresh installs include the same definitions in `backend/database/schema.sql`.
  `PUBLIC_APP_URL` and `GOOGLE_CLIENT_ID` are backend variables;
  `VITE_GOOGLE_CLIENT_ID` is the frontend variable. Google UI is hidden when
  the frontend client ID is absent.
- Registration and new/incomplete Google sign-up enforce an 18+ date of birth
  server-side using the full date in `Asia/Manila`. Future, invalid, and
  over-120-year dates are rejected. Existing password accounts without a
  birthday are not blocked or prompted by this task.
