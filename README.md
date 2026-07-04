# AppToChain Agents

On-chain monitoring agents for BNB Smart Chain — no-code rule engine, live alerts, tokenomics, whitepaper, pitch deck, and a live web-connected AI assistant. Static site + one serverless function.

## Deploy
1. Push this folder to GitHub (index.html, api/chat.js, README.md)
2. Import in Vercel — framework "Other", no build command
3. Vercel → Project → Settings → Environment Variables → add ANTHROPIC_API_KEY
   (get one at console.anthropic.com → API Keys). Redeploy.

## Config inside index.html
- WALLETCONNECT_PROJECT_ID — free ID from cloud.reown.com (enables WalletConnect QR)
- EMAILJS_CONFIG — optional, enables email alerts

## Notes
- The AI assistant calls /api/chat (the included serverless function) which holds your API key server-side — the key is never exposed to visitors.
- User database is per-device on static hosting; wire Supabase for a global cross-user DB.
