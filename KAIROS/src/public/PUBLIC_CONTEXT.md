# Landing Page Context

## Scope

This document describes the public KAIROS landing page implemented in `src/public/`.
The admin area is intentionally out of scope.

## Folder Structure

```text
src/public/
├── PUBLIC_CONTEXT.md
├── components/
│   ├── Header.jsx
│   ├── Footer.jsx
│   ├── HeroSection.jsx
│   ├── AvailabilityCalendar.jsx
│   ├── RoomsAndVenuesSection.jsx
│   ├── ResortAmenities.jsx
│   └── Reviews.jsx
├── layouts/
│   └── PublicLayout.jsx
├── context/
│   └── ResortInfoContext.jsx
├── pages/
│   ├── LandingPage.jsx
│   ├── RoomsAndVenuesPage.jsx
│   ├── RoomsAndVenuesDetailsPage.jsx
│   ├── BookingInformationPage.jsx
│   ├── PaymentDetailsPage.jsx
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
├── routes/
│   └── PublicRoutes.jsx
└── utils/
    └── parseImages.js
```

## Entry point and page composition

`App.jsx` mounts two route trees: `AdminRoutes` for `/admin/*` and
`CustomerRoutes` (`src/customer/routes/CustomerRoutes.jsx`) for everything else.
`CustomerRoutes` owns the public route table documented below; the older
`src/public/routes/PublicRoutes.jsx` file still exists but is no longer mounted
and must not be treated as the source of truth.

The root route `/` renders `LandingPage`, composed of:

1. `Header`
2. `HeroSection`
3. `AvailabilityCalendar` in general mode
4. `RoomsAndVenuesSection`
5. `ResortAmenities`
6. `Reviews`
7. `Footer`

Unmatched paths redirect to `/` via a catch-all `<Route path="*">`.

The tree is wrapped by `BrowserRouter`, `ResortInfoProvider`,
`CustomerAuthProvider`, and `BookingProvider`. The resort info provider loads
resort branding and contact information from `GET /api/resort-info`, and falls
back to empty-string defaults (no fake branding) if the request is unavailable.

## Header

File: `src/public/components/Header.jsx`

- Fixed white header, 64px high, above page content (`z-50`).
- Left side: resort logo and dynamic resort name.
- Primary links:
  - `Home` -> `/`
  - `Rooms & Venues` -> `/rooms-and-venues`
  - `Amenities` -> `/#amenities`
  - `Contact` -> `/#contact`
- Right side (desktop) and the mobile menu grid, driven by
  `useCustomerAuth`:
  - Signed out: `Login` -> `/login`, `Register` -> `/register`.
  - Signed in as a customer: `My Portal` -> `/portal` and `Logout`.
- Uses the logo at `assets/images/logo/transparent-kaiazul.png`.
- The header remains fixed at 64px and collapses below `md` into a hamburger
  menu containing the same links. The menu closes after a link is selected.
- Navigation controls use mobile-friendly tap targets, focus rings, hover
  states, and a truncated resort name when space is limited.

## Hero and availability search

File: `src/public/components/HeroSection.jsx`

- Starts below the fixed header with 16px top padding.
- Uses `assets/images/background/image.png` as a full-width background.
- Displays:
  - “Welcome to Paradise”
  - Dynamic resort name
  - “Where the ocean meets luxury — unforgettable stays await”
- Includes a floating white search card overlapping the bottom of the hero.
- The hero ends with the background image and introductory copy; availability
  selection is handled in the calendar section below.
- Check-in and check-out are selected in the calendar below, not in the hero form.
- The hero uses responsive heading sizes, a dark gradient overlay for contrast,
  and a vertically stacked full-width search control on small screens.

## Availability calendar

File: `src/public/components/AvailabilityCalendar.jsx`

- Rendered in general mode on the landing page.
- The selected range is controlled by `LandingPage` with `checkIn` and
  `checkOut` state.
