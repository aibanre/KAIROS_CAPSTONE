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
│   ├── Reveal.jsx
│   ├── Footer.jsx
│   ├── HeroSection.jsx
│   ├── AvailabilityCalendar.jsx
│   ├── RoomsAndVenuesSection.jsx
│   ├── ResortAmenities.jsx
│   ├── AmenityModal.jsx
│   ├── Reviews.jsx
│   └── LocationSection.jsx
├── data/
│   └── amenities.js
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

Shared public-facing primitives also include `src/shared/ProgressiveImage.jsx`,
which is reused by the landing page image surfaces.
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
7. `LocationSection`
8. `Footer`
9. `ChatbotPanel` (shared customer/public widget; guest mode on the landing page)

The landing page widget keeps guest messages in `sessionStorage` only and sends
at most eight trimmed messages to the public guest endpoint. Guests can ask
about public resort information and are directed to `/login` for reservation
questions. Authenticated customers see the full assistant, server-backed
history, and conversational booking assistance. The chatbot asks for missing
booking details, presents a verified proposal, and creates a hold only after
the customer explicitly confirms in chat or selects the confirmation action.

`LocationSection` is the landing page's `#location` anchor. It defaults to a
lazy Street View embed and provides a keyboard-accessible Street View / Map
toggle. It reads `VITE_RESORT_LAT`, `VITE_RESORT_LNG`, `VITE_RESORT_HEADING`,
`VITE_RESORT_PITCH`, `VITE_RESORT_FOV`, and
`VITE_GOOGLE_MAPS_EMBED_KEY`. With coordinates and a key it uses the official
Google embed; coordinates without a key use the unofficial keyless Street View
embed, which may stop working. Without coordinates it uses an address-based
map embed. The Directions action opens Google Maps at
`https://www.google.com/maps/dir/?api=1&destination=...`.

Unmatched paths redirect to `/` via a catch-all `<Route path="*">`.

The tree is wrapped by `BrowserRouter`, `ResortInfoProvider`,
`CustomerAuthProvider`, and `BookingProvider`. The resort info provider loads
resort branding and contact information from `GET /api/resort-info`, and falls
back to empty-string defaults (no fake branding) if the request is unavailable.
Customer portal reservation details use the same provider for the resort name and
address; an empty value hides the location line instead of using a fallback.

## Header

File: `src/public/components/Header.jsx`

- Fixed white header, 64px high, above page content (`z-50`).
- Left side: resort logo and dynamic resort name.
- Primary links:
  - `Home` -> `/`
  - `Rooms & Venues` -> `/rooms-and-venues`
  - `Amenities` -> `/#amenities`
  - `Contact` -> `/#location` (the landing page location section contains
    resort contact details)
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
- Uses `assets/images/background/image.png` as a full-width priority
  `ProgressiveImage` over a slate base color and contrast gradient.
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
- Past dates and booked nights are disabled for room ranges; the first booked
  date after a selected check-in is selectable as a checkout-only date.
- Today is also disabled: new room and venue reservations start tomorrow in
  Asia/Manila. The backend config constant `MIN_BOOKING_LEAD_DAYS` controls
  this one-day lead time.
- Users select a check-in date first, then a later check-out date. Every night
  in the half-open range `[check_in, check_out)` must be available.
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
  The legend says `Fully booked`; past dates always use the disabled grey
  state. Active reservations use the same half-open overlap and expired-hold
  rules as room availability checks.

## Rooms and venues

File: `src/public/components/RoomsAndVenuesSection.jsx`

- Section anchor: `#rooms-and-venues`.
- Loads rooms and venues in parallel:
  - `GET /api/rooms`
  - `GET /api/venues`
- Only records with `status === "available"` are displayed.
- The landing page displays up to four available rooms and four available
  venues.
- Cards show the name, guest capacity, room price when applicable, type tag,
  availability status, image, review rating/count, and a `View Details` action.
- Images may be arrays or JSON-encoded arrays.
- The header `See more` button links to `/rooms-and-venues`.
- Individual room cards link to `/rooms-and-venues-details` with `roomId` and
  any selected `checkIn`, `checkOut`, `guests`, and `children` query values.
  Venue cards use `venueId` because venue details use a separate single-date
  flow.
- Loading and API errors are shown inline instead of being silently hidden.
- Room and venue cards share stretched flex-column layouts, consistent
  `aspect-[4/3]` image areas, reserved price-row space, equal-height tag rows,
  truncated names, and bottom-aligned actions.
