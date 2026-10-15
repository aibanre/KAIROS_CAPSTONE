# Kai Azul Customer Portal

## Purpose

`src/customer/` contains the authenticated Kai Azul customer portal. It uses React JSX, React Router, Tailwind CSS, customer API modules, and context state. The existing login and registration screens are owned by `src/public/pages/` and are only imported by `CustomerRoutes.jsx`.

## Routes

| Route | Page |
| --- | --- |
| `/` | Public landing page for all visitors |
| `/login` | Existing public login page |
| `/register` | Existing public registration page |
| `/rooms-and-venues` | Public room and venue browser |
| `/rooms-and-venues-details` | Public room and venue details |
| `/booking-information` | Public booking details |
| `/book/room/:roomId` | Public booking details for one room |
| `/book/venue/:venueId` | Public venue contact details and reservation submission |
| `/payment/:reservationId` | Public guest payment and proof upload |
| `/terms`, `/privacy`, `/payment-policy` | Public policy pages; accessible logged out or logged in |
| `/portal` | Dashboard |
| `/portal/browse` | Room and venue browser |
| `/portal/rooms/:id` | Room details and availability |
| `/portal/venues/:id` | Venue details and availability; `Plan your event` opens booking details |
| `/portal/book/venue/:venueId` | Venue booking details and reservation submission |
| `/portal/book` | Booking details |
| `/portal/payment/:reservationId` | Payment method and proof upload |
| `/portal/confirmation/:reservationId` | Booking confirmation and QR code |
| `/portal/reservations` | Reservation history |
| `/portal/reservations/:id` | Reservation details and timeline |
| `/portal/reviews` | Written and pending reviews |
| `/portal/reviews/new/:reservationId` | Review form for eligible completed reservations |
| `/portal/profile` | Customer profile |
| `/portal/chat` | Full AI assistant |
| `*` | Any unknown path redirects to `/` |

Only the `/portal/*` block renders inside `RequireCustomer`; everything else in this
table is public. Signed-out visitors on a `/portal/*` path are redirected to `/login`
with the intended location kept in router state, so a successful login returns them
to where they were heading (or to `/portal` when there is no saved location). Logout
from the portal sidebar navigates to `/`.
`CustomerAuthProvider` runs a silent `GET /api/auth/me` session check on load and on
route changes; an unauthenticated response never redirects by itself. The customer
401 handler clears the session and only sends the browser to `/login` when
`window.location.pathname` starts with `/portal`.

## Folder guide

- `components/` — reusable navigation, cards, statuses, booking, review, empty-state, and chatbot UI.
- `layouts/PortalLayout.jsx` — responsive sidebar, topbar, routed content outlet, and chatbot widget.
- `api/` — shared request client and one module per customer domain.
- `context/CustomerAuthContext.jsx` — cookie-backed authentication and customer-role guard.
- `context/BookingContext.jsx` — in-progress booking, portal reservation creation, and optimistic local payment/review state while the backend holds the real data.
- `pages/` — one route-level component per portal screen.
- `routes/CustomerRoutes.jsx` — public auth routes, protected wrapper, and portal route map.
- `data/` — leftover fixtures (`mockReservations.js`, `mockReviews.js`, `mockRooms.js`, `mockVenues.js`); nothing imports them anymore.
- `utils/` — currency, dates, references, and validation.

## Data rules

- Currency is Philippine Peso (`₱`).
- Reservation status labels are Pending, Payment Verified, Confirmed, No Show, Completed, Cancelled, and Rejected (exact mapping below).
- Payment statuses are Unpaid, Proof Submitted, Verified, and Rejected.
- A review is permitted only for a Completed reservation that has not already been reviewed (frontend gate plus a backend 403 for non-completed reservations).
- All bookings are final. Customers cannot cancel, refund, rebook, reschedule, or change dates, and the portal contains no cancel controls.
- The "All bookings are final. Cancellations, refunds, and rebooking are not available." notice appears in `components/VenueBookingForm.jsx`, `pages/BookingConfirmationPage.jsx`, `pages/PaymentPage.jsx`, `pages/ReservationDetailsPage.jsx`, and the public `BookingInformationPage.jsx` and `PaymentDetailsPage.jsx`.
- Uploaded payment proof accepts JPG, PNG, or WebP files up to 5 MB, matching the backend upload middleware.
- Backend reservation and payment state is persisted server-side; portal pages keep only short-lived optimistic copies (a new reservation entry, an updated payment status) right after an action. No page imports the mock fixtures in `data/`.

