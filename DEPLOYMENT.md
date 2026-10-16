# Production deployment

Production topology:

- Frontend: Vercel, `https://bookkaiazul.live` and
  `https://www.bookkaiazul.live`.
- API: Render, `https://api.bookkaiazul.live`.
- Database: Aiven MySQL with TLS certificate validation.
- Monitoring: UptimeRobot polling `https://api.bookkaiazul.live/healthz`.
- DNS remains hosted at name.com.

The frontend calls the API directly using the build-time `VITE_API_URL`.
`KAIROS/vercel.json` contains only the SPA fallback and frontend security headers; it
does not rewrite `/api` to Render. The API cookie is host-only on
`api.bookkaiazul.live`; do not set a cookie `Domain`.

## 1. DNS at name.com

Keep name.com authoritative nameservers unless you intentionally move DNS.
Before adding records, remove conflicting apex/www/API A, AAAA, or CNAME records.
Use a 300-second TTL during setup when available, then raise it after validation.

1. In Vercel, import the repository and set the project Root Directory to
   `KAIROS`. Use the Vite build command `npm run build` and output directory
   `dist`. Add both `bookkaiazul.live` and `www.bookkaiazul.live` under the
   project's Domains. Vercel displays the DNS records and any verification TXT
   records it currently requires.
2. In name.com DNS management, add the Vercel apex record:
   - Type `A`, host `@`, value `76.76.21.21`.
   - Type `CNAME`, host `www`, value `cname.vercel-dns.com`.
   If Vercel's Domains panel gives different or additional records, use its
   displayed values; its current instructions take precedence. Add any TXT
   verification record exactly as displayed.
3. In Render, create a Node web service from this repository. Set its Root
   Directory to `backend`, its build command to `npm ci`, and its start command
   to `npm start`. Add `api.bookkaiazul.live` as a custom domain in the Render
   service settings and wait for Render to issue its TLS certificate.
4. In name.com add the API record Render specifies. Render commonly provides:
   - Type `CNAME`, host `api`, value `<your-render-service>.onrender.com`.
   Use the exact target displayed by Render for this service; do not proxy this
   record through another CDN. Add Render's requested verification record if
   shown.
5. Wait for DNS/TLS verification at both providers. Confirm the apex, `www`,
   and `api` resolve to the configured providers and serve valid HTTPS before
   enabling production credentials.

## 2. Vercel environment

Set these for **Production** in Vercel Project Settings → Environment Variables.
Do not add database, email, JWT, or other backend secrets to Vercel.

| Name | Production value / handling |
|---|---|
| `VITE_API_URL` | `https://api.bookkaiazul.live` |
| `VITE_GOOGLE_CLIENT_ID` | OAuth web client ID (public identifier) |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Browser key restricted by HTTP referrer to `https://bookkaiazul.live/*` and `https://www.bookkaiazul.live/*` |
| `VITE_RESORT_LAT` | Resort latitude |
| `VITE_RESORT_LNG` | Resort longitude |
| `VITE_RESORT_HEADING` | Map heading |
| `VITE_RESORT_PITCH` | Map pitch |
| `VITE_RESORT_FOV` | Map field of view |

Set `VITE_API_URL` for the Production environment and redeploy after changing
it; Vite embeds it at build time. Do not set production API credentials on
Preview deployments. `api.bookkaiazul.live` allows credentials only from the
two production frontend origins, so `*.vercel.app` previews are not trusted.

## 3. Render environment

Set these in Render's service Environment settings. Store secrets only in
Render's secret environment variables; never commit them, put them in Vercel,
or paste them into logs/issues.

