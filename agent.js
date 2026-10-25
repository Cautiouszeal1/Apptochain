// Apptochain AI agents: Vercel serverless function.
// Set ANTHROPIC_API_KEY in Vercel > Project > Settings > Environment Variables.
// Optional: AGENT_MODEL (default claude-sonnet-5-5), AGENT_LIMIT_PER_HOUR (default 20 per visitor).

const MODEL = process.env.AGENT_MODEL || 'claude-sonnet-5-5';
const LIMIT = Number(process.env.AGENT_LIMIT_PER_HOUR || 20);
const hits = new Map();

function buildPrompt({ agent, token, notes, context, market }) {
  const base = 'You are an Apptochain AI agent for a Web3 project team. Write in plain English with short sentences. Use "## " for section headings and "- " for bullets. Never give financial advice and never tell anyone to buy or sell. Use only the data provided; when something needed is missing, say what is missing instead of inventing numbers.';
  const ctx = JSON.stringify(context);
  if (agent === 'research') return `${base}\n\nRole: Trading Research Agent.\nToken to research: ${token}\n\nLive market data from DexScreener (JSON, null if not found):\n${JSON.stringify(market)}\n\nMarket data and questions from the user:\n${notes || '(none supplied)'}\n\nProject workspace data (JSON; relevant if the token is the project's own):\n${ctx}\n\nWrite a research report under 380 words with these sections: ## Verdict (Constructive, Neutral or High risk, with one sentence why), ## Liquidity, ## Supply and holders, ## Volume and market conditions, ## Risks, ## What to watch next. Base it on the live data and the notes, and say what extra data would sharpen the view.`;
  if (agent === 'portfolio') return `${base}\n\nRole: Portfolio Agent.\nFocus from the user: ${notes || 'general review'}\n\nWorkspace data with live market and on-chain balances (JSON):\n${ctx}\n\nWrite a portfolio review under 320 words with sections: ## Summary, ## Concentration risk, ## Runway, ## Upcoming unlocks, ## Suggested actions (3 to 5 operational bullets).`;
  return `${base}\n\nRole: Web3 Operations Agent.\nNews to include: ${notes || '(none)'}\n\nWorkspace data with live market and on-chain balances (JSON):\n${ctx}\n\nWrite: ## Ops check (bullets: each risk found in the data and its fix), ## This week's checklist (4 to 6 bullets), ## Community update (ready to post on X and Telegram, under 120 words, factual and calm, covering liquidity, treasury and the next unlock, at most one emoji).`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method' }); }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  // simple per-visitor rate limit
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (recent.length >= LIMIT) return res.status(429).json({ error: 'rate_limited' });
  recent.push(now); hits.set(ip, recent);

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || !['research', 'portfolio', 'ops'].includes(body.agent)) return res.status(400).json({ error: 'bad_request' });
  const payload = {
    agent: body.agent,
    token: String(body.token || '').slice(0, 120),
    notes: String(body.notes || '').slice(0, 6000),
    context: body.context && typeof body.context === 'object' ? body.context : {},
    market: body.market && typeof body.market === 'object' ? body.market : null
  };
  const prompt = buildPrompt(payload);
  if (prompt.length > 60000) return res.status(413).json({ error: 'too_large' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1600, messages: [{ role: 'user', content: prompt }] })
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('AI error', r.status, j && j.error);
      return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? 'rate_limited' : 'upstream_error' });
    }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) return res.status(502).json({ error: 'empty_completion' });
    return res.status(200).json({ text, truncated: j.stop_reason === 'max_tokens' });
  } catch (e) {
    console.error('AI request failed', e);
    return res.status(502).json({ error: 'upstream_error' });
  }
};