### Venue reservations

- Small Cottage and Big Cottage use `booking_mode = day_use`, fixed 08:00–17:00 windows, flat per-day prices, and one reservation blocks the whole date.
- Conference Hall uses `booking_mode = packaged`: customers select a package, event date, start time, pax, and optional extra hours.
- Hall packages are stored in `venue_packages`: Free Venue (Per Person) is ₱590 per person with a 100-pax minimum; Package 10K, Package 15K, and Package 20K are flat-price packages. Package fields include name, description, inclusions, pricing type, price, pax limits, included hours, extra-hour rate, active state, and sort order. The 10K/15K/20K inclusions are placeholders until edited by an admin.
- Venue rules use `booking_mode`, `start_time`, `end_time`, `earliest_start`, `latest_end`, `slot_step_minutes`, `buffer_minutes`, and `flat_price`; earliest/latest times and step/buffer rules apply to the hall.
- Venue reservations store event date/time, duration, pax, package id, and package/pricing snapshots. `package_id` intentionally has no foreign key, and editing a package or rule does not change an existing reservation. Venue `check_in_date` and `check_out_date` are null.
- `backend/utils/venueBooking.js` validates, prices, and checks conflicts using Asia/Manila local minutes since midnight. The client displays the server quote; it does not calculate the final amount.
- New customer reservations require tomorrow or later in Asia/Manila. The
  backend `MIN_BOOKING_LEAD_DAYS` config constant is set to `1`; existing
  reservations are unaffected.
## Phase A integration

The customer portal uses `src/customer/api/` for backend requests. All requests use
the existing `VITE_API_URL` value from `src/config/api.js` and send
`credentials: 'include'` so the backend `kairos_auth` cookie is preserved.

Customer auth calls `POST /api/auth/login`, `POST /api/auth/register`,
`POST /api/auth/logout`, and `GET /api/auth/me`; all four pass `handle401: false`
so a missing session never triggers the shared redirect handler. The backend
customer role value is exactly `customer`; staff roles are `admin` and `receptionist`.

The customer and admin portals share the backend `kairos_auth` cookie. A browser
can therefore hold only one active backend session at a time. Login is portal
scoped: customer login sends `portal: "customer"` and authenticates only against
`Customer`; staff login sends `portal: "staff"` and authenticates only against
`Users`. Cross-portal credentials receive only `Invalid email or password.` with
no user data or new cookie. `GET /api/auth/me?portal=customer` treats a staff
session as signed out without clearing the shared cookie, and customer state never
stores staff data. Verified Google emails belonging to staff receive the generic
Google failure and are never linked or created as customers.

### API modules

| Module | Endpoints it calls | Notes |
| --- | --- | --- |
| `client.js` | — | Shared `request()` wrapper: JSON handling, `credentials: 'include'`, the `handle401` flag, and the 401 handler hook |
| `authApi.js` | `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/register/verify`, `POST /api/auth/register/resend-code`, `POST /api/auth/login/verify`, `POST /api/auth/login/resend-code`, `POST /api/auth/logout` | Auth calls use `credentials: 'include'` and `handle401: false`; login verification is customer-portal only |
| `roomsApi.js` | `GET /api/rooms`, `GET /api/rooms/:id`, `GET /api/rooms/availability`, `GET /api/rooms/:id/booked-dates` | `checkAvailability()` currently has no callers |
| `venuesApi.js` | `GET /api/venues`, `GET /api/venues/:id`, `GET /api/venues/:id/packages`, `GET /api/venues/:id/booked-dates` | Normalizes venue rules and packages for browse, dashboard, portal, and venue details |
| `reservationsApi.js` | `POST /api/reservations`, `GET /api/reservations/:id`, `GET /api/customer/reservations` | Normalizes venue event/package fields, parses inclusions from arrays or JSON strings, resolves reservation `images`/`image` values like room and venue payloads, and holds the status mapper |
| `paymentsApi.js` | `GET /api/payment-methods`, `POST /api/reservations/:id/payment` | `getPaymentHistory()` is an unused stub returning `[]` even though the backend now has `GET /api/customer/payments` |
| `reviewsApi.js` | `GET /api/reviews`, `POST /api/customer/reviews` | Public list supports `limit`, `random=1`, `room_id`, and `venue_id`; `getResourceReviews({ roomId, venueId, limit })` powers portal detail reviews. Submit requires a customer session |
| `profileApi.js` | `PATCH /api/customer/profile`, `PATCH /api/customer/password` | `getProfile()` and `changePassword()` have no callers, and the module calls `request` without importing it, so the two PATCH calls throw at runtime until that import is fixed |
| `chatbotApi.js` | `GET/DELETE /api/chatbot/history`, `POST /api/chatbot/message` | Used by both chatbot UIs; requests use the shared credentialed client |

