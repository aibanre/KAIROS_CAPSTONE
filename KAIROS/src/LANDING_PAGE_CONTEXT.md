# Landing Page Context

## Scope

This document describes the public KAIROS landing page implemented in `src/`.
The admin area is intentionally out of scope.

## Entry point and page composition

`App.jsx` renders the public landing page through `PublicSite` for the root route
and any unmatched public route:

1. `Header`
2. `HeroSection`
3. `AvailabilityCalendar` in general mode
4. `RoomsAndVenuesSection`
5. `ResortAmenities`
6. `Reviews`
7. `Footer`

The page is wrapped by `BrowserRouter` and `ResortInfoProvider`. The provider
loads resort branding and contact information from `GET /api/resort-info`, while
falling back to the default Kai Azul values if the request is unavailable.

## Header

File: `components/Header.jsx`

- Fixed white header, 64px high, above page content (`z-50`).
- Left side: resort logo and dynamic resort name.
- Primary links:
  - `Home` -> `/`
  - `Rooms & Venues` -> `/rooms-and-venues`
  - `Amenities` -> `/#amenities`
  - `Contact` -> `/#contact`
- Right side:
  - `Login` -> `/login`
  - `Register` -> `/register`
- Uses the logo at `assets/images/logo/transparent-kaiazul.png`.

## Hero and availability search

File: `components/HeroSection.jsx`

- Starts below the fixed header with 16px top padding.
- Uses `assets/images/background/image.png` as a full-width background.
- Displays:
  - “Welcome to Paradise”
  - Dynamic resort name
  - “Where the ocean meets luxury — unforgettable stays await”
- Includes a floating white search card overlapping the bottom of the hero.
- The search card currently contains a controlled guest selector:
  `1 Adult`, `2 Adults`, `3 Adults`, `4 Adults`, or `5+ Adults`.
- Submitting the form smoothly scrolls to `#availability-calendar`.
- Check-in and check-out are selected in the calendar below, not in the hero form.

## Availability calendar

File: `components/AvailabilityCalendar.jsx`

- Rendered in general mode on the landing page.
- The selected range is controlled by `PublicSite` with `checkIn` and
  `checkOut` state.
- Past dates and booked dates are disabled.
- Users select a check-in date first, then a later check-out date.
- Selecting a date before the current check-in restarts the selection.
- Month navigation is available with `Prev` and `Next`.
- When both dates are selected, `PublicSite` shows a `Search Availability`
  button.
- The button navigates to:

  ```text
  /rooms-and-venues?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N
  ```

- When a `roomId` is supplied on other pages, booked dates are loaded from
  `GET /api/rooms/:roomId/booked-dates?year=YYYY&month=M`. The general landing
  page calendar has no room-specific booking query.

## Rooms and venues

File: `components/RoomsAndVenuesSection.jsx`

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

## Resort amenities

File: `components/ResortAmenities.jsx`

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

## Guest reviews

File: `components/Reviews.jsx`

- Heading: `What Our Guests Say`.
- Subtitle: `Hear from our valued guests`.
- Three currently static reviews are displayed in responsive cards.
- Each card contains a star row, quotation, and guest name.
- Current review names are Ana Reyes, Marco Lim, and Chloe Park.

## Footer and contact

File: `components/Footer.jsx`

- Section anchor: `#contact`.
- Uses dynamic resort name, address, phone number, and email from
  `ResortInfoContext`.
- Contact links use `tel:` and `mailto:`.
- Footer columns:
  - Resort contact details
  - Quick Links: Home, Rooms, Venues, Amenities
  - Reservations: Book a Room, Book a Venue, Check Availability, Contact Us
  - Policies: Terms & Conditions, Privacy Policy, Cancellation Policy,
    Payment Policy
- The reservation and policy list items currently use placeholder `#` links.
- Footer copyright currently displays `© 2025 {resortName} — KAIROS Integrated
  Reservation System`.

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
- Public API URLs are built from `config/api.js` and the optional
  `VITE_API_URL` environment variable.

## Related public routes

- `/` (and unmatched public paths): landing page
- `/rooms-and-venues`: availability/results page
- `/rooms-and-venues-details`: room and venue details
- `/booking-information`
- `/book/room/:roomId`
- `/payment/:reservationId`
- `/login`
- `/register`

When changing the landing page, keep the section anchors, query parameter names,
and existing navigation destinations stable unless the corresponding consumers
are updated together.

## Public pages connected to the landing page

The files in `src/pages/` extend the landing page into the public browsing and
reservation flow. They are rendered from `App.jsx` with `Header` on the
room/venue and booking pages, while login and registration use standalone
layouts.

### Rooms and venues results

File: `pages/RoomsAndVenuesPage.jsx`

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

File: `pages/RoomsAndVenuesDetailsPage.jsx`

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

File: `pages/BookingInformationPage.jsx`

- Routes: `/booking-information` and `/book/room/:roomId`.
- Loads the selected room from `GET /api/rooms/:roomId`.
- Reads optional `check_in`, `check_out`, and `guests` query parameters.
- Collects customer information (first name, last name, email, phone, and
  address) and booking details.
- Calculates the number of nights and the reservation total from the room’s
  nightly price.
- Displays a 50% deposit and 50% pay-on-arrival breakdown.
- Submits a reservation to `POST /api/reservations`.
- On success, navigates to `/payment/:reservationId` and passes the response
  in router state.
- The page is explicitly designed to allow booking without an account.

### Payment details

File: `pages/PaymentDetailsPage.jsx`

- Route: `/payment/:reservationId`.
- Loads reservation details and available payment methods in parallel:
  - `GET /api/reservations/:reservationId`
  - `GET /api/payment-methods`
- Displays a countdown based on the reservation hold expiry.
- Lets the guest choose a payment method and view its QR/account
  instructions.
- Accepts PNG, JPEG, and WebP proof-of-payment uploads.
- Submits payment proof as multipart form data to
  `POST /api/reservations/:reservationId/payment`.
- Expired holds and API errors are shown explicitly.
- Successful submission displays the booking reference and explains that the
  proof is pending verification.

### Authentication entry points

Files: `pages/LoginPage.jsx` and `pages/RegisterPage.jsx`

- `/login` posts credentials to `POST /api/auth/login` with cookies enabled.
- Customer login navigates to `/`; non-customer login navigates to `/admin`.
- `/register` validates password confirmation, terms acceptance, and a minimum
  eight-character password before posting to `POST /api/auth/register`.
- Successful registration navigates to `/login`.
- Both pages render standalone centered forms and expose submission errors
  inline.
- Registration collects first name, last name, email, phone, date of birth,
  password, confirmation, and terms acceptance.
