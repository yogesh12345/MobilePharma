# Linux customer-selection incident, 2 November 2026

The first screenshot showed an Orders-only launcher while localhost showed
four customer choices. The Linux source files and binary already contained
the current internal-customer assignment code. The public API was actually
served by an older PM2 process named `Backend-recovery`, started on 1 November.
It held port 8081, while the updated `goapp.service` repeatedly failed to bind.

On 2 November the older PM2 process was stopped and removed from PM2's saved
startup list. `goapp.service` now owns port 8081 and responds through the
public hostname. Its source files for `MobileInternalCustomers` match the local
backend by SHA-256. The previous PM2 dump was backed up at
`/home/pharma/.pm2/dump.pm2.backup-20261102`.

The current MobilePharma build was copied to `/var/www/mobilepharma/`. The
previous web root is backed up at
`/home/pharma/Mobile/backup-20261102-before-customer-selection/`. Public
`index.html` now references `/assets/index-3EMNoFIy.js`, and that asset returns
HTTP 200. The unauthenticated public `/mobile/access` route returns JSON 401,
as expected.

The production database is the same `Pharma` database used by localhost. The
YRB account is active and internal, with four active mappings to the customer
names shown in the localhost screenshot. With the corrected backend process,
YRB should receive those four customers from `GET /mobile/access` and see the
customer selector after a reload. If the production tab still shows Orders,
confirm that it is signed in as YRB; browser origins keep separate sessions.
Compare the authenticated `/mobile/access` responses if needed. Do not share
the authorization token.

The earlier `mobile-internal-customer-parity.patch` is **not needed on this
server**. Its changes are already in the Linux source and running binary.