No API module imports mock data; the fixtures in `data/` are referenced by nothing.

### Backend endpoints the portal uses

| Endpoint | Auth rule |
| --- | --- |
| `GET /api/customer/reservations` | `requireAuth` + `requireRole('customer')` |
| `GET /api/customer/reservations/:id` | `requireAuth` + `requireRole('customer')` (exists, but the portal loads details through `GET /api/reservations/:id`) |
| `GET /api/customer/payments` | `requireAuth` + `requireRole('customer')` (not called by the portal yet) |
| `GET /api/customer/profile`, `PATCH /api/customer/profile`, `PATCH /api/customer/password` | `requireAuth` + `requireRole('customer')` |
| `POST /api/customer/reviews` | `requireAuth` + `requireRole('customer')` |
| `GET /api/reviews` | Public |
| `GET/POST/DELETE /api/chatbot/history` and `/api/chatbot/message` | `requireAuth` + `requireRole('customer')`; message endpoint is limited to 20 per 60 s and the configurable daily customer cap (default 100) |
| `GET /api/rooms/:id/booked-dates`, `GET /api/venues/:id/booked-dates` | Public |
| `GET /api/reservations/:id` | `optionalAuth` + `reservationAccess` (customer session or the reservation access token) |
| `POST /api/reservations/:id/payment` | 5 per 60 s, `optionalAuth` + `reservationAccess`, multipart proof upload |
| `POST /api/reservations` | 10 per hour, optional session (guest or logged-in room or venue booking) |
| `GET /api/payment-methods` | Public |

### Status labels customers see

`reservationsApi.js` maps backend values to the labels shown in the portal:

| Reservation `status` | Label |
| --- | --- |
| `payment_pending` | Pending |
| `pending_verification` | Payment Verified |
| `confirmed` | Confirmed |
| `checked_in` | Confirmed |
| `no_show` | No Show |
| `completed` | Completed |
| `cancelled` | Cancelled |
| `rejected` | Rejected |

| Payment `payment_status` | Label |
| --- | --- |
| `pending` | Unpaid |
| `pending_verification` | Proof Submitted |
| `verified` | Verified |
| `rejected` | Rejected |

Note the reservation-level label: `pending_verification` renders as **Payment
Verified** as soon as the proof is uploaded, even though staff have not reviewed it
yet; the payment row for the same reservation correctly shows **Proof Submitted**.

### No-cancellation policy

Staff and the system are the only actors that can cancel or reject reservations;
the customer routes expose no cancel, refund, reschedule, or rebook mutation and
`src/customer/` contains no cancel controls. Customer payment proof submission can
move `payment_pending` to `pending_verification` only: the backend returns 409 for
any other reservation status and 410 when the payment hold has expired. Because a
staff rejection moves the reservation to `rejected`, rejected proofs cannot be
replaced under the current backend — the portal PaymentPage submit button is also
disabled until status is Pending and payment is Unpaid. The Dashboard action "Your
payment proof needs to be replaced." still links to that page, but the form cannot
be submitted from there.

### Guest booking versus portal booking

Guests book through the public pages (`/booking-information`,
`/book/room/:roomId`, or `/rooms-and-venues-details?venueId=...`);
`POST /api/reservations` creates an unregistered customer row, returns a
24-hour reservation `access_token`, and the public
`/payment/:reservationId` page uses that token with `reservationAccess` to view and
pay without logging in. An email that already belongs to a registered account is
refused with 409 ("Please log in to book."). A logged-in customer books through
the portal (`/portal/book` for rooms or `/portal/venues/:id` followed by
`/portal/book/venue/:venueId`) or the public pages. With a session the
reservation attaches to the account's `customer_id` and appears in
`GET /api/customer/reservations`.