- Below `lg`, rooms and venues render as separate horizontal scroll-snap rows
  with a partial next-card preview and each row's own `Swipe →` hint. At `lg`
  they use three-column equal-height grids, and at `xl` four columns. Rating
  rows stay on one line, and cards use stretched flex-column layouts with
  bottom-aligned actions. Images are lazy-loaded and loading states use
  matching skeleton cards for the four-card display limit.
- Card photos use `src/shared/ProgressiveImage.jsx` with the bracketed resource
  type text as the error fallback; loading skeleton image areas use the same
  shimmer treatment.
- Resource responses include `average_rating` and `review_count`; public
  normalizers map them to `rating` and `reviewCount`. The shared
  `src/shared/StarRating.jsx` component shows the one-decimal average and count
  for reviewed resources. With no reviews it shows empty stars and `No reviews
  yet`, never a zero rating or empty count.

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
 - Live Band
- Amenity data is maintained in `src/public/data/amenities.js`, including
 descriptions, practical details, and optional local photo assets. All six
 cards are clickable; cards with photos say `View photos` and cards without
 photos say `View details`. Placeholder hours and rates are explicitly marked
  `TODO` in configuration but are filtered from public modal content, so no
  prices are fabricated.
- Cards use fitting inline SVG icons (utensils, WiFi, parking, volleyball, and
  microphone), pointer cursors, hover lift, focus rings, and keyboard-reachable
  dialog triggers.
- On phones, amenity cards use a horizontal snap row with hidden scrollbars
  and touch-friendly scrolling. From `sm` through `lg`, six cards use a
  three-column, equal-height grid; from `xl`, they use six columns because
  each card remains comfortably wider than 150px. Titles reserve two lines and
  the visible action hint is aligned to the bottom of every card.
- Cards open `AmenityModal.jsx`, which provides a lazy-loaded carousel when real
  photos are configured, or an icon header panel when they are not. It also
  provides a description, any real details, and a `Check availability` action.
  The modal traps focus, supports Escape/backdrop close, arrow-key and touch
  navigation, locks body scrolling without layout shift, and returns focus to
  the card. It is a bottom sheet below `sm` and a centered `max-w-2xl` dialog
  above `sm`. Real amenity photos belong under
  `src/assets/images/amenities/`; no hero images are reused.
- The modal keeps per-slide ProgressiveImage loading state and preloads the
  previous and next photos when the current slide changes; slides cross-fade
  without changing the reserved `aspect-[4/3]` box.

## Guest reviews

File: `src/public/components/Reviews.jsx`

- Heading: `What Our Guests Say`.
- Subtitle: `Hear from our valued guests`.
- Real completed-stay reviews from `GET /api/reviews` are displayed in responsive cards.
- The component requests `?random=1&limit=3` once per page load and displays up
  to three random reviews. Each card contains a star row, quotation, guest
  name, and the booked resource (`Stayed in {room_number}` or
  `Event at {venue_name}`).
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
- Customer portal detail calendars use the same local `YYYY-MM-DD` date
  convention and 1-based API month query values; their selected dates are
  controlled by the parent booking state so calendar clicks and date inputs
  remain synchronized.
- Venue detail calendars pass `venueId`, `selectionMode="single"`,
  `selectedDate`, and `onSelectDate`; they fetch the venue booked-dates
  endpoint whenever the displayed month changes. Booked dates and past dates
  are red/disabled or disabled respectively, and a single date is selected
  instead of a range. The venue calendar now lives in an
  `Availability Calendar` card in the main column, matching the room details
  layout; the sticky sidebar displays the selected date or a prompt to pick
  one. Conference Hall time-window conflicts remain authoritative on the
  server quote and booking checks.
- Conference Hall package cards on the public venue details and booking forms
  load active packages from `GET /api/venues/:venueId/packages`, ordered by
  `sort_order`. Package blocks are selectable radio cards with the package
  name, PHP price, description, and non-empty inclusions list. Inclusions are
  normalized from arrays, JSON strings, or newline-separated values.
- The public landing venue card shows a Conference Hall package summary with
  the lowest active package price and active package count. Cottage cards do
  not show package UI. The customer portal venue booking form uses the same
  public packages endpoint and displays the selected package description and
  inclusions.

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
- The reservation list items still use placeholder `#` links. The three policy
  links now point to `/terms`, `/privacy`, and `/payment-policy`.