| Name | Required value / handling |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Leave to Render |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Aiven connection values |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | Aiven CA PEM, stored as a secret; preserve/escape newlines as `\n` if required by the dashboard |
| `JWT_SECRET` | Random secret of at least 32 characters; do not reuse another environment's value |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Non-default initial administrator credentials |
| `FRONTEND_URL` | `https://bookkaiazul.live` |
| `ALLOWED_ORIGINS` | Exactly `https://bookkaiazul.live,https://www.bookkaiazul.live` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `lax` |
| `TRUST_PROXY_HOPS` | `1` for Render's single proxy hop |
| `DEBUG_CLIENT_IP` | Temporarily `true` for initial verification; set to `false` afterward |
| `STAFF_SESSION_HOURS` | `8` unless intentionally changed |
| `STAFF_LOGIN_IP_PER_MINUTE`, `STAFF_LOGIN_IP_PER_HOUR` | `5`, `30` |
| `ADMIN_APP_URL`, `PUBLIC_APP_URL` | `https://bookkaiazul.live` |
| `MAIL_FROM_NAME` | `Kai Azul Resort` |
| `MAIL_FROM_EMAIL` | `noreply@bookkaiazul.live` after verifying that address/domain with Brevo |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Brevo SMTP settings; port `587` with STARTTLS |
| `BREVO_API_KEY` | Brevo transactional email API key; used as fallback if SMTP fails |
| `GOOGLE_CLIENT_ID` | Same OAuth web client ID as the frontend |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `LLM_PROVIDER`, `LLM_FALLBACK_PROVIDER`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Only the provider values/keys actually enabled |
| `OPENROUTER_SITE_URL` | `https://bookkaiazul.live` |
| `CHATBOT_MAX_TOKENS`, `CHATBOT_TIMEOUT_MS`, `CHATBOT_MODEL_COOLDOWN_MS`, `CHATBOT_DAILY_MESSAGE_CAP`, `CHATBOT_GUEST_RATE_LIMIT_PER_MINUTE`, `CHATBOT_GUEST_RATE_LIMIT_PER_DAY`, `CHATBOT_GUEST_DAILY_CAP` | Set from reviewed backend defaults |

Render's `DEBUG_CLIENT_IP=true` diagnostic logs the socket peer, forwarded
chain, configured hop count, and resolved client IP. Verify real requests show
`trustProxyHops: 1`, the socket peer is Render's proxy, and `resolvedIp` is the
visitor address. Send two test requests with different forged leftmost
`X-Forwarded-For` values while preserving Render's appended visitor address;
the resolved IP must remain the actual visitor address and the per-IP limiter
must keep one bucket. Turn the diagnostic off after checking; it is not a public
endpoint.

## 4. Brevo sender DNS and email fallback

In Brevo, authenticate `bookkaiazul.live` as the sender domain and verify
`noreply@bookkaiazul.live`. Publish the exact DKIM CNAME/TXT records Brevo
displays in name.com DNS; DKIM selectors and target values are specific to the
Brevo account, so copy them verbatim. Publish/merge one SPF TXT record at `@`
that includes Brevo's current SPF include (currently `include:spf.brevo.com`).
Do not publish multiple SPF records; merge the include with any existing
authorized sender policy. Start DMARC monitoring with a TXT record at
`_dmarc` such as:

```text
v=DMARC1; p=none; rua=mailto:dmarc@bookkaiazul.live; adkim=r; aspf=r
```

Create and monitor the DMARC reporting mailbox before using it. Verify SPF,
DKIM, and DMARC show as authenticated in Brevo and on a received message before
moving DMARC from `p=none` to a stricter policy. Some hosting providers block
outbound SMTP; the backend retries a failed/unavailable SMTP send through
Brevo's HTTPS API when `BREVO_API_KEY` is configured. Routine booking and
password notification sends remain best-effort; verification-code delivery
still has to succeed to complete that verification flow.

## 5. Google sign-in and browser security

In Google Cloud Console, edit the OAuth 2.0 Web client:

- Authorized JavaScript origins:
  `https://bookkaiazul.live` and `https://www.bookkaiazul.live`.
- Authorized redirect URIs: add only the callback URI actually configured by
  this application/provider, if one is used; do not guess a callback path.
- Restrict the Google Maps browser key to the two HTTPS referrers listed in the
  Vercel environment table and only the Maps APIs used by the site.

`KAIROS/vercel.json` applies the SPA fallback and security headers to the frontend
only, including a `Content-Security-Policy-Report-Only` policy. Review browser
reports/console violations for the real sign-in, Maps, Cloudinary image, and
Google Fonts flows before considering enforcement. The API separately sends
its own security headers and `Cache-Control: no-store`; Vercel does not cache
the API because API traffic goes directly to Render.

The API cookie is `kairos_auth`, host-only for `api.bookkaiazul.live`, with
`HttpOnly`, `Secure`, `SameSite=Lax`, and no `Domain` attribute. Frontend
requests use `credentials: 'include'`; SSE uses `withCredentials: true`.
Credentialed CORS accepts exactly the apex and `www` HTTPS origins. Unsafe
methods with an untrusted `Origin` or `Referer` are rejected; the allowed
headers include `X-Reservation-Token`.

## 6. Aiven migrations and first deployment

