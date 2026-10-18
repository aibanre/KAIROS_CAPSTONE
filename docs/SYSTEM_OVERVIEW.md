# KAIROS System Overview

This overview describes the reservation system for Kai Azul Beach Resort. It is
based on the repository implementation and the checked-in public, admin, and
deployment documentation. It contains no environment values or credentials.

## Contents

- [1. System at a glance](#1-system-at-a-glance)
- [2. Architecture](#2-architecture)
- [3. Technology stack](#3-technology-stack)
- [4. Database design](#4-database-design)
- [5. Core features](#5-core-features)
- [6. Reservation lifecycle](#6-reservation-lifecycle)
- [7. Security](#7-security)
- [8. Reliability and operations](#8-reliability-and-operations)
- [9. Known limitations and trade-offs](#9-known-limitations-and-trade-offs)
- [10. Glossary](#10-glossary)
- [11. Likely panel questions](#11-likely-panel-questions)

## 1. System at a glance

- **KAIROS** is Kai Azul Beach Resort’s website and reservation-management
  system for rooms, cottages, and event venues.
- **Guests** can browse and book without creating an account.
- **Registered customers** can sign in, view their reservations, and use
  customer-only features such as reviews and chatbot history.
- **Receptionists** handle front-desk bookings, reservation attendance,
  payment review, and reports.
- **Administrators** manage resort inventory, staff, settings, payments,
  reports, audit records, and chatbot content.
- **Public landing page:** introduces the resort and provides browsing,
  availability, and chatbot entry points.
- **Customer portal:** offers customer sign-in and account-based booking,
  reservation history, payment, reviews, and chatbot access.
- **Staff admin portal:** provides role-limited operational and management
  screens.
- The public pages and portal share one React application but use different
  routes and access rules.

| Role | Main access |
|---|---|
| Guest | Browse, book without an account, submit proof, and access their reservation using its token. |
| Customer | All guest booking options, plus account reservations, profile, reviews, and chatbot history. |
| Receptionist | Dashboard, reservations, walk-ins, payment review, reports, attendance, and inventory inspection. |
| Administrator | All documented staff operations, plus room/venue, customer, user, settings, audit, and chatbot management. |

## 2. Architecture

- **Three-tier design:** the browser handles the interface, the API applies
  business rules, and the database stores persistent records.
- **Why:** separating these responsibilities lets the browser stay responsive
  while the server validates and protects important booking changes.
- The frontend is a **decoupled React SPA**: a browser application that loads
  once and changes pages without full-page reloads.
- The backend is an **Express REST API**: HTTP routes accept requests, apply
  validation and permissions, and return structured responses.
- **Request flow:** a user clicks a control; the browser calls the Render API;
  the API validates the request, reads or writes Aiven MySQL, then returns data.
- **External services:** uploads go to Cloudinary; email uses Brevo SMTP with
  an optional Brevo HTTP fallback; Google verifies customer identity tokens.
- **Chatbot flow:** the API combines chatbot logic with an LLM client, which
  contacts the configured language-model provider.

```text
Guest / Customer / Staff browser
          |
          +---- loads React SPA assets ----> Vercel
          |
          +---- HTTPS API requests --------> Render: Express API
          |                                      |
          |                                      +---- TLS SQL ----> Aiven MySQL
          |                                      +---- images -----> Cloudinary
          |                                      +---- email ------> Brevo SMTP
          |                                      |                    +-- HTTP fallback
          |                                      +---- chatbot ----> LLM client
          |                                      |                    +-- configured model API
          +---- Google sign-in ----------------> Google Identity
```

- **Vercel** serves the frontend build and its single-page-app fallback.
- **Render** runs the Node.js API and background timers in the server process.
- **Aiven** hosts MySQL; production database connections verify TLS certificates.
- **Cloudinary** stores uploaded room, venue, payment-proof, and inspection
  images; the database keeps image URLs.
- **Brevo SMTP** sends email; the HTTP API is a fallback when SMTP is unavailable
  or fails and a key is configured.
- **Google Identity** supplies sign-in credentials; the backend verifies the
  identity token before customer account handling.
- **The LLM client** sends chatbot requests to configured OpenAI-compatible
  provider endpoints; provider selection and fallback are environment-based.

## 3. Technology stack

| Technology | What it is | Why we use it |
|---|---|---|
| React | A JavaScript library for building interactive screens. | It powers the public, customer, and staff interfaces. |
| React Router | A library that maps browser paths to screens. | It supports public, portal, and admin navigation without full-page reloads. |
| Vite | A frontend development server and production bundler. | It builds the React application and supports a local API proxy. |
| Tailwind CSS | Utility classes for styling web elements. | It provides the responsive visual styles used across the application. |
| Recharts | A React charting library. | It displays dashboard and report charts. |
| jsQR | A browser library that reads QR codes from camera images. | It supports staff scanning reservation references at check-in. |
| Node.js | A JavaScript runtime outside the browser. | It runs the API and its scheduled background work. |
| Express | A Node.js framework for HTTP APIs. | It organizes routes, middleware, permissions, and controllers. |
| MySQL | A relational database organized into linked tables. | It stores accounts, rooms, reservations, payments, and audit history. |
| mysql2 | A Node.js MySQL driver with promise support. | It runs parameterized SQL and transaction-based updates. |
| bcrypt | A password-hashing library designed for password storage. | It stores password hashes rather than readable passwords. |
| jsonwebtoken | A library for signing and checking JSON Web Tokens. | It supports cookie sessions and guest reservation access tokens. |
| Multer | Middleware for receiving uploaded files. | It checks image type and size before a controller processes an upload. |
| Cloudinary | A hosted image-storage service. | It stores uploaded files and returns URLs for display and later access. |
| Nodemailer | A Node.js email-sending library. | It connects the API to the resort’s configured SMTP sender. |
| Brevo | An email-delivery service with SMTP and HTTP interfaces. | It sends transactional messages and provides the configured email fallback. |
| pdfkit | A Node.js library for generating PDF documents. | It creates the administrator-only income report export. |
| qrcode | A library for generating QR images. | It creates reservation check-in QR codes for confirmed bookings and emails. |
| Google Identity Services | Google’s browser sign-in service. | It lets customers choose Google sign-in; the backend verifies the resulting token. |
| OpenRouter or Groq | Configurable external language-model providers. | They generate chatbot answers through the backend LLM client. |
| Vercel | A frontend hosting and delivery platform. | It publishes the built single-page application. |
| Render | A managed application-hosting platform. | It runs the Express API service. |
| Aiven | A managed MySQL hosting platform. | It supplies the production database with TLS-secured access. |
| Brevo SMTP | An email transport using the SMTP protocol. | It delivers receipts, verification codes, and account emails. |
| Cloudinary CDN | A content-delivery network for hosted images. | It serves stored images without placing image files in MySQL. |

## 4. Database design

- **Users** stores staff accounts, their roles, active state, password-change
  requirements, and password version timestamps.
- **Customer** stores registered customers and guest contact records; a guest
  can book without a password.
- **Staff/customer split:** staff live in `Users`; customers and guest booking
  contacts live in `Customer`. They are not interchangeable account tables.
- **Rooms** stores one record per physical room, including its unique room
  number, capacity, nightly price, status, amenities, and images.
- **Venues** stores cottages and halls, their booking mode, schedule, capacity,
  status, and day-use price.
- **Venue_Packages** stores active or inactive packages linked to a venue.
- **Reservations** links a customer to one room or one venue and stores dates,
  booking reference, price snapshot, status, and hold expiry.
- **Payments** links payment amounts and types to reservations, payment methods,
  proof images, verification decisions, and reviewing staff.
- **PaymentMethods** stores active payment instructions and optional QR image
  URLs.
- **Reservation_Status_History** records who or what changed a reservation
  status and when.
- **Reservation_Addons** records extra beds and their applicable unit price.
- **room_inventory** defines the expected inventory quantities for each room.
- **Inventory_Items**, **Reservation_Inventory_Checks**, and
  **Reservation_Inventory_Lines** store checkout checklists, signatures,
  item conditions, and missing-item charges.
- **Reviews** links customer ratings and comments to completed reservations.
- **Audit_logs** records important staff and system actions, with optional
  staff ownership for non-staff events.
- **ResortSettings** stores editable public resort information.
- **Login_Attempts**, **Auth_Verification_Codes**, and
  **PasswordResetTokens** support staff throttling, customer verification, and
  password recovery.
- **Chatbot_Faqs**, **Chatbot_Knowledge**, **Chatbot_Unanswered**,
  **Chatbot_Conversations**, and **Chatbot_Messages** support chatbot content,
  unanswered questions, and customer-owned conversation history.
- Foreign keys connect related records; reservation history and payment rows
  remain linked to their reservation for operational traceability.
- Most booking and payment amounts use MySQL `DECIMAL` columns in currency
  units; inventory charges use integer centavos.
- Business calculations convert amounts to integer centavos before arithmetic
  and convert back for display, reducing rounding errors.
- Extra-bed, package, venue, and inventory details are snapshotted where needed
  so later management edits do not silently rewrite a past booking.

## 5. Core features

### Public site

#### Room and venue browsing

- **What:** visitors can browse available rooms and venues with prices,
  capacity, amenities, photos, and filters.
- **How:** the browser loads room and venue records from public API routes.
- **How:** identical rooms and numbered day-use cottages are grouped into
  representative cards with available-unit counts.
- **Rule:** unavailable and maintenance units do not count as available; a
  group without available units is hidden from the public catalog.

#### Availability calendar

- **What:** visitors can select room dates or a venue event date.
- **How:** calendars request booked-date data from the API and disable blocked
  dates or date ranges.
- **How:** room stays use check-in and check-out dates; day-use venues occupy
  one date; packaged halls use a time window.
- **Rule:** online reservations require a date at least one day ahead in
  Asia/Manila; staff walk-ins may be same-day.

#### Chatbot

- **What:** guests and customers can ask questions and get help with resort
  information and booking choices.
- **How:** the API uses FAQs, resort knowledge, live room/venue information, and
  an external language-model client.
- **How:** registered customers can access saved conversation history; guests
  have a separate guest-message route.
- **How:** customer chat gathers missing booking details, reviews room rates or
  server venue quotes, then creates a hold after explicit confirmation.
- **Rule:** guests cannot book through chat; customers receive a payment link
  after confirmation, and chat never takes payment.

### Booking and payment

#### Online reservation flow

- **What:** a guest or customer chooses a room or venue, provides details, and
  submits proof of payment.
- **How:** the API checks availability, calculates the final price, and creates
  a reservation; customer chat offers that hold flow after confirmation.
- **How:** guests receive a reservation-specific access token.
- **How:** the token allows an unauthenticated guest to access only that
  reservation’s protected details and payment upload.
- **Rule:** guests may book without an account; venue prices and quotes are
  calculated by the server.

#### Temporary holds and abuse caps

- **What:** a selected resource is held temporarily while booking details and
  payment are completed.
- **How:** the API locks the resource, checks conflicts, and creates a
  `payment_pending` reservation.
- **How:** expired holds are cleaned up; visitor caps are serialized using a
  MySQL advisory lock.
- **Rule:** holds last 15 minutes by default; active holds cap at two per
  visitor, six per IP, and three pending-verification reservations per visitor.

#### Deposits and online proof

- **What:** customers submit a deposit proof for staff review.
- **How:** the browser uploads an image; the API stores it in Cloudinary and
  creates a payment awaiting verification.
- **How:** staff acceptance or decline updates the payment and reservation,
  writes an audit record, and triggers a best-effort customer email.
- **Rule:** the deposit is 50% and non-refundable; the remaining balance is
  collected by staff.

#### Walk-in bookings and payments

- **What:** receptionists and administrators can book available rooms or venues
  for in-person guests.
- **How:** the API locks the chosen resource, checks availability, calculates
  the total, and records a confirmed reservation and verified payment.
- **How:** staff may attach a receipt image for payment methods that require
  one; cash and card do not require an image.
- **Rule:** a walk-in is marked `walk-in` and does not use visitor hold caps.

#### Extra beds and attendance fees

- **What:** staff can add approved extra beds and calculate early check-in or
  late check-out charges.
- **How:** the server validates configured room limits and stores additions
  against the reservation.
- **How:** early or late time is compared with the standard time in
  Asia/Manila; fees are rounded up by started hour.
- **Rule:** extra beds cost PHP 450 each; the room cap is at most 20 and each
  request can add at most 10.

#### Room inventory checkout inspection

- **What:** staff record a signed room-item inspection during checkout.
- **How:** staff mark checklist quantities and conditions; a missing item uses
  the stored charge snapshot to calculate the billed amount.
- **How:** an inspection signature is uploaded, and inspection lines and totals
  are saved with the reservation.
- **Rule:** checkout requires an inspection and settled amounts due; charges
  are collected through the normal balance payment.

### Admin and staff

#### Dashboard and reservations

- **What:** staff see operational counts, recent bookings, and reservation
  records.
- **How:** the dashboard combines database aggregates; reservations support
  lookup by reference and display-safe lists.
- **How:** staff can scan a reservation QR or look up its booking reference.
- **Rule:** receptionists and administrators can manage attendance; bookings
  retain their stored history.

#### Payments

- **What:** authorized staff review online proofs and collect reservation
  balances.
- **How:** payment review records the decision, reviewing staff, and audit
  details.
- **How:** balance collection locks the reservation, recalculates the amount,
  and requires the exact outstanding amount.
- **Rule:** balances require a verified deposit; cancelled or completed
  reservations are not open for ordinary balance collection.

#### Rooms and venues management

- **What:** administrators maintain rooms, cottages, halls, and their public
  booking details.
- **How:** room and venue forms support single creation, multiple creation,
  duplication, and selected-field bulk edits.
- **How:** room bulk creation accepts 1–50 room numbers; bulk editing selects
  at most 100 records.
- **Rule:** admin UI deactivates rather than hard-deletes resources; venue
  duplication does not copy packages.

#### Customers, reports, and PDF export

- **What:** administrators manage customer records; staff review operational
  and revenue reports.
- **How:** reports aggregate reservations and verified payments by date,
  method, type, source, room, and venue.
- **How:** administrators can export a PDF income report; the export uses
  PDFKit and is rate limited.
- **Rule:** recorded revenue counts verified payment rows; unpaid balances are
  reported separately.

#### Chatbot management

- **What:** administrators maintain FAQs, editable knowledge topics, and
  unanswered-question follow-up.
- **How:** management routes support editing, ordering, promotion, dismissal,
  and statistics.
- **How:** chatbot conversations shown to staff use a privacy-limited display
  that omits contact details.
- **Rule:** chatbot management is administrator-only; it depends on its
  required database tables.

#### Audit logs, settings, and staff accounts

- **What:** administrators review system activity and manage resort
  information, payment methods, and staff accounts.
- **How:** important changes write audit entries; settings and staff updates
  use authenticated API routes.
- **How:** staff password reset generates a temporary password and requires a
  change at the next login.
- **Rule:** staff accounts live in `Users`; receptionists cannot access
  administrator-only management screens.

### Customer portal

#### Registration, login, Google sign-in, and recovery

- **What:** customers can create accounts and sign in with a password or
  verified Google identity.
- **How:** registration and configured login verification use one-time codes;
  recovery uses single-use reset tokens.
- **How:** Google ID tokens are checked by the backend; sign-in creates or
  matches customer records.
- **Rule:** registration requires age 18 or older; customer password length is
  8–128 characters.

#### Reservations and reviews

- **What:** customers can view their reservation history and submit eligible
  guest reviews.
- **How:** portal pages fetch account-owned reservations and show payment,
  status, and reservation details.
- **How:** reviews are linked to a customer and reservation and refresh in
  shared portal state after submission.
- **Rule:** reviews are allowed only for completed reservations; a reservation
  can be reviewed once per customer.

### Notifications and email

#### Staff notifications

- **What:** staff receive live alerts for selected online booking events.
- **How:** an authenticated Server-Sent Events stream delivers reservation
  creation and payment-proof events.
- **How:** the event contains display-safe booking, guest, and resource details.
- **Rule:** notifications are ephemeral and do not include walk-in, balance, or
  payment-review events.

#### Transactional emails

- **What:** customers receive reservation, payment-decision, verification, and
  account emails.
- **How:** the backend sends through SMTP and may retry through Brevo’s HTTP
  API when configured.
- **How:** accepted-payment messages can include a reservation check-in QR.
- **Rule:** ordinary reservation and payment emails are best-effort; verification
  code delivery must succeed for that verification flow.

## 6. Reservation lifecycle

- **`payment_pending`:** an online booking creates a temporary hold; a walk-in
  is not created in this state.
- **`pending_verification`:** a customer uploads online payment proof; the
  reservation waits for staff review.
- **`confirmed`:** staff accept a deposit proof, or staff create a walk-in with
  its verified payment.
- **`checked_in`:** staff check in an eligible confirmed room reservation.
- **`completed`:** staff check out a checked-in room reservation after required
  inspection and balance checks.
- **`cancelled`:** the expiry job cancels an online payment hold that expired.
- **`rejected`:** staff decline a submitted payment proof.
- **`no_show`:** the system job marks an un-attended confirmed reservation
  after its scheduled end has passed.
- Status history records the actor as customer, staff, or system with each
  recorded transition.

| Current status | Event or decision | Resulting status | Trigger |
|---|---|---|---|
| New booking | Online reservation or hold created | `payment_pending` | Customer or guest |
| New booking | Walk-in created with verified full payment | `confirmed` | Staff |
| `payment_pending` | Payment proof submitted | `pending_verification` | Customer or authorized staff |
| `payment_pending` | Hold expires | `cancelled` | Expiry job |
| `pending_verification` | Proof accepted | `confirmed` | Staff |
| `pending_verification` | Proof declined | `rejected` | Staff |
| `confirmed` | Eligible room guest arrives | `checked_in` | Staff |
| `checked_in` | Checkout completed | `completed` | Staff |
| `confirmed` | Scheduled end passes without check-in | `no_show` | No-show job |

## 7. Security

### Authentication and sessions

- **What it protects against:** stolen or guessed credentials being reused as
  unrestricted sessions.
- The API signs **JWTs** and stores its login token in an **httpOnly cookie**,
  which browser scripts cannot read.
- Staff sessions last eight hours by default; customer sessions last one day.
- Login is **portal-scoped**: staff authenticate against `Users`; customers
  authenticate against `Customer`.
- New or reset staff accounts must change their password at next login.
- Staff passwords require 10–128 characters, cannot match account identity or
  common-password checks, and use bcrypt cost 12.
- Customer passwords require 8–128 characters; customer auth cookies use the
  same HttpOnly cookie name.
- **Google sign-in** is accepted only after backend verification of the
  customer’s identity token and verified email.

### Authorization

- **What it protects against:** users invoking actions outside their assigned
  role or account ownership.
- Backend routes use **role-based access control**; frontend route guards only
  improve navigation and are not the security boundary.
- Administrators manage resources and accounts; receptionists access the
  documented operational routes.
- Staff requests check the current database role and active status; role
  changes and deactivation affect subsequent requests.
- Reservation access checks staff role, customer ownership, or a
  reservation-specific guest token.

### Brute-force and abuse protection

- **What it protects against:** repeated login guessing, excessive API
  requests, and reservation hold hoarding.
- Customer login allows 10 requests per minute per IP and email/IP key;
  staff login allows 5 per minute and 30 per hour per IP.
- Five consecutive staff login failures trigger a 15-minute email cooldown,
  escalating to 30 and then 60 minutes.
- Reservation creation allows 10 requests per 60 minutes per resolved IP;
  payment-proof uploads allow five per minute per IP.
- Online visitors are capped at two active holds, six active holds per IP, and
  three unreviewed reservations per visitor by default.
- **Why both visitor and IP caps:** visitor identity is primary; the more
  generous IP cap is secondary because guests may share Wi-Fi or carrier NAT.

### Request safety

- **What it protects against:** cross-site request abuse, unsafe uploads, and
  malformed or injected database input.
- Credentialed CORS allows only configured origins; unsafe methods reject
  untrusted `Origin` or `Referer` headers.
- Helmet sets security headers, including frame blocking and no-referrer;
  production HTTPS responses receive HSTS.
- Controllers validate inputs and use parameterized SQL for request values.
- Image uploads accept JPEG, PNG, and WebP with a 5 MB limit.

### Data privacy

- **What it protects against:** unnecessary exposure of account, guest, or
  operational data.
- API responses use display-safe mappings; password hashes are not returned.
- Staff login attempts store a SHA-256 hash of normalized email, not raw email
  as the lookup key.
- Chatbot administration omits customer contact details from conversation
  displays.
- Important management and booking actions are recorded in audit logs.

### Transaction safety

- **What it protects against:** double bookings, inconsistent payment totals,
  and concurrent requests exceeding visitor limits.
- A **transaction** groups related database changes so they commit together or
  roll back together.
- Booking code locks the room or venue before checking conflicts and creating a
  reservation.
- Payment and inspection actions use database row locks while checking and
  updating reservation totals.
- MySQL advisory locks serialize visitor-cap checks across concurrent requests
  handled by the database.

## 8. Reliability and operations

- The expired-hold cleanup runs on startup and every 60 seconds in the API
  process.
- The no-show job runs on startup and every 15 minutes in the API process.
- The API exposes `GET /healthz`, which returns an HTTP 200 status response.
- Startup checks production security settings and warns or stops on unsafe
  configuration.
- Startup executes schema creation for missing tables, but it does not execute
  files in `backend/migrations/`.
- Existing databases need reviewed manual migrations; missing optional schema
  features may be reported as unavailable rather than silently written.
- The reservation visitor-cap feature requires the manual
  `20261017_add_reservation_visitor_key.sql` migration on existing databases.
- Deployment guidance calls for a database backup before migration; automatic
  backups are not implemented by this application.
- The frontend build uses `VITE_API_URL`; an empty value uses Vite’s local-only
  `/api` proxy during development.

### Environment variable names

- `VITE_API_URL` selects the API base address for the built frontend.
- `VITE_GOOGLE_CLIENT_ID` controls customer Google sign-in UI configuration.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` identify the
  backend database connection.
- `DB_SSL` and `DB_SSL_CA` configure verified MySQL TLS.
- `JWT_SECRET` signs authentication and access tokens.
- `COOKIE_SECURE`, `COOKIE_SAMESITE`, and `STAFF_SESSION_HOURS` configure
  browser sessions.
- `ALLOWED_ORIGINS`, `FRONTEND_URL`, and `TRUST_PROXY_HOPS` configure request
  origin handling and client-IP resolution.
- `STAFF_LOGIN_IP_PER_MINUTE` and `STAFF_LOGIN_IP_PER_HOUR` configure staff
  login IP limits.
- `MAX_ACTIVE_HOLDS_PER_VISITOR`, `MAX_ACTIVE_HOLDS_PER_IP`, and
  `MAX_UNREVIEWED_PER_VISITOR` configure reservation caps.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET` configure image storage.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_NAME`, and
  `MAIL_FROM_EMAIL` configure email sending.
- `BREVO_API_KEY` enables the Brevo HTTP email fallback.
- `GOOGLE_CLIENT_ID` configures backend Google token verification.
- `LLM_PROVIDER`, `LLM_FALLBACK_PROVIDER`, `GROQ_API_KEY`, and
  `OPENROUTER_API_KEY` configure chatbot model access.
- `CHATBOT_MAX_TOKENS`, `CHATBOT_TIMEOUT_MS`, and
  `CHATBOT_MODEL_COOLDOWN_MS` configure chatbot request behavior.

## 9. Known limitations and trade-offs

- The API rate limiter, notification hub, IP hold counter, and expiry cleanup
  are process-local; deployment assumes a single backend instance.
- Multiple API instances would not share in-memory rate limits or live
  notifications; scheduled cleanup could also run in each instance.
- There is no customer-facing cancellation, refund, rebooking, rescheduling, or
  date-change workflow; bookings are final under the current policy.
- The visitor hold identity is stored in a browser cookie; losing it weakens
  guest-level continuity, so the separate IP cap is only secondary protection.
- The application requires manually applied migrations for existing databases;
  startup does not automatically alter existing tables.
- Legal review and mobile/logged-in policy-page browser checks remain pending
  in the public context documentation.
- Public venue calendar response shapes and full payment-proof submission have
  not been verified in the documented live-browser checks.
- Admin chatbot verification requires its manual migration and a live database.
- Staff reset/session invalidation needs live database and separate staff
  accounts for complete click-through verification.
- Income PDF totals, date extremes, pagination, receptionist denial, and
  currency glyph rendering still need live-database verification.
- The existing implementation has not demonstrated horizontal scaling or
  multi-instance coordination for process-local features.

## 10. Glossary

- **REST API:** A set of HTTP routes for exchanging structured data; KAIROS
  uses it to connect browser actions to server-side booking rules.
- **SPA:** A single-page application that changes screens without reloading the
  whole document; KAIROS uses this for its React frontend.
- **Three-tier architecture:** A design with interface, application, and data
  layers; KAIROS separates browser UI, API rules, and MySQL storage.
- **HTTP/HTTPS:** Web request protocols, with HTTPS encrypting traffic; KAIROS
  uses HTTPS for deployed frontend and API communication.
- **JWT:** A signed token containing claims; KAIROS uses JWTs for cookie
  sessions and guest reservation access.
- **httpOnly cookie:** A browser cookie unavailable to page JavaScript; KAIROS
  uses it to reduce exposure of authentication tokens.
- **CORS:** Browser rules for cross-origin requests; KAIROS limits credentialed
  frontend access to configured origins.
- **Rate limiting:** A cap on requests over time; KAIROS uses it to slow
  repeated login, booking, and upload attempts.
- **Transaction:** A group of database operations that commits or rolls back as
  one; KAIROS uses it to keep booking changes consistent.
- **Row lock:** A temporary database lock on selected records; KAIROS uses it
  to serialize conflicting booking and payment updates.
- **Advisory lock:** A named database lock chosen by application code; KAIROS
  uses it to serialize visitor hold-cap checks.
- **Parameterized query:** SQL with separate bound values; KAIROS uses it to
  keep request data separate from database commands.
- **RBAC:** Role-based access control; KAIROS uses roles to restrict staff and
  customer operations.
- **Hashing:** One-way conversion of data into a fixed digest; KAIROS uses it
  for passwords, login-attempt keys, and visitor identifiers.
- **TLS:** Encryption and identity checks for network connections; production
  KAIROS verifies TLS for its MySQL connection.
- **SSE:** Server-Sent Events, a one-way live update stream; KAIROS uses it
  for selected staff notifications.
- **HSTS:** A browser rule requiring future connections to use HTTPS; the API
  sends it for production HTTPS responses to reduce downgrade risks.
- **Migration:** A reviewed database-change script; KAIROS keeps existing
  database migrations manual.
- **CDN:** A distributed network that serves files near users; Vercel and
  Cloudinary deliver frontend assets and images.
- **SMTP:** A protocol for sending email between services; the API uses it for
  transactional email.
- **LLM:** A large language model that generates text; KAIROS connects one to
  its chatbot through a backend client.
- **Centavo arithmetic:** Converting currency to whole centavos before
  arithmetic; KAIROS uses it to reduce floating-point rounding errors.
- **Foreign key:** A database rule linking related records; KAIROS uses these
  to connect reservations with customers, resources, and payments.
- **No-show job:** A scheduled process that marks unattended confirmed
  bookings; KAIROS runs it every 15 minutes in the API process.

## 11. Likely panel questions

- **Why separate the frontend, API, and database?**
  - Each layer has a clear responsibility; sensitive validation stays on the
    API instead of trusting browser code.
- **Why use one customer table and a separate staff table?**
  - Staff permissions and customer booking identities differ, so the schema
    keeps their accounts and authorization paths separate.
- **Can a guest book without registering?**
  - Yes; guest contact details and a reservation-specific access token support
    booking and payment without a customer account.
- **How do you prevent two customers booking the same room?**
  - The API locks the resource, checks overlapping reservations, and creates
    the hold within a transaction.
- **How long is a room or venue hold?**
  - The configured default is 15 minutes; expiry cleanup releases it from
    availability by changing its status.
- **How do you prevent one visitor from holding many resources?**
  - Visitor holds are capped, checked under a database advisory lock, and
    supplemented by a more generous per-IP cap.
- **Why have a per-IP cap if guests may share an address?**
  - It is only secondary protection; the primary cap uses visitor identity to
    avoid relying solely on shared network addresses.
- **How is the online deposit calculated?**
  - The server calculates 50% using integer-centavo arithmetic; the deposit is
    non-refundable under the current policy.
- **Can staff create reservations if online payment is unavailable?**
  - Yes; authorized staff can create walk-ins and record an on-site verified
    payment.
- **Why use an external image service?**
  - Cloudinary stores and serves uploads; MySQL stores their references rather
    than image binary data.
- **What happens when an email provider fails?**
  - Ordinary notifications are best-effort; when configured, failed SMTP sends
    can retry through Brevo’s HTTP API.
- **What prevents customer accounts from opening admin functions?**
  - Backend routes check the authenticated identity and role; frontend guards
    are not the authorization boundary.
- **Can the system scale to multiple backend instances today?**
  - Not safely for every feature; rate limits, notifications, IP hold counts,
    and scheduled jobs currently use process-local state.
- **Are schema changes deployed automatically?**
  - No; startup creates missing tables but existing-database migrations are
    reviewed and applied manually after a backup.
