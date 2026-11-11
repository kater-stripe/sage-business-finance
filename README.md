# Sage Business Finance — source backup

Source snapshot: 444feb8.

This archive contains the demo source, dependency lockfile, genuine Sage assets and configuration. It excludes Stripe credentials, Git history/authentication, workspace records, browser cookies, test artifacts and installed dependencies.

## Continue in your own GitHub repository
1. Unzip this folder.
2. Create a new PRIVATE repository in your GitHub account.
3. Upload the extracted files (including dotfiles), not just this ZIP. Alternatively use GitHub Desktop to publish the folder.
4. Never upload a real .env file, credentials or workspace data.

## Run locally
Use a currently supported Node.js version compatible with Next.js 15 (Node 22 LTS recommended).

```bash
npm ci
cp .env.example .env
npm run dev
```

Add your sandbox keys to .env before using Stripe features. Open http://localhost:3424.

IMPORTANT: The boilerplate has private GitHub dependencies (@demoeng/tools-panel and @demoeng/utils). Installing them requires authorized Stripe GitHub access. This ZIP backs up your source; it does not grant access to those separate repositories. If npm ci reports repository-not-found, request access to those dependencies from their owners.

## Stripe and demo boundaries
- Existing implementation: UK/GBP, Accounts v2, direct-charge Payments, Elements with Checkout Sessions, no automatic tax/adaptive pricing.
- Stripe SDK uses 2026-05-27.dahlia; Money Management uses 2026-09-30.preview. Sandbox enrollment, previews and gates must be available on the account used. Credentials alone do not provision those features.
- Real sandbox financial accounts, funding and recipient payments; employee cards are an explicitly simulated preview, not real Issuing.
- Working capital defaults to an explicitly simulated £20,000 example offer automatically seeded per signed-up workspace, including after Restart. The Sage-branded amount/fee, business confirmation, review, application status, example funding and repayment journey persists locally. No real credit, guarantee, lender application, bank transfer or financial ledger entry is created. Example terms are illustrative, not a lender quote. A separately labelled actual-financing view retains the real UK Capital for Platforms integration; the current UK sandbox customer has no offer, and the API test-offer helper does not support GB accounts. Real Capital requires platform enrollment/component gates and uses 2026-09-30.preview with embedded_connect_beta=v2 and exact preview SDK versions in the lockfile.
- No Stripe objects or local workspace records are copied by this archive. Downloading/re-uploading the source does not migrate financial or onboarding history. Keep using the appropriate existing sandbox to retain its Stripe-side objects.
- Local workspace storage is demonstration-only, not durable/multi-instance production storage.
- Webhook processing requires a configured endpoint and STRIPE_WEBHOOK_SECRET. Existing polling reads actual Stripe state.
- Preserve noindex/nofollow and robots protections.

```bash
npm run types
npm run build
```

This is an internal demonstration, not a production-ready financial application. Keep the repository private.