1. Back up the Aiven database and verify the backup can be restored.
2. Create/select the target database in Aiven and set Render's database
   environment variables and Aiven CA, with `DB_SSL=true`. Production startup
   selects the existing `DB_NAME` and does not require `CREATE DATABASE`
   privileges. Never use `rejectUnauthorized: false`.
3. Apply required manual migrations to the intended database, in dependency
   order. Migration files do not contain `USE` and are run only against the
   selected database. Replace `AIVEN_CA_FILE`, `AIVEN_HOST`, `AIVEN_PORT`,
   `AIVEN_USER`, and `DB_NAME` with the Aiven connection values and CA file;
   these commands enable certificate verification and select the database
   explicitly, for example:

   ```text
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261005_add_reservation_attendance_fees.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261005_add_cash_card_payment_methods.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261005_make_audit_user_nullable.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261006_add_payment_type_to_payments.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261006_add_reservation_addons_and_bed_caps.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261014_add_chatbot_booking_faq.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261015_add_auth_verification.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261015_add_attendance_fee_collectors.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261016_add_no_show_status.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261016_add_staff_login_attempts.sql
   mysql --ssl-mode=VERIFY_CA --ssl-ca=AIVEN_CA_FILE --host=AIVEN_HOST --port=AIVEN_PORT --user=AIVEN_USER --password DB_NAME < backend/migrations/20261016_add_chatbot_unanswered_hash.sql
   ```

   The chatbot migration replaces an oversized unique index on the
   1000-character normalized question with a SHA-256 binary unique key. Apply it
   before deploying the updated chatbot controller to an existing database.
   It also creates the corrected table if it does not exist.

   Apply `20261014_drop_chatbot_kb.sql` only after confirming the legacy table
   is unused and its contents have been backed up. Reconcile this ordered list
   with the actual schema version already in Aiven; do not rerun non-idempotent
   migrations blindly. The `mysql` process should report the intended
   `DATABASE()` before and after applying each migration.
4. Create the initial admin with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
   `ADMIN_NAME` only after verifying they are non-default. Set its password
   change requirement and perform the forced change.
5. Add the Vercel Production environment variables, then deploy the frontend.
   Confirm its built `VITE_API_URL` points to the Render custom domain.
6. Deploy the Render service and verify health, logs, database TLS connection,
   startup security checks, and the temporary client-IP diagnostic.
7. Verify Brevo sender authentication, send a test email, then disable
   `DEBUG_CLIENT_IP`.

## 7. Post-deploy acceptance checklist

- Open `https://bookkaiazul.live` and `https://www.bookkaiazul.live`; verify
  both are HTTPS and SPA deep links load.
- In Chrome, Firefox, and Safari (including iOS Safari), log in and out as a
  customer, admin, and receptionist. Refresh and confirm the session persists;
  confirm staff forced-password change still works.
- Inspect `kairos_auth` in browser storage: Secure, HttpOnly, SameSite=Lax,
  host-only, and no Domain. Check login/logout and `/api/auth/me` responses
  have `Cache-Control: no-store`.
- Send requests from an untrusted origin (including a Vercel preview) and
  verify credentialed reads have no CORS permission and unsafe methods return
  `403`. Confirm `X-Reservation-Token` works for booking requests.
- Verify cross-origin admin SSE notifications connect and reconnect with the
  cookie; test a multipart payment proof and an admin image upload up to 5 MB.
- Test customer chatbot messages and verify no CSP report-only violations that
  break the chatbot or third-party integrations.
- Send reservation, password reset, and verification messages. Confirm receipt
  and inspect headers/results for SPF, DKIM, and DMARC alignment. Temporarily
  test the Brevo HTTP fallback if SMTP egress is blocked.
- Confirm `https://api.bookkaiazul.live/healthz` returns HTTP 200 and
  `{"status":"ok"}`; configure UptimeRobot to monitor that URL.
- Verify different visitors resolve to distinct client IPs and that the
  configured staff, reservation, and payment-proof limits are applied per
  visitor.

## 8. Rollback

1. If the frontend alone is unhealthy, promote the previous successful Vercel
   deployment and retain the working custom-domain assignments.
2. If the API is unhealthy, redeploy the previous successful Render deploy.
   Keep `DEBUG_CLIENT_IP=false` unless diagnosing a specific incident.
3. Do not attempt ad-hoc reverse SQL for a migration. For schema/data problems,
   pause writes when necessary and restore the pre-migration Aiven backup or
   follow a reviewed forward-fix plan.
4. For incorrect DNS, restore the last known-good name.com record values and
   allow TTL propagation. Do not remove valid TLS records/certificates while
   rolling back application code.
