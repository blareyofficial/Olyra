const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const randomSuffix = (length = 6) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('');
};
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) return json({ error: 'Missing room URL.' }, 400);
    const target = new URL(rawUrl, context.request.url);
    if (!['http:', 'https:'].includes(target.protocol) || !target.pathname.startsWith('/tools/chat')) return json({ error: 'Invalid Olyra Chat URL.' }, 400);
    if (!target.searchParams.get('room') || !target.hash.slice(1)) return json({ error: 'The room URL is missing its encryption key.' }, 400);

    for (let attempt = 0; attempt < 5; attempt++) {
      const shorturl = `olyralink${randomSuffix(6)}`;
      const response = await fetch('https://is.gd/create.php?format=json&url=' + encodeURIComponent(target.toString()) + '&shorturl=' + encodeURIComponent(shorturl));
      if (!response.ok) continue;
      const result = await response.json().catch(() => ({}));
      if (result.shorturl) return json({ shortUrl: result.shorturl });
      if (String(result.errorcode) !== '2') return json({ error: result.errormessage || 'The URL shortening service is unavailable.' }, 502);
    }
    return json({ error: 'Could not reserve a unique Olyra Chat link. Please try again.' }, 503);
  } catch {
    return json({ error: 'Unable to create a share link right now.' }, 400);
  }
}
