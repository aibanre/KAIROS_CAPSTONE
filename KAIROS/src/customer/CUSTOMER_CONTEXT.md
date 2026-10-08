# Harbor & Haven Customer Portal

## Purpose

`src/customer/` contains the authenticated Harbor & Haven customer portal. It uses React JSX, React Router, Tailwind CSS, customer API modules, and context state. The existing login and registration screens are owned by `src/public/pages/` and are only imported by `CustomerRoutes.jsx`.

## Routes

| Route | Page |
| --- | --- |
| `/` | Public landing page for all visitors |
| `/login` | Existing public login page |
| `/register` | Existing public registration page |
| `/portal` | Dashboard |
| `/portal/browse` | Room and venue browser |
| `/portal/rooms/:id` | Room details and availability |
| `/portal/venues/:id` | Venue details and availability |
| `/portal/book` | Booking details |
| `/portal/payment/:reservationId` | Payment method and proof upload |
| `/portal/confirmation/:reservationId` | Booking confirmation and QR code |
| `/portal/reservations` | Reservation history |
| `/portal/reservations/:id` | Reservation details and timeline |
| `/portal/reviews` | Written and pending reviews |
| `/portal/reviews/new/:reservationId` | Review form for eligible completed reservations |
| `/portal/profile` | Customer profile |
| `/portal/chat` | Full AI assistant |

All `/portal/*` routes are protected and redirect to `/login` when unauthenticated. Unknown routes redirect to `/`. Logout returns to `/`.
Public pages perform a silent customer-session check; an unauthenticated response does
not redirect visitors. Customer API 401 redirects are limited to `/portal/*` routes.

## Folder guide

- `components/` — reusable navigation, cards, statuses, booking, review, empty-state, and chatbot UI.
- `layouts/PortalLayout.jsx` — responsive sidebar, topbar, routed content outlet, and chatbot widget.
- `api/` — shared request client and one module per customer domain.
- `context/CustomerAuthContext.jsx` — cookie-backed authentication and customer-role guard.
- `context/BookingContext.jsx` — in-progress booking, reservation creation, payment updates, and isolated backend-gap fallbacks.
- `pages/` — one route-level component per portal screen.
- `routes/CustomerRoutes.jsx` — public auth routes, protected wrapper, and portal route map.
- `data/` — fixtures retained only for domains without backend endpoints.
- `utils/` — currency, dates, references, and validation.

## Data rules

- Currency is Philippine Peso (`₱`).
- Reservation statuses are Pending, Payment Verified, Confirmed, Completed, and Cancelled.
- Payment statuses are Unpaid, Proof Submitted, Verified, and Rejected.
- A review is permitted only for a Completed reservation that has not already been reviewed.
- All bookings are final. Customers cannot cancel, refund, rebook, reschedule, or change dates.
- Uploaded payment proof accepts JPG, PNG, or WebP files up to 5 MB, matching the backend upload middleware.
- Backend reservation and payment state is persisted server-side; unsupported customer-only domains remain isolated mock fallbacks.
## Phase A integration

The customer portal uses `src/customer/api/` for backend requests. All requests use
the existing `VITE_API_URL` value from `src/config/api.js` and send
`credentials: 'include'` so the backend `kairos_auth` cookie is preserved.

Customer auth calls `POST /api/auth/login`, `POST /api/auth/register`,
`POST /api/auth/logout`, and `GET /api/auth/me`. The backend customer role value
is exactly `customer`; staff roles are `admin` and `receptionist`.

The customer and admin portals share the backend `kairos_auth` cookie. A browser
can therefore hold only one active backend session at a time. The customer
portal treats staff sessions as unauthenticated and shows a staff-session
message without silently logging the staff user out.

Implemented real customer endpoints:

- `GET /api/rooms`, `GET /api/rooms/:id`
- `GET /api/rooms/availability`
- `GET /api/rooms/:id/booked-dates`
- `GET /api/venues`, `GET /api/venues/:id`
- `POST /api/reservations`
- `GET /api/reservations/:id`
- `GET /api/payment-methods`
- `POST /api/reservations/:id/payment`

Staff and the system are the only actors that can cancel or reject reservations.
Customer payment proof submission can move `payment_pending` to
`pending_verification` only. Rejected payment proofs may be replaced only while
the reservation remains payment-eligible and its hold has not expired.

`backend/database/schema.sql` is the source of truth for fresh database
installations. Files in `backend/migrations/` are the upgrade path for existing
databases and are not run automatically during startup.