- Past dates and booked dates are disabled.
- Users select a check-in date first, then a later check-out date.
- Selecting a date before the current check-in restarts the selection.
- Month navigation is available with `Prev` and `Next`.
- When both dates are selected, `LandingPage` shows a `Search Availability`
  button.
- The button navigates to:

  ```text
  /rooms-and-venues?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N
  ```

- When a `roomId` is supplied on other pages, booked dates are loaded from
  `GET /api/rooms/:roomId/booked-dates?year=YYYY&month=M`. The general landing
  page calendar has no room-specific booking query.
- Calendar cells and controls resize for narrow phones without page overflow.
  The landing Search Availability action is full-width on small screens.
- The landing calendar fetches resort-wide booked dates from
  `GET /api/availability/booked-dates?year=YYYY&month=M` and renders those
  dates as red, disabled calendar cells only when every available room is
  reserved for that date. Dates with partial occupancy remain selectable.

## Rooms and venues

File: `src/public/components/RoomsAndVenuesSection.jsx`

- Section anchor: `#rooms-and-venues`.
- Loads rooms and venues in parallel:
  - `GET /api/rooms`
  - `GET /api/venues`
- Only records with `status === "available"` are displayed.
- The landing page displays up to two rooms and two venues.
- Cards show the name, guest capacity, room price when applicable, type tag,
  availability status, image, and a `View Details` action.
- Images may be arrays or JSON-encoded arrays.
- `More About Rooms` links to `/rooms-and-venues-details`.
- Individual cards link to `/rooms-and-venues-details` with either
  `roomId` or `venueId` as a query parameter.
- Loading and API errors are shown inline instead of being silently hidden.
- Room and venue cards share stretched flex-column layouts, consistent
  `aspect-[4/3]` image areas, reserved price-row space, equal-height tag rows,
  truncated names, and bottom-aligned actions.
- On phones, rooms and venues render as separate horizontal scroll-snap rows
  with a partial next-card preview. At `md` and above they return to equal-height
  grids. Images are lazy-loaded and loading states use matching skeleton cards.

## Resort amenities

File: `src/public/components/ResortAmenities.jsx`

- Section anchor: `#amenities`.
- Heading: `Resort Amenities`.
- Subtitle: `Everything you need for the perfect resort experience`.
- Current amenity cards:
  - Restaurant & Bar
  - Piso WiFi
  - Parking
  - Recreational Activities
  - KTV Room
- Cards use inline SVG icons, a light blue icon container, and a responsive
  one-to-five-column grid.
- On phones, amenity cards use a horizontal snap row with hidden scrollbars
  and touch-friendly scrolling. Larger breakpoints use a grid with compact
  mobile spacing and typography.

## Guest reviews

File: `src/public/components/Reviews.jsx`

- Heading: `What Our Guests Say`.
- Subtitle: `Hear from our valued guests`.
- Real completed-stay reviews from `GET /api/reviews` are displayed in responsive cards.
- Each card contains a star row, quotation, and guest name.
- The section is hidden when the public review response is empty or unavailable.
- Reviews use a horizontal snap row below `lg`, then a three-column grid on
  large screens. Mobile cards remain readable without causing page overflow.

## Availability date display

- Room detail availability calendars fetch the selected room's real booked
  dates from `GET /api/rooms/:roomId/booked-dates?year=YYYY&month=M` whenever
  the displayed month changes.
- Booked dates are rendered as red disabled dates and are excluded from range
  selection. The calendar opens to the current month rather than a static
  sample month.

## Footer and contact

File: `src/public/components/Footer.jsx`

- Section anchor: `#contact`.
- Uses dynamic resort name, address, phone number, and email from
  `ResortInfoContext`.
- Contact links use `tel:` and `mailto:`.
- Footer columns:
  - Resort contact details
  - Quick Links: Home, Rooms, Venues, Amenities
  - Reservations: Book a Room, Book a Venue, Check Availability, Contact Us
  - Policies: Terms & Conditions, Privacy Policy,
    Payment Policy