The portal venue detail page shows venue information, inclusions, reviews, and
the shared single-date availability calendar. Its `Plan your event` action
navigates to `/portal/book/venue/:venueId` for guest details and reservation
submission. The booking-details page places Conference Hall package cards
above the event fields; each card shows its description and normalized
inclusions. Conference Hall start times are selected by the hour within the
venue's configured start/end window, while day-use cottages retain their fixed
08:00 start. Venue dates are returned as `YYYY-MM-DD` to avoid timezone
shifts; room booking continues to use check-in/check-out dates. Logged-in
venue selection does not validate package or pax at the hold stage: the
portal creates the date hold first, and package-specific pax limits are only
checked when the customer picks a package and requests a quote or finalizes the
booking. The actual limits come from each package's `venue_packages.min_pax` /
`max_pax` values, with the Free Venue (Per Person) package keeping its 100-pax
minimum and other packages using their own configured package ranges.

Portal room and venue detail pages load up to six newest completed-reservation
reviews for the numeric route resource id through
`getResourceReviews({ roomId, venueId, limit })`. Their `Loved by recent guests`
sections show loading, inline errors, the existing `No guest reviews yet`
empty state, and compact review cards.

`GET /api/reviews` returns display-safe review fields plus `resource_name` and
`resource_type` and accepts optional `limit` (valid integers 1-50),
`random=1`, `room_id`, and `venue_id` parameters. Resource filters use the
reservation's room or venue foreign key, and only reviews for completed
reservations are returned. Random responses are not cached.

Room and venue list/detail endpoints also return `average_rating` (rounded to
one decimal, or `null`) and `review_count` (zero when none). `roomsApi.js` and
`venuesApi.js` normalize these to `rating` and `reviewCount`. The shared
`src/shared/StarRating.jsx` component renders the aggregate in portal and
public cards/details; zero-review resources show empty stars and `No reviews
yet`, while reviewed resources show the one-decimal average and count.

Portal room and venue detail calendars compute their initial displayed month
from the current date in `Asia/Manila`, or from an already selected booking
date. They request the displayed month from
`GET /api/rooms/:roomId/booked-dates?year=YYYY&month=M` or
`GET /api/venues/:venueId/booked-dates?year=YYYY&month=M`; JavaScript months
are zero-based internally and API months are 1-based. Previous-month navigation
is disabled at the current month, while next-month navigation remains enabled.
Past and booked dates are disabled as check-in dates. In room range mode, the
calendar merges booked dates across the displayed and following month after
check-in is selected. The first booked date after check-in is selectable as a
checkout-only date, while later dates that would include a booked night are
disabled.
Today is disabled as well, so the earliest selectable date is tomorrow in
Asia/Manila. Admin walk-in bookings are exempt from this customer rule.

Calendar selections are controlled by the parent booking state rather than
duplicated inside the calendar. Room clicks select check-in then check-out,
restart the range when a date precedes check-in, and clear an invalid
check-out. A room checkout date may be a booked date when the booked date is
the checkout boundary and no booked night lies in the half-open range
`[check_in, check_out)`. Venue calendar clicks update the event-date input and trigger the
existing availability, start-time, and server-quote effects. Typed dates move
the calendar to their month; booked typed dates are rejected with an inline
message. Dates remain local `YYYY-MM-DD` strings and are not converted with
`toISOString()`.

`backend/database/schema.sql` is the source of truth for fresh database
installations. Files in `backend/migrations/` are the upgrade path for existing
databases and are not run automatically during startup.

## Recent changes (October 14, 2026)

- October 15, 2026: Added the Asia/Manila next-day minimum to portal
  calendars, typed dates, holds, quotes, and reservations. The configurable
  `MIN_BOOKING_LEAD_DAYS` constant is `1`; admin walk-ins remain exempt.

- October 15, 2026: Portal payment now redirects reservations whose proof has
  already been submitted away from the payment form and prevents hold release
  cleanup from running for non-payment-pending reservations.

