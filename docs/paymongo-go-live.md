# PayMongo go-live

PayTsek uses a PayMongo-hosted Payment Link for each plan or credit checkout.
The app never receives a PayMongo secret key and the API never grants access
until a signed webhook confirms payment.

## One-time dashboard setup

1. In PayMongo **Settings → Developers**, copy the **live secret API key**.
2. In **Settings → Webhooks**, add this endpoint:
   `https://api.paytsek.online/v1/billing/webhooks/paymongo`
3. Subscribe only to `link.payment.paid` and save the endpoint secret PayMongo
   shows once.
4. In Vercel, on the `paytsek-api` project, set these Production and Preview
   environment variables:
   - `PAYMONGO_SECRET_KEY` — live secret API key
   - `PAYMONGO_WEBHOOK_SECRET` — webhook endpoint secret
   - `PAYMONGO_API_URL=https://api.paymongo.com`
5. Redeploy `paytsek-api`, then make a test payment with PayMongo test keys
   before using live keys. Test and live webhook endpoints are separate.

## Operational model

- **Monthly passes:** Solo (PHP 149) and Team (PHP 399) grant access for 30 days.
  Renewal is deliberately user-initiated, so PayTsek never stores a card or
  silently charges a customer.
- **Credit pack:** 500 records for PHP 99; credits never expire.
- **Owner control:** only an organization owner can start checkout or view the
  billing ledger. PayMongo's own Dashboard remains the browser-based payment,
  refund, payout, and settlement console.
- **Safety:** each checkout link is single-use, an incoming webhook is HMAC
  verified against the raw body, and duplicate deliveries are idempotent.