- `PolicyPage.jsx` is the shared, structured-data renderer. Policy contact
  details and page titles use `ResortInfoContext`; payment methods are fetched
  from `GET /api/payment-methods`.
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
- Anchored sections use `scroll-mt-20` and the page enables smooth scrolling so
  the fixed header does not cover `#availability-calendar`,
  `#rooms-and-venues`, `#amenities`, or `#location`. The Footer retains its
  separate `#contact` section, but the header Contact link targets
  `/#location`.
- `CustomerRoutes` mounts `ScrollToHash` once inside `BrowserRouter`. It
  smoothly scrolls to hash targets after route changes (retrying briefly while
  data-backed sections render), repeats same-hash navigation, and instantly
  returns to the top for hashless page navigation.
- `Reveal.jsx` provides the shared IntersectionObserver reveal used by landing
  section headings and cards. Public motion is limited to opacity/vertical
  translation, short staggered fades, calendar selection/month fades, and
  motion-safe hover/press feedback. Reduced-motion users see content immediately
  with no animation or smooth scrolling.
- Images reserve their final box before loading, show a slate shimmer, and fade
  in after decoding. Errors and missing sources show a readable fallback, with
  the shimmer capped at 15 seconds. Shimmer and transitions are motion-safe;
  reduced-motion users see a static placeholder and no image transition. Only
  the hero image is priority-loaded; below-the-fold photos remain lazy.

## Recent changes

- October 15, 2026: Added the Asia/Manila next-day minimum for all new public
  room and venue holds, quotes, and reservations. `MIN_BOOKING_LEAD_DAYS`
  controls the server rule; admin walk-ins remain exempt.

- October 15, 2026: Public payment proof submission now clears its reservation
  hold state and redirects already-submitted reservations away from the payment
  form on refresh, revisit, and browser back navigation.

- October 14, 2026: Added a deterministic guest/customer reservation-intent
  guard before the chatbot model call and an output filter for booking claims
  or requests for personal/payment details. Replies direct guests to
  `/rooms-and-venues` and venue details instead of offering chat reservations;
  policy and availability questions remain model/tool-backed. The shared
  chatbot renderer now safely renders basic markdown (bold, italic, lists,
  line breaks, and safe links) using React nodes, including stored history.
  Guard replies do not call the model or consume LLM quota. Changed files:
  `backend/controllers/chatbotController.js`, `backend/database/schema.sql`,
  `backend/migrations/20261014_add_chatbot_booking_faq.sql`,
  `src/shared/chatbot/ChatbotMessageContent.jsx`, and
  `src/shared/chatbot/ChatbotPanel.jsx`.

- October 19, 2026: Added conversational reservation assistance for
  authenticated customers in the portal chatbot page and widget. The assistant
  gathers missing details, prepares a server-validated proposal, and creates a
  hold only after explicit customer confirmation. The customer then receives
  a payment link. Guest chat remains public-information-only; final availability
  and hold checks use the existing reservation API. Changed files include
  `src/customer/utils/chatbotReservation.js`,
  `src/shared/chatbot/ChatbotReservationReview.jsx`,
  `src/shared/chatbot/ChatbotPanel.jsx`, `src/customer/pages/ChatbotPage.jsx`,
  and `backend/controllers/chatbotController.js`.

- October 14, 2026: Added the shared chatbot widget to the landing page. Guests
  receive a session-only public-information chat with reservation questions
  directed to `/login`; authenticated customers retain the full portal
  assistant. The widget is keyboard accessible, responsive at phone widths, and
  remains behind modals.

- October 14, 2026: Added reusable ProgressiveImage loading states to the
  landing hero, rooms and venues cards, and amenity modal, including reserved
  boxes, shimmer placeholders, decoded-image fades, timeout/error fallbacks,
  reduced-motion behavior, and neighbor preloading. Location embeds now use a
  matching loading placeholder and fade in after load; the header logo remains
  eager-loaded. The hero image is wrapped in its own full-size absolute layer
  so the shared component retains its reserved box, and amenity carousel
  controls remain above photo layers at all responsive sizes. Room and venue
  card photos use the same full-size outer layer so their aspect-ratio areas
  remain sized in both snap rows and desktop grids.