- October 14, 2026: Added a deterministic reservation-intent guard before the
  customer chatbot model call and an output filter after it. The chatbot never
  creates, holds, modifies, cancels, pays for, confirms, or collects personal
  details for a reservation; it directs customers to `/portal/browse` (or
  guests to `/rooms-and-venues`) and can still compare options and check
  availability or quotes. Booking FAQ content is seeded idempotently, and the
  shared portal/landing renderer safely handles basic markdown without
  `dangerouslySetInnerHTML`. Guard replies do not call the model or consume LLM
  quota. Changed files: `backend/controllers/chatbotController.js`,
  `backend/database/schema.sql`,
  `backend/migrations/20261014_add_chatbot_booking_faq.sql`,
  `src/shared/chatbot/ChatbotMessageContent.jsx`, and
  `src/shared/chatbot/ChatbotPanel.jsx`.

- October 13, 2026: Documented portal-scoped password login, generic
  cross-portal failures, portal-aware session checks, and blocked staff-email
  Google sign-in.
- October 13, 2026: Added completed-reservation rating aggregates and shared
  star-rating display for portal and public room and venue surfaces.

- October 13, 2026: Added resource-aware reviews to portal room and venue
  details, including the shared `reviewsApi.js` resource function and extended
  `GET /api/reviews` filters; the landing page now samples up to three random
  reviews with booked resource names.

- October 8, 2026: Added shared public policy pages and wired their footer,
  registration, booking, and payment links without changing reservation or
  payment payloads.

- October 9, 2026: Removed the portal venue selection/package cards from the
  venue detail page and fixed `Plan your event` to open the portal booking
  details page.
- October 9, 2026: Updated portal venue booking details with selectable
  Conference Hall package cards showing descriptions and inclusions, and
  restricted Conference Hall start times to hourly options.

- October 8, 2026: Fixed room reservation payloads so room bookings omit
  venue-only fields, while the backend normalizes absent or null room
  `extra_hours` to zero without weakening venue validation.
- October 8, 2026: Split portal venue booking into a selection page with the
  shared single-date availability calendar and package details, followed by
  `/portal/book/venue/:venueId` for profile-prefilled guest details, a fresh
  server quote, and reservation submission. A 409 returns to venue selection.
- October 8, 2026: Portal payment now displays the selected payment method's
  `qr_image_url`, account details, open/save action, image fallback, and the
  server-provided deposit due.

- October 8, 2026: Customer portal reservation detail now shows the real resort
  address and the server-generated check-in QR (same as the accepted-payment
  email). The address comes from `GET /api/resort-info`. Customer reservation responses include
  `checkin_qr` only for owned `confirmed` reservations; it remains null for
  every other status.
- October 8, 2026: Rebuilt the route table from `CustomerRoutes.jsx`, adding the public routes it mounts and clarifying that only `/portal/*` renders behind `RequireCustomer`.
- October 8, 2026: Documented the auth flow end to end: the load-time `GET /api/auth/me` check, the staff-session message, login return to the saved location or `/portal`, logout to `/`, and the `/portal`-only 401 redirect; all four auth calls pass `handle401: false`.
- October 8, 2026: Added a per-module table for every file in `src/customer/api/`; `chatbotApi.js` is wired to both customer chatbot UIs with persistent history.
- October 8, 2026: Recorded the backend routes and auth rules behind the portal (customer routes, public reviews, chatbot, booked dates, reservation access token, rate limits).
- October 8, 2026: Added the exact reservation and payment status label mappings, noting that reservation `pending_verification` displays as "Payment Verified" while the payment shows "Proof Submitted".
- October 8, 2026: Corrected the rejected-proof statement — the backend only accepts proof while status is `payment_pending`, so rejected proofs cannot be replaced by the customer.
- October 8, 2026: Listed the current booking-final notice locations, confirmed the portal has no cancel controls, and documented guest-versus-portal booking with the access token.
- October 8, 2026: Removed stale mock-fixture wording (`data/` is now unreferenced) and flagged that `profileApi.js` calls `request` without importing it.
- October 8, 2026: Documented Phase 1 venue rules, packages, snapshots, server-side pricing, conflict handling, the idempotent manual migration, and removal of the old Test Sunset Pavilion startup seed.
- October 8, 2026: Documented the shared venue form, public and portal venue routes, venue reservation display fields, defensive date/time formatting, and authentication/session fixes.
- October 8, 2026: Added the public room-style venue selection card and
  server-verified `/book/venue/:venueId` contact-details step; portal venue
  booking remains on the shared portal form.
- October 8, 2026: Updated portal room and venue calendars to use the current
  Asia/Manila month, reload booked dates on month navigation, disable past and
  booked dates, and synchronize calendar selections with booking date fields.