- The reservation and policy list items currently use placeholder `#` links.
- Footer copyright currently displays `© 2025 {resortName} — KAIROS Integrated
  Reservation System`.
- The footer uses compact spacing, a two-column mobile layout with contact
  details spanning both columns, and four columns at `lg`. Phone and email
  links retain adequate tap areas.

## Visual and implementation conventions

- Styling is primarily Tailwind CSS utility classes.
- Global styles are imported from `style.css`, which loads DM Sans, Lora, Lato,
  Montserrat, and Aboreto from Google Fonts and then imports Tailwind.
- The visual system uses:
  - Sky/cyan blue for primary actions and highlights
  - Slate backgrounds and text for content sections
  - Rounded cards, borders, and light shadows
  - Lora for prominent headings and resort branding
  - DM Sans for controls and supporting copy
- Public API URLs are built from `src/config/api.js` and the optional
  `VITE_API_URL` environment variable (trailing slashes are stripped).
- The Vite dev server proxies `/api` requests to `http://localhost:5000`
  (`vite.config.js`); the optional `VITE_ALLOWED_HOSTS` variable (comma
  separated) extends the dev server's allowed hosts.
- Public responsive styling uses Tailwind utilities only. Horizontal scrolling
  is intentionally limited to card rows, not the page viewport.
- Anchored sections use `scroll-mt-20` so the fixed header does not cover
  `#availability-calendar`, `#rooms-and-venues`, `#amenities`, or `#contact`.

## Related public routes

The route table lives in `src/customer/routes/CustomerRoutes.jsx`
(`src/public/routes/PublicRoutes.jsx` is unmounted legacy code):

- `/`: landing page; unmatched paths redirect here via `<Route path="*">`
- `/rooms-and-venues`: availability/results page (inside `PublicLayout`)
- `/rooms-and-venues-details`: room and venue details (inside `PublicLayout`)
- `/booking-information`
- `/book/room/:roomId`
- `/payment/:reservationId`
- `/login`
- `/register`
- `/portal/*`: customer portal, guarded by `RequireCustomer`; signed-out
  visitors are redirected to `/login`

Only the two rooms-and-venues routes are wrapped in `PublicLayout` (fixed
`Header` plus `Outlet`, no footer). The booking, payment, login, and
registration pages render standalone without the shared header.

When changing the landing page, keep the section anchors, query parameter names,
and existing navigation destinations stable unless the corresponding consumers
are updated together.

## Public pages connected to the landing page

The files in `src/public/pages/` extend the landing page into the public browsing
and reservation flow. They are mounted by `src/customer/routes/CustomerRoutes.jsx`:
the room/venue pages render inside `PublicLayout` (fixed `Header`), while the
booking, payment, login, and registration pages use standalone layouts.

### Authentication forms and input validation

Files: `src/public/pages/LoginPage.jsx` and
`src/public/pages/RegisterPage.jsx`

- Login and registration use the transparent resort logo at
  `assets/images/logo/transparent-kaiazul.png` in their standalone headers.
- Text fields use native required, length, pattern, and type constraints.
  Names accept letters, spaces, apostrophes, and hyphens; email fields use
  email validation; passwords require 8 to 128 characters.
- Registration and booking phone fields accept digits only and are capped at
  11 digits. Numeric guest fields are also limited to 11 digits.
- Inputs include appropriate `autocomplete` and `inputMode` hints while
  preserving the existing API payloads and form state behavior.

### Rooms and venues results

File: `src/public/pages/RoomsAndVenuesPage.jsx`

- Route: `/rooms-and-venues`.
- Receives the landing page query parameters `checkIn`, `checkOut`, and
  `guests`.
- Without a date range, loads the room catalog from `GET /api/rooms` and
  venues from `GET /api/venues`.
- With a date range, requests available rooms from
  `GET /api/rooms/availability?check_in=...&check_out=...&capacity=...`.