- October 14, 2026: Added optional photo-enabled resort amenity cards backed
  by `data/amenities.js`. All six cards now open an accessible responsive
  modal; real photos use carousel controls, swipe and keyboard navigation, and
  photo-less amenities use an icon header panel. TODO-marked details are kept
  for future editing but hidden from guests. Focus management, scroll locking,
  and the link back to `#availability-calendar` are preserved.
  The section now includes six distinct amenity icons, including a music-note
  icon for Live Band, with equal-height three-column desktop cards and a
  six-column layout at `xl`.

- October 14, 2026: Fixed landing-page hash scrolling by moving smooth
  scrolling to `html`, adding router-level hash handling with delayed target
  retries, and making header navigation and home scrolling work consistently.
  Added the reusable `Reveal` component plus restrained landing animations,
  reduced-motion overrides, calendar transitions, mobile-safe card-row spacing,
  and a scroll-reactive header shadow.

- October 14, 2026: Made the public Rooms & Venues filters compact and
  collapsible on phones, with active-filter counts, date summary chips, paired
  controls, and mobile-friendly apply/clear actions. Phone result cards now use
  two columns below `sm` while the desktop sidebar remains unchanged. Room and
  venue card actions now share equal-height rows with bottom-aligned buttons.

- October 14, 2026: Resort-wide calendar dates are now red only when every
  available room is occupied by an active reservation. Past dates remain grey,
  range selection uses shared half-open overlap rules, and room results and
  details preserve validated check-in, check-out, guest, and children values
  through booking.

- October 14, 2026: Fixed the Rooms & Venues responsive card rows so phones
  and tablets use equal-height horizontal scroll-snap cards below `lg`, with
  aligned ratings, price and tag rows, and bottom-aligned actions; `lg` and
  `xl` use three- and four-column grids.

- October 14, 2026: Replaced Conference Hall package dropdowns and button-only
  package blocks with shared accessible radio-card selectors across public and
  portal booking flows. Package descriptions and inclusions remain visible,
  selection state drives quotes, summaries, holds, and payloads, and Free
  Venue enforces the 100-pax minimum in the UI while server validation remains
  authoritative.

- October 13, 2026: Added real completed-reservation ratings and review counts
  to public room and venue cards and detail headers, with a shared star-rating
  component and an explicit zero-review state.

- October 13, 2026: Updated the landing guestbook to show up to three random
  completed reviews with their booked room or venue, using the extended public
  reviews endpoint.

- October 9, 2026: Room date selection now blocks ranges that cross booked
  nights. The first booked date after a chosen check-in is selectable as a
  checkout-only date. The details page and POST /api/reservations both reject
  overlapping ranges (409).

- October 9, 2026: Added the landing-page Our Location section with a
  Street View default, lazy map toggle, map and address fallbacks, contact
  details, and Google Maps directions.

## Related public routes

The route table lives in `src/customer/routes/CustomerRoutes.jsx`
(`src/public/routes/PublicRoutes.jsx` is unmounted legacy code):

- `/`: landing page; unmatched paths redirect here via `<Route path="*">`
- `/rooms-and-venues`: availability/results page (inside `PublicLayout`)
- `/rooms-and-venues-details`: room and venue details (inside `PublicLayout`)
- `/booking-information`
- `/book/room/:roomId`
- `/book/venue/:venueId`
- `/payment/:reservationId`
- `/login`
- `/register`
- `/terms`, `/privacy`, `/payment-policy`: public policy pages rendered
  inside `PublicLayout` with the shared `PolicyPage` component.
- `/portal/*`: customer portal, guarded by `RequireCustomer`; signed-out
  visitors are redirected to `/login`

The rooms-and-venues routes and policy routes are wrapped in `PublicLayout`
(fixed `Header` plus `Outlet`). Policy pages render the shared footer
themselves so booking and authentication page layout remains unchanged.

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
  `guests`; optional `children` is carried through room booking but does not
  affect adult capacity filtering.
- Without a date range, loads the room catalog from `GET /api/rooms` and
  venues from `GET /api/venues`.
- With a date range, requests available rooms from
  `GET /api/rooms/availability?check_in=...&check_out=...&capacity=...`.
  The overlap rule is `reservation.check_in < requested.check_out` and
  `reservation.check_out > requested.check_in`; applying or clearing filters
  updates the URL, so browser Back preserves the selected dates. Date-range
  results contain only rooms available for every requested night, and their
  availability badges reflect that range.
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
- Packaged venue details show active package cards beside the event-date
  selector. Customers can choose a package before or after selecting a date;
  the selected package is carried to booking details, where it can be changed.