## Recent changes (October 14, 2026)

- October 14, 2026: Portal reservation list/detail and token-mode reservation
  responses now add the linked room or venue `images` and primary `image`
  values without removing existing fields. The portal shares the public image
  parser and API-base URL resolver for arrays, JSON-encoded arrays, single
  paths, and relative upload paths. Dashboard reservations, reservation rows
  and details, pending reviews, and browse cards use `ProgressiveImage` with
  resource-specific teal fallbacks; failed or missing photos fill the complete
  aspect area.
- October 14, 2026: Shared the portal chatbot panel with the landing page. Signed-out visitors use a session-only guest transcript and restricted public endpoint; authenticated customers continue using full server-backed history and reservation tools. Guest rate limits and the separate daily cap are documented above.
- October 14, 2026: The chatbot now uses one OpenAI-compatible client for OpenRouter or Groq. Set `LLM_PROVIDER=groq`, `GROQ_API_KEY`, and ordered `GROQ_MODELS` to use Groq, or leave the provider unset for the OpenRouter default. `LLM_FALLBACK_PROVIDER=openrouter` is optional. Prompt facts are compacted to relevant FAQ/knowledge matches, tool payloads omit long descriptions, and authenticated history is capped at the last eight messages to fit Groq's free-tier token limits. The backend logs provider/model/key-set status without printing secrets.
- October 14, 2026: Removed the unused legacy `chatbot_kb` table from fresh
  schema creation. Apply the manual destructive migration with
  `mysql -u root -p kairos_db < backend/migrations/20261014_drop_chatbot_kb.sql`;
  customer chatbot content and history remain in the managed chatbot tables.
- October 14, 2026: Fixed the logged-in portal venue flow so the initial hold only captures the venue/date (with the fixed day-use window) and no package or pax validation runs until a package is chosen. The booking details page now waits for a valid package and pax before fetching a server quote, keeps pax errors inline, and uses each package's real `min_pax`/`max_pax` limits while preserving the server-side quote and final validation.

## Known gaps

- Legal review is pending for the public policy text. Privacy retention is a
  TODO because the application does not define a retention period.
- Policy-page route, anchor, and phone-width behavior still need a live browser
  verification pass.

- Chatbot answers now use live resort, room, venue/package, payment-method, review, availability, quote, customer-owned reservation data, and active admin-managed FAQs/knowledge. FAQ matches can be answered directly; unsupported questions are logged as unanswered for admin review. OpenRouter is server-only; no API key or customer contact details are sent to the browser/model.
- The portal widget UI is shared from `src/shared/chatbot/ChatbotPanel.jsx` with the public landing page. Customers retain the full assistant, server-backed history, reservation tools, and the existing `/api/chatbot/message` authorization rules. The public `/api/chatbot/guest-message` endpoint has no reservation tools or customer persistence; it accepts at most 500 characters and eight context messages.
- Chatbot history is stored in `Chatbot_Conversations` and `Chatbot_Messages` and is deleted with the owning customer. Apply the manual migration with `mysql -u root -p kairos_db < backend/migrations/20261008_add_chatbot_history.sql`.
- October 8, 2026: Apply `mysql -u root -p kairos_db < backend/migrations/20261008_add_chatbot_management.sql` to add admin-managed FAQs, knowledge topics, unanswered-question tracking, and message answer metadata. Logging failures do not block a customer reply.
- Bookings remain final: the chatbot offers no cancellation, refund, rebooking, rescheduling, date-change, or reservation mutation controls. It links customers to the room/venue booking pages.
- Configure `LLM_PROVIDER` (`openrouter` by default), optional `LLM_FALLBACK_PROVIDER`, and for Groq `GROQ_API_KEY`, ordered `GROQ_MODELS`, and optional `GROQ_BASE_URL` (default `https://api.groq.com/openai/v1`). Existing `OPENROUTER_API_KEY`, ordered `OPENROUTER_MODELS` (or legacy `OPENROUTER_MODEL`), `OPENROUTER_BASE_URL`, and `OPENROUTER_SITE_URL` remain supported. `CHATBOT_MAX_TOKENS`, `CHATBOT_TIMEOUT_MS`, `CHATBOT_MODEL_COOLDOWN_MS`, and `CHATBOT_DAILY_MESSAGE_CAP` apply to either provider. The server tries at most three eligible models across the configured provider chain, keeps cooldown state separate by provider, and keeps one selected model for a tool loop.
- Guest traffic is separately limited by `CHATBOT_GUEST_RATE_LIMIT_PER_MINUTE` (default 8), `CHATBOT_GUEST_RATE_LIMIT_PER_DAY` (default 40), and `CHATBOT_GUEST_DAILY_CAP` (default 300). Guests never consume the authenticated customer daily cap.