- Normalizes database field names such as `room_id`, `room_type`,
  `price_per_night`, `venue_id`, and `venue_name` for display.
- Provides filters for dates, room type, capacity, and availability, plus
  free-text search and sorting by default, price, or capacity.
- Displays room and venue cards with images, capacity, amenities, pricing, and
  availability state.
- Card actions navigate to
  `/rooms-and-venues-details?roomId=...` or
  `/rooms-and-venues-details?venueId=...`.
- API loading and error states are displayed in the page.

### Room or venue details

File: `src/public/pages/RoomsAndVenuesDetailsPage.jsx`

- Route: `/rooms-and-venues-details`.
- Reads either `roomId` or `venueId` from the query string.
- Loads the selected record from `GET /api/rooms/:roomId` or
  `GET /api/venues/:venueId`.
- Shows an image/gallery area, name, type, capacity, description, amenities,
  and availability information.
- Room details include a compact availability calendar, nightly pricing,
  check-in/check-out fields, guest count, service fee, VAT, and a total.
- Venue details show venue information but do not expose the room reservation
  form.
- Reserving a room navigates to:

  ```text
  /book/room/:roomId?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&guests=N
  ```

### Booking information

File: `src/public/pages/BookingInformationPage.jsx`

- Routes: `/booking-information` and `/book/room/:roomId`.
- Loads the selected room from `GET /api/rooms/:roomId`.
- Reads optional `check_in`, `check_out`, and `guests` query parameters.
- Collects customer information (first name, last name, email, phone, and
  address) and booking details.
- Calculates the number of nights and the reservation total from the room’s
  nightly price.
- Displays a 50% deposit and 50% pay-on-arrival breakdown.
- Submits a reservation to `POST /api/reservations` with `credentials: 'include'`
  so an optional signed-in session rides along with the guest form.
- `POST /api/reservations` is rate limited to 10 requests per hour per IP
  (`429` beyond that).
- If the email already belongs to a registered account the backend answers
  `409` ("An account with this email already exists. Please log in to book.")
  and the message is shown inline.
- On success the response includes a 24-hour reservation access token
  (`access_token`). The page stores it in `sessionStorage` under
  `reservation_token_<reservationId>` only after a successful response, then
  navigates to `/payment/:reservationId` with the full response in router
  state.
- The booking summary notes that the 50% deposit is non-refundable.
- The page is explicitly designed to allow booking without an account.

### Payment details

File: `src/public/pages/PaymentDetailsPage.jsx`

- Route: `/payment/:reservationId`.
- Loads reservation details and available payment methods in parallel:
  - `GET /api/reservations/:reservationId`
  - `GET /api/payment-methods`
- The reservation request sends `credentials: 'include'` and, when available,
  an `X-Reservation-Token` header (router state first, then the
  `sessionStorage` key written by the booking page).
- Displays a countdown based on the reservation hold expiry.
- Lets the guest choose a payment method and view its QR/account
  instructions.
- Accepts PNG, JPEG, and WebP proof-of-payment uploads (the backend enforces
  the same types and a 5 MB limit: "Image must be 5 MB or smaller.").
- Submits payment proof as multipart form data to
  `POST /api/reservations/:reservationId/payment` with the same
  `credentials: 'include'` + `X-Reservation-Token` combination. The body is
  sent without an explicit `Content-Type` header so the browser sets the
  multipart boundary.
- The payment upload endpoint is rate limited to 5 requests per minute per IP.
- Expired holds and API errors are shown explicitly.
- Successful submission displays the booking reference and explains that the
  proof is pending verification.

### Guest reservation access (reservation tokens)

Files: `backend/utils/reservationToken.js`, `backend/middleware/reservationAccess.js`,
`backend/routes/publicReservationRoutes.js`,
`backend/controllers/publicReservationController.js`

- Guests who book without an account receive a dedicated reservation access
  JWT (`access_token`) from `POST /api/reservations`. It expires after 24
  hours and carries `purpose: 'reservation_access'` plus the `reservation_id`.