- Room details include a compact availability calendar, nightly pricing,
  check-in/check-out fields, adult and children quantities, and a room subtotal/total. The room
  calendar is an interactive range selector: the first available-date click
  sets check-in, the second later click sets check-out, and selecting an
  earlier date restarts the range. The first booked date after check-in is
  selectable as a checkout-only date, while ranges crossing booked nights are
  blocked. Calendar selections stay synchronized with the check-in/check-out
  fields, which also validate typed ranges. Room totals use only nightly price
  multiplied by the selected number of nights; no client-side service fee or
  VAT is added. Room capacity applies to adults only; children are tracked
  separately.
  `checkIn`, `checkOut`, `guests`, and optional `children` query parameters
  prefill the fields and calendar. Invalid, past, or overlapping ranges are
  rejected inline before a hold is created, and the nightly total is computed
  immediately for a valid prefilled range.
- Venue details show venue information, images, capacity, and a room-style
  right-hand sticky selection card with price, availability badge, labels,
  single-date `AvailabilityCalendar` selection backed by
  `GET /api/venues/:venueId/booked-dates?year=YYYY&month=M`, server quote
  breakdown, Reserve Now, final-booking notice, and a small note.
  Cottages show date-only day-use selection for 08:00–17:00 and a flat price.
  Conference Hall shows package, date, start time, pax, optional extra hours,
  availability, and server quote handling.
- Hall package cards show package names, inclusions, and Philippine Peso
  pricing. Guest venue bookings return an access token and navigate to
  `/payment/:reservationId`.
- The public venue page sends the selection to `/book/venue/:venueId`; it does
  not render the large contact form below the details or a separate Venue
  Information sidebar.
- Reserving a room navigates to:

  ```text
  /book/room/:roomId?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&guests=N&children=N
  ```

### Booking information

File: `src/public/pages/BookingInformationPage.jsx`

- Routes: `/booking-information` and `/book/room/:roomId`.
- Loads the selected room from `GET /api/rooms/:roomId`.
- Reads optional `check_in`, `check_out`, and `guests` query parameters;
  `guests` remains the adult count and optional `children` defaults to zero.
- Collects customer information (first name, last name, email, phone, and
  address) and booking details. Adults must not exceed room capacity; children
  are tracked separately and the summary shows the breakdown.
- Calculates the number of nights and the reservation total from the room’s
  nightly price.
- Displays a 50% deposit and 50% pay-on-arrival breakdown.
- Updates the existing room hold with
  `PATCH /api/reservations/:id/hold` with `credentials: 'include'`; it never
  creates a second room reservation.
- `POST /api/reservations` and `POST /api/reservations/hold` share a limit of
  10 requests per 60 minutes per resolved client IP (`429` beyond that).
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
- Reservation payloads store children separately in `reservations.children`;
  old URLs without `children` remain compatible.

`VenueBookingInformationPage.jsx` is the venue equivalent. It re-fetches the
server quote, displays the venue, event window, selected package, pax, and total,
collects first name, last name, email, phone, and address, limits phone input
to digits and 11 digits, locks logged-in customer email, and submits the venue
payload to `POST /api/reservations`. Conference Hall packages are selected from
the accessible radio-card group; no package is silently chosen, and Continue
remains disabled until one is selected. Guests receive an access token; logged-in
customers are attached to their account. A 409 returns to venue selection with
the availability message.

The authenticated customer portal venue flow in
`src/customer/pages/VenueBookingDetailsPage.jsx` collects first name, last name,
email, mobile number, and address, matching the public booking form. Packaged
venue holds are created only after the customer selects a package, event date,
start time, pax, and extra hours; server availability supplies the valid start
times and the hold is checked against that exact booking window. The portal
starts and displays the hold countdown as soon as that selection is verified;
changing the selection replaces the hold. Venue list/detail responses expose
the flat day-use price or, for packaged venues, the lowest active package price
so portal cards and detail summaries do not display zero. Day-use venue holds
continue to be created with grouped-unit resolution before the details step.
Day-use cottage booking forms do not ask for a start time; their configured
venue start time is used for quote and hold updates. Only packaged venues show
the start-time selector.

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
- The order summary displays adults and children for room reservations.
- An Important reminders card covers the 18+ requirement, ID at check-in, and
  room pet diaper/bed requirements, with a link to the Terms and Conditions.
