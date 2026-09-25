const decodeQuery = (raw) => {
  try { return decodeURIComponent(raw.replace(/\+/g, '%20')); }
  catch { return null; }
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (url.pathname === '/api/olyraai/request') {
    url.pathname += '/';
    return Response.redirect(url.toString(), 308);
  }
  const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : '';

  if (!rawQuery) return new Response('Usage: /api/olyraai/request?your%20query%20here', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

  const query = decodeQuery(rawQuery);
  if (query === null) return new Response('Invalid URL encoding.', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  if (query.length > 4000) return new Response('Query is too long (maximum 4000 characters).', { status: 414, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

  const safeQuery = JSON.stringify(query).replace(/</g, '\\u003c');
  const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OlyraAI API</title><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script><style>body{margin:0;padding:32px;font:16px system-ui,sans-serif;line-height:1.6;background:#08080c;color:#fff}main{max-width:900px;margin:auto;overflow-wrap:anywhere}.label{opacity:.55;font-size:12px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px}.markdown pre{padding:12px;border-radius:10px;overflow:auto;background:rgba(0,0,0,.35)}.markdown :not(pre)>code{padding:2px 5px;border-radius:5px;background:rgba(127,127,127,.18)}.markdown blockquote{margin:10px 0;padding-left:12px;border-left:3px solid rgba(255,255,255,.25)}.markdown table{border-collapse:collapse;width:100%}.markdown th,.markdown td{border:1px solid rgba(255,255,255,.15);padding:6px 9px}.markdown a{color:inherit}</style></head><body><main><div class="label">OlyraAI</div><div id="output" class="markdown">Thinking…</div></main><script src="https://js.puter.com/v2/"></script><script>const output=document.getElementById("output");const query=' + safeQuery + ';const history=[{role:"system",content:"You are OlyraAI, the AI assistant created for Olyra Foundation. Always identify yourself as OlyraAI when asked who or what you are. Do not claim to be ChatGPT, OpenAI, or another assistant. Do not imply that OlyraAI is operated by OpenAI. You are powered through Puter.js, but Puter.js is only the service interface and should not be presented as your identity."},{role:"user",content:query}];(async()=>{try{const response=await puter.ai.chat(history,{model:"gpt-5.6-luna"});const text=response?.message?.content??response?.text??response??"No response.";output.innerHTML=marked.parse(String(text),{breaks:true,gfm:true})}catch(error){output.textContent="OlyraAI error: "+(error?.message||String(error))}})();</script></body></html>';

  return new Response(page, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
