const localFiles = new Map();
const roomPattern = /^[A-Za-z0-9_-]{8,64}$/;
const filePattern = /^[A-Za-z0-9_-]{24}$/;
const maxBytes = 10 * 1024 * 1024;
const maxEncodedLength = Math.ceil((maxBytes + 16) * 4 / 3);
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get('room');
  const id = url.searchParams.get('id');
  if (!roomPattern.test(room || '') || !filePattern.test(id || '')) return json({ error: 'Invalid file request.' }, 400);
  const kv = context.env?.CHAT_ROOMS;
  const file = kv ? await kv.get(`chat-file:${room}:${id}`, 'json') : localFiles.get(`${room}:${id}`);
  if (!file) return json({ error: 'This file has expired or is unavailable.' }, 404);
  return json(file);
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid file request.' }, 400);
  }
  if (!roomPattern.test(body?.room || '') || typeof body.iv !== 'string' || !/^[A-Za-z0-9_-]{16}$/.test(body.iv) || typeof body.data !== 'string' || body.data.length < 22 || body.data.length > maxEncodedLength || !/^[A-Za-z0-9_-]+$/.test(body.data)) {
    return json({ error: 'Invalid encrypted file.' }, 400);
  }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[byte & 63]).join('');
  const file = { iv: body.iv, data: body.data };
  const key = `chat-file:${body.room}:${id}`;
  const kv = context.env?.CHAT_ROOMS;
  try {
    if (kv) await kv.put(key, JSON.stringify(file), { expirationTtl: 86400 });
    else localFiles.set(key.slice('chat-file:'.length), file);
    return json({ id });
  } catch {
    return json({ error: 'Encrypted file storage is temporarily unavailable.' }, 503);
  }
}