- Guest cottage selection, contact details, and payment navigation were
  clicked through in the browser; the Conference Hall selection and quote were
  also checked. The logged-in portal venue routes loaded successfully, but a
  final logged-in reservation submission was not completed in the last browser
  session. The Vite-proxied API flow and production build passed.
- The authenticated calendar click-through could not be completed in the
  latest browser session because opening `/portal/rooms/:id` redirected to
  `/login`; production build and editor diagnostics passed.

## Portal booking holds

- Logged-in room and venue booking flows create a `payment_pending` hold before the information form. The session customer owns the hold and no placeholder Customer is created.
- Package and pax are not validated or required when the portal creates the initial hold from the venue selection page; the hold is only for date availability and the fixed 08:00–17:00 cottage window. The information step later confirms the package and guest count, and the server then validates the selected package's `min_pax`/`max_pax` values.
- Venue holds may start with a provisional total. The information step updates the same hold while the backend recomputes package, slot, capacity, and pricing values. Pax limits come from the selected package in `venue_packages`, with the Free Venue (Per Person) package keeping its 100-pax minimum; flat packages use their own configured package ranges and the venue capacity remains the upper bound.
- Hold state remains in `sessionStorage`; release and availability behavior are shared with the public booking flow.
- Portal room check-in and venue event dates must be tomorrow or later in
  Asia/Manila. A hold stored in `sessionStorage` becomes invalid after
  midnight if its date is now before the minimum; it is released and the
  customer returns to date selection.
- Venue reservation rules remain server-authoritative for Small Cottage, Big
  Cottage, and Conference Hall; quote and hold endpoints return `400` for
  today or earlier with the earliest available date.

## Recent changes

## Email verification authentication

- Customer registration uses `POST /api/auth/register`, which creates an
  unverified registered customer and returns `verification_required` plus the
  normalized email. The account cannot log in until
  `POST /api/auth/register/verify` receives the emailed six-digit code.
  `POST /api/auth/register/resend-code` resends without revealing whether an
  email is eligible and enforces a 60-second cooldown.
- Customer login still requires `portal: "customer"` and keeps cross-portal
  failures generic. With `LOGIN_CODE_ENABLED` (default `true`), a correct
  password returns a short-lived challenge and masked email from
  `POST /api/auth/login`; `POST /api/auth/login/verify` creates the cookie,
  while `POST /api/auth/login/resend-code` resends the challenge code. Staff
  login is unchanged, and Google sign-in skips this code.
- `CustomerAuthContext` exposes `verifyRegistration`, `resendRegistrationCode`,
  `verifyLogin`, and `resendLoginCode`; `authApi.js` owns the corresponding
  calls with `credentials: "include"` and `handle401: false`. The shared
  `VerificationCodeForm` handles numeric input, paste, auto-submit, errors,
  the 60-second resend countdown, masked email, and back navigation.
- Verification state is stored in `Auth_Verification_Codes`; registered
  customers are backfilled as verified by the idempotent
  `backend/migrations/20261015_add_auth_verification.sql`, applied with
  `mysql -u root -p kairos_db < backend/migrations/20261015_add_auth_verification.sql`.
  Guest booking rows remain unregistered and are not changed by this flow.

- October 14, 2026: Browse room and venue cards now use compact horizontal layouts on
  mobile with lazy-loaded thumbnails, while desktop restores the vertical card layout.
  Dashboard statistics now use a compact 2x2 mobile grid, and the chatbot button plus
  main content spacing leave mobile card actions clear of the floating control.
- October 15, 2026: Added customer registration and customer-portal login
  email verification codes, the shared code-entry form, the verification
  endpoints, the `email_verified_at` rule, and the auth verification migration.
  Reservation rows and pending-review cards now constrain mobile thumbnails to 80px
  and keep metadata and actions in a non-overlapping compact column.
  Reservation and review cards now share the recommended-card shell, thumbnail, type
  scale, and action styling on mobile.