- Venue reservations show the event date and time window, package, pax, and
  total in the order summary; room reservations retain check-in/check-out
  display.

### Venue reservation rules

- Small Cottage and Big Cottage are day-use venues with fixed 08:00–17:00
  windows, flat per-day prices, and one booking per date.
- Event dates must be tomorrow or later in Asia/Manila; existing reservations
  are unaffected. Admin walk-in bookings are exempt because they support
  same-day walk-ins.
- Conference Hall is package-based: Free Venue (Per Person) costs ₱590 per
  person with a 100-pax minimum; Package 10K, Package 15K, and Package 20K
  are flat-price packages. Public and portal booking-details forms use
  clickable, keyboard-accessible package radio cards, bump Free Venue pax to
  100 when selected, and use public package, availability, quote, and
  booked-dates endpoints while displaying the server quote.
- Venue dates are returned as `YYYY-MM-DD`; venue reservations use event date
  and time fields rather than room check-in/check-out fields.

### Guest reservation access (reservation tokens)

Files: `backend/utils/reservationToken.js`, `backend/middleware/reservationAccess.js`,
`backend/routes/publicReservationRoutes.js`,
`backend/controllers/publicReservationController.js`

- Guests who book without an account receive a dedicated reservation access
  JWT (`access_token`) from the room hold endpoint or legacy
  `POST /api/reservations`. It expires after 24
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
- After a successful customer login the page navigates to the saved
  `location.state.from` destination when present; otherwise it goes to
  `/portal`. The login request always includes `portal: "customer"` and the
  backend authenticates against `Customer` only.
- Staff credentials and all other invalid customer-portal credentials show only
  `Invalid email or password.`. The backend returns no staff role, user data,
  token, or replacement cookie. A staff session found by the portal-aware
  `GET /api/auth/me` check is treated as signed out without a staff-specific
  message or account details. Verified Google staff emails receive the generic
  Google failure and are not linked or created as customers.
- `/register` validates password confirmation, terms acceptance, and a minimum
  eight-character password before calling `onRegister`.
- Successful registration presents a six-digit code from
  `POST /api/auth/register/verify`; resend uses
  `POST /api/auth/register/resend-code`. An unverified account cannot log in,
  while verified existing accounts retain the 409 conflict behavior.
- Customer login may return a challenge from `POST /api/auth/login`; the
  cookie is withheld until `POST /api/auth/login/verify`, with resend through
  `POST /api/auth/login/resend-code`. `LOGIN_CODE_ENABLED` defaults to true,
  and Google sign-in skips the code.
- Verification codes are stored only as HMAC-SHA256 hashes in
  `Auth_Verification_Codes`, expire after 10 minutes, allow five attempts, and
  are cleaned by the scheduled cleanup job. Registered customers are
  backfilled as verified by the idempotent migration
  `mysql -u root -p kairos_db < backend/migrations/20261015_add_auth_verification.sql`;
  guest booking rows remain unregistered and are not changed.
- Both pages render standalone centered forms and expose submission errors
  inline.
- Registration collects first name, last name, email, phone, date of birth,
  password, confirmation, and terms acceptance.

## Recent changes (October 13, 2026)

- October 13, 2026: Documented portal-scoped customer login, generic
  cross-portal failures, staff-session handling, and Google staff-email
  rejection.
- October 10, 2026: Added resort rules, booking eligibility (18+, ID at
  check-in) and pet policy sections to the Terms and Conditions, added an
  Important reminders card to the payment page, and added a children quantity
  to room booking (query param `children`, `reservations.children` column,
  adults validated against capacity; children tracked separately).

- October 9, 2026: Updated the landing Rooms & Venues section to show up to
  four available rooms and venues, use responsive two/three/four-column
  desktop grids, and point the `See more` button to `/rooms-and-venues`.

- October 8, 2026: Added public Terms and Conditions, Privacy Policy, and
  Payment Policy routes with a shared responsive policy renderer, dynamic
  resort contact details, table of contents, footer links, registration links,
  and payment-policy links in booking and payment flows. (October 8, 2026)

- October 8, 2026: Documented the shared portal venue flow: venue selection
  uses a single-date availability calendar and package details, then a separate
  venue booking-details page re-fetches the quote before payment.
