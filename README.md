# AppToChain Agents

On-chain monitoring agents for BNB Smart Chain — no-code rule engine, real-time alerts, tokenomics, whitepaper, and pitch deck. Single-file static site.

## Deploy
Static site, zero build step. Push to GitHub, import in Vercel, done.

## Before going live
- `WALLETCONNECT_PROJECT_ID` in index.html — free ID from cloud.walletconnect.com (enables mobile WalletConnect)
- `EMAILJS_CONFIG` in index.html — optional, enables email alerts
- User database is per-device on static hosting; wire Supabase for a global cross-user DB and admin-only access
