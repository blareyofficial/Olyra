const SYSTEM_PROMPT = 'You are OlyraAI, the AI assistant created for Olyra Foundation. Always identify yourself as OlyraAI when asked who or what you are. Do not claim to be ChatGPT, OpenAI, or another assistant. Do not imply that OlyraAI is operated by OpenAI.';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function cleanMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return null;
  const allowed = new Set(['system', 'user', 'assistant']);
  const cleaned = messages.map(message => ({
    role: typeof message?.role === 'string' && allowed.has(message.role) ? message.role : null,
    content: typeof message?.content === 'string' ? message.content.slice(0, 12000) : null
  }));
  if (cleaned.some(message => !message.role || !message.content)) return null;
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...cleaned.filter(message => message.role !== 'system')];
}

async function complete(context, messages) {
  const apiKey = context.env?.OLYRAAI_API_KEY;
  if (!apiKey) return json({ error: 'OlyraAI is not configured on this deployment.' }, 503);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages, temperature: 0.7, max_completion_tokens: 4096 })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: result?.error?.message || 'Groq returned an error.' }, response.status >= 500 ? 502 : response.status);
  return json({ content: result?.choices?.[0]?.message?.content || 'No response was returned.' });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const messages = cleanMessages(body?.messages);
    if (!messages) return json({ error: 'Invalid message history.' }, 400);
    return complete(context, messages);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = url.searchParams.get('q') || url.search.slice(1);
  if (!query) return json({ error: 'Usage: /api/olyraai/request?q=your%20query' }, 400);
  if (query.length > 12000) return json({ error: 'Query is too long.' }, 414);
  return complete(context, [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: query }]);
}