- October 8, 2026: Documented that portal payment methods display the backend
  `qr_image_url`, account details, and a phone-friendly open/save fallback.
- October 8, 2026: Documented the room-only reservation payload fix and backend
  normalization of absent room venue fields while venue validation remains strict.

- October 8, 2026: Customer portal reservation detail now shows the real resort
  address and the server-generated check-in QR (same as the accepted-payment
  email). The QR is generated server-side for confirmed reservations only.

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
- October 8, 2026: Documented public venue details and booking for cottages and
  Conference Hall, including package cards, server quotes, guest access-token
  payment, venue payment summaries, and Philippine Peso pricing.
- October 8, 2026: Restructured public venue booking into a room-style sticky
  selection card plus `/book/venue/:venueId` contact-details page while
  preserving the shared portal venue form.
- October 8, 2026: Added a single-date availability calendar to the public
  venue details selection card, backed by the venue booked-dates endpoint.
- October 8, 2026: Moved the venue availability calendar into the main column
  and matched the room calendar's layout (single-letter weekdays, centered
  month header, pink booked cells, inline legend).
- October 8, 2026: Connected public and portal venue package displays to the
  live active package endpoint, including package descriptions and inclusions.
- October 8, 2026: Moved Conference Hall package description and inclusions
  from the sidebar selector to a main-column details card.
- October 9, 2026: Documented the portal booking-details presentation: package
  cards with descriptions and inclusions appear above event details, and
  Conference Hall start times are selected by the hour within the configured
  venue window. Public route behavior remains unchanged.
- October 9, 2026: Made the public room-details availability calendar select
  check-in and check-out dates directly, synchronize the room booking fields,
  and calculate the displayed room total from nightly price only by removing
  the fake service-fee and VAT lines.
- October 14, 2026: Fixed public room and venue hold updates when a temporary
  guest is matched to an existing guest customer. Reservation and status-history
  references are reassigned before the unused placeholder is removed, while
  registered-account email conflicts continue to return `409`.
- October 15, 2026: Documented the customer registration and portal-scoped
  login verification entry points, code storage migration, guest-account
  boundary, and `LOGIN_CODE_ENABLED` demo flag.

## Known gaps

- Legal review is pending. The Privacy Policy contains a TODO retention-period
  placeholder because no retention rule exists in the application.
- Policy pages and payment-policy links still need a live browser pass at
  logged-out and logged-in states and phone width.

- The public cottage and hall selection/contact flow was clicked through with
  a guest browser session, and the logged-in portal venue route was opened and
  verified. Full payment-proof submission was not performed.
- The new venue calendar and booked-date response shape were not browser-tested
  against a live backend in this change.

## Room reservation holds

- The public app bootstraps a signed, HttpOnly `kairos_reservation_visitor`
  cookie through `GET /api/reservations/visitor` before creating a reservation.
  Guest holds store only a SHA-256 visitor key in `Reservations.visitor_key`;
  logged-in customers are counted by customer ID.
- A visitor may have at most two active online holds
  (`payment_pending` with `hold_expires_at > NOW()`) and three unreviewed
  `pending_verification` reservations by default. Configure these with
  `MAX_ACTIVE_HOLDS_PER_VISITOR` and `MAX_UNREVIEWED_PER_VISITOR`. Expired
  holds do not count; a same-resource re-hold replaces the visitor's previous
  hold instead of stacking another.
- An additional limit of six active holds per resolved client IP by default
  (`MAX_ACTIVE_HOLDS_PER_IP`) mitigates lost guest cookies. This counter and
  the existing request-rate limiter are in-memory and single-backend-instance;
  IP is intentionally secondary because resort Wi-Fi and carrier NAT are
  shared. The visitor cap is serialized with a MySQL advisory lock.
- Reaching a cap returns HTTP `429` with safe resume details for that
  visitor's own holds. Public and portal booking/payment pages offer a
  continue link when an active payment hold is available. Staff walk-ins do
  not use or count toward these caps.
- `POST /api/reservations/hold` runs when `Reserve Now` is clicked. It locks
  the room, re-checks active overlaps, and creates a `payment_pending` hold for
  the configurable 15-minute hold duration.
- The response includes `reservation_id`, `booking_reference`,
  `hold_expires_at`, and `server_time`; guest flows also receive a token.
  Hold state is kept only in `sessionStorage` under
  `kairos_reservation_hold`.