- The token is signed with a secret derived from the login JWT secret
  (`<JWT secret>:reservation_access`), so a reservation token can never verify
  as a login token or vice versa.
- `GET /api/reservations/:id` and `POST /api/reservations/:id/payment` run
  `optionalAuth` + `reservationAccess` instead of `requireAuth`/`requireRole`,
  so staff sessions, the owning customer's session, and guests holding a token
  can all read a reservation and upload payment proof:
  - `400`: malformed reservation id.
  - `401`: no session and no `X-Reservation-Token` header.
  - `403`: invalid, expired, or id-mismatched token, or a customer session for
    a reservation it does not own.
  - `404`: returned only after access is granted (staff, owner, or valid
    token) but the reservation does not exist, so ids cannot be probed
    without credentials.
  - On success `req.accessMode` is `staff`, `customer`, or `token`.
- Controllers look the reservation up by id only (the middleware already
  authorized the request) and record the status-history actor from
  `req.accessMode`; token mode records the reservation's own `customer_id`.
- Token-mode responses use the same `{ reservation, room, venue }` shape as
  session-mode responses so the payment page works either way; only customer
  contact fields are omitted for token holders.
- `X-Reservation-Token` is permitted by the CORS preflight
  (`Access-Control-Allow-Headers` in `backend/server.js`).

### Authentication entry points

Files: `pages/LoginPage.jsx` and `pages/RegisterPage.jsx`

- The pages are presentational; `CustomerRoutes` injects the auth callbacks:
  `onSignIn` -> `CustomerAuthContext.login` and `onRegister` ->
  `CustomerAuthContext.register`, which call `POST /api/auth/login` and
  `POST /api/auth/register` with cookies enabled.
- After a successful login the page navigates to the saved
  `location.state.from` destination when present; otherwise customers go to
  `/portal` and non-customers go to `/admin`.
- Staff accounts cannot use the customer portal: `login` rejects non-customer
  roles with the inline message "You're signed in with a staff account. Log
  out first to use the customer portal." The same message is pre-filled as
  `initialError` when an existing session (`GET /api/auth/me`) belongs to a
  staff user.
- `/register` validates password confirmation, terms acceptance, and a minimum
  eight-character password before calling `onRegister`.
- Successful registration navigates to `/login`.
- Both pages render standalone centered forms and expose submission errors
  inline.
- Registration collects first name, last name, email, phone, date of birth,
  password, confirmation, and terms acceptance.

## Recent changes (October 8, 2026)

- Added dedicated reservation access tokens in
  `backend/utils/reservationToken.js` (derived secret, `purpose:
  'reservation_access'`, 24-hour expiry); `POST /api/reservations` now returns
  one as `access_token` for guest bookings.
- Replaced `requireAuth`/`requireRole` on `GET /api/reservations/:id` and
  `POST /api/reservations/:id/payment` with `optionalAuth` +
  `reservationAccess`, so staff, the owning customer, and token-holding guests
  can all access a reservation (`400`/`401`/`403`/`404` semantics documented
  above).
- Ownership checks in `getReservation`/`submitPaymentProof` now key off the
  reservation id resolved by the middleware instead of `req.user`, status
  history records the actor from `req.accessMode`, and token-mode responses
  mirror the session-mode `{ reservation, room, venue }` shape (minus customer
  contact fields).
- The booking page sends `credentials: 'include'`, stores the token in
  `sessionStorage` (`reservation_token_<reservationId>`) only after a
  successful response, and the payment page sends it back as
  `X-Reservation-Token` on both the detail fetch and the proof upload.
- `X-Reservation-Token` was added to the allowed CORS request headers in
  `backend/server.js`.
- `PUBLIC_CONTEXT.md` now documents the real routing entry point
  (`CustomerRoutes`, not the unmounted `PublicRoutes`), the header's
  authenticated state, guest booking/payment rate limits, and the Vite dev
  proxy.
