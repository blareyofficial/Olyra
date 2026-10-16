const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function onRequestGet(context) {
  const key = context.env?.KLIPY_API_KEY;
  if (!key) return json({ error: 'GIF search is not configured yet.' }, 503);
  const query = new URL(context.request.url).searchParams.get('q')?.trim();
  if (!query || query.length > 100) return json({ error: 'Enter a GIF search term up to 100 characters.' }, 400);
  try {
    const endpoint = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(key)}/gifs/search`);
    endpoint.search = new URLSearchParams({ q: query, per_page: '18', content_filter: 'high', format_filter: 'gif' }).toString();
    const response = await fetch(endpoint);
    if (!response.ok) return json({ error: 'KLIPY GIF search is temporarily unavailable.' }, 502);
    const body = await response.json();
    if (!Array.isArray(body.data?.data)) return json({ error: 'KLIPY returned an invalid GIF search response.' }, 502);
    const results = body.data.data.flatMap((gif) => {
      const url = gif.file?.hd?.gif?.url;
      const preview = gif.file?.sm?.webp?.url || gif.file?.sm?.gif?.url;
      if (typeof url !== 'string' || typeof preview !== 'string') return [];
      try {
        const gifUrl = new URL(url);
        const previewUrl = new URL(preview);
        if (gifUrl.protocol !== 'https:' || previewUrl.protocol !== 'https:' || gifUrl.hostname !== 'static.klipy.com' || previewUrl.hostname !== 'static.klipy.com') return [];
      } catch {
        return [];
      }
      return [{ url, preview, title: String(gif.title || '').slice(0, 160) }];
    });
    return json({ results });
  } catch {
    return json({ error: 'KLIPY GIF search is temporarily unavailable.' }, 502);
  }
}