- The information page updates the existing hold with
  `PATCH /api/reservations/:id/hold` rather than creating a second reservation.
  Countdown displays use `hold_expires_at` adjusted by server time.
- Back, cancellation, navigation away, and tab close release holds through
  the release endpoint, using `navigator.sendBeacon` where available.
- A `409` conflict shows “These dates were just taken. Please choose other
  dates,” refreshes availability, and keeps the customer on the details page.
  Expired holds return the customer to room details.
- New room holds and reservations require check-in tomorrow or later in
  Asia/Manila. Holds left open past midnight are treated as expired when their
  date is no longer bookable.

## Public venue holds

- Public venue selection creates a `payment_pending` hold when the customer plans an event. The information page patches that hold after package, slot, guest count, and contact details are confirmed.
- Venue quotes and conflicts are recomputed server-side. Tokens and countdown state remain in `sessionStorage`, never `localStorage`.
- New venue holds and quotes require an event date tomorrow or later in
  Asia/Manila. The server uses `MIN_BOOKING_LEAD_DAYS`; admin walk-ins remain
  exempt.

## Shared hold timer

- `shared/components/HoldTimerBar.jsx` is the shared pinned countdown bar for
  public booking information, venue booking information, and payment pages, as
  well as customer-portal booking and payment pages.
- `shared/hooks/useHoldCountdown.js` derives remaining time from
  `hold_expires_at`; it applies the hold response's `server_time`, or the HTTP
  `Date` header when available, to compensate for client clock skew.
- The hook recalculates from the expiry timestamp every second and immediately
  on tab visibility and window-focus changes; it does not trust accumulated
  interval ticks.
- The bar shows amber normally, stronger orange below five minutes, red below
  one minute, and a distinct expired message; a progress line represents time
  used.
- Threshold-only screen-reader announcements avoid announcing every second.
  The countdown has a timer role, uses tabular digits, and respects reduced
  motion by using no animation.
- On phones the bar remains a compact single row with a truncated resource
  name; wider screens include the full label and progress indicator.
- The bar stacks below the measured public fixed header or customer sticky
  topbar, reserves space in the page, and adjusts scroll padding for focused
  fields.
- Existing expiry redirects, disabled payment actions, and hold-release
  behavior remain unchanged; the timer is absent when no active expiry exists
  and after payment proof submission.

The visitor-key field is included in `backend/database/schema.sql`. Existing
databases require the manual migration
`backend/migrations/20261017_add_reservation_visitor_key.sql`; startup does not
run migrations automatically.

## Public grouped resource cards and booking

- Public and customer browse cards are grouped by the shared rule mirror in
  `src/public/utils/groupUnits.js`; the server's authoritative grouping and
  representative lookup live in `backend/utils/resourceGroups.js`. The landing
  page applies its four-card limits after grouping.
- Room groups use trimmed, case-insensitive room type, capacity, and nightly
  price. Only `available` rooms contribute to the displayed unit count. Venue
  groups use venue type, trimmed base name after removing a trailing number or
  `#N`, capacity, and matching day-use booking/pricing fields. Only numbered
  day-use venues group; packaged venues and unnumbered venues stay individual.
- Cards use a representative unit's image and descriptive fields, omit room
  numbers, and show the group unit count. Room cards show their common nightly
  price.
- Group detail links include `group=1`; specific room/venue links without that
  marker keep their original single-unit behavior. The client sends only the
  representative `room_id` or `venue_id` plus `resolve_group: true` when
  creating a group hold. It never submits a candidate-ID list.
- Grouped calendars call the existing per-resource booked-date paths with
  `group=1`. The server resolves group membership from the representative and
  marks a date unavailable only if every unit is blocked by its administrative
  status or existing reservations/active holds. Non-group calendars keep the
  existing single-unit response behavior.
- `POST /api/reservations/hold` locks the derived group resources in stable
  order, then checks candidates in ascending room number or venue ID. It creates
  the hold against the first available unit, retrying within that one request
  when an earlier candidate is unavailable. The response includes the assigned
  `room_id` or `venue_id`; the client continues booking with that specific unit.
  Pricing is computed from the held unit, and later venue quote checks use the
  assigned venue ID.
- `VenueBookingForm.jsx` has no active render/call site in the customer routes;
  the reachable venue flow creates a hold and continues through
  `VenueBookingDetailsPage.jsx`.
