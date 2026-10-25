# API reference

This page documents routes visible in the current repository. All paths are relative to the deployed Olyra origin. Error messages and edge behavior can change with the implementation; update this page when code changes.

## `POST /api/shorten`

Creates a short URL through is.gd.

**Request**
```json
{ "url": "https://example.com/a/path" }
```

**Success**
```json
{ "shortUrl": "https://is.gd/..." }
```

**Behavior**
- Accepts POST and OPTIONS.
- Validates URL syntax and permits only `http:` and `https:`.
- Rejects URL strings longer than 8,192 characters.
- Sends the normalized URL to is.gd.
- Returns `Cache-Control: no-store` and permissive CORS headers.
- Returns JSON errors for invalid input, upstream errors, or invalid upstream responses.

Typical status codes: `200` success, `400` invalid request, `405` unsupported method, `413` URL too long, `422` is.gd rejected the URL, `502` upstream unavailable or malformed response.

## `GET /tools/url/api?url=...&qrcode=yes`

Convenience endpoint for shortening a URL.

- `url` is required.
- If the value has no HTTP(S) prefix, HTTPS is added.
- `qrcode` enables a QR image URL for values `yes`, `true`, or `1`.
- Calls `/api/shorten` internally.

Success response resembles:
```json
{
  "ok": true,
  "url": "https://example.com/",
  "shortUrl": "https://is.gd/...",
  "qrCode": "https://api.qrserver.com/v1/create-qr-code/?..."
}
```

The `qrCode` field is omitted unless requested.

## `GET /api/chat?room=<room-id>&since=<number>`

Returns encrypted messages in a room with an ID greater than `since`.

- Room IDs must match `^[A-Za-z0-9_-]{8,64}$`.
- Missing or invalid room IDs return `400`.
- The endpoint returns records with their `id`, `iv`, and `data` fields; it does not decrypt them.
- Responses use `Cache-Control: no-store`.

The default `since` value is zero. Clients should remember the latest message ID and poll with that value to avoid reprocessing the entire retained history.

## `POST /api/chat`

Stores an encrypted message record.

**Request shape**
```json
{
  "room": "ROOM_IDENTIFIER",
  "iv": "BASE64URL_ENCODED_IV",
  "data": "BASE64URL_ENCODED_CIPHERTEXT"
}
```

- The room ID must match the room pattern.
- `iv` and `data` must be strings.
- The IV is limited to 64 characters and ciphertext data to 12,000 characters.
- Accepted records are appended and the room history is trimmed to the latest 200 messages.
- When `CHAT_ROOMS` is bound, the room record is stored with a 24-hour TTL.
- Invalid JSON or invalid message fields return `400`.

The client encrypts a JSON message payload before sending it. The server stores the opaque encrypted values and does not decrypt them.

## `POST /api/chat/share`

Creates a short invite URL for an Olyra Chat room.

**Request**
```json
{ "url": "https://your-olyra-origin/tools/chat/?room=...#ENCRYPTION_KEY" }
```

The function checks that the URL uses HTTP(S), its path begins with `/tools/chat`, and it contains both a room query parameter and a non-empty fragment key. It requests an is.gd alias using an `olyralink` prefix plus a random 4–6-character suffix. It retries up to five times when the alias is already taken.

**Success**
```json
{ "shortUrl": "https://is.gd/olyralinkXXXX" }
```

Treat the complete invite link as a secret because it grants access to the room and includes the key in the URL fragment.

## `GET /api/chat/file?room=<room-id>&id=<file-id>`

Returns an encrypted attachment record.

- Room ID must match `^[A-Za-z0-9_-]{8,64}$`.
- File ID must be exactly 24 characters from the URL-safe alphabet.
- Returns `404` if the file is expired or unavailable.
- Returns encrypted `iv` and `data` values; the browser decrypts the payload.
- Uses `CHAT_ROOMS` KV when configured.

## `POST /api/chat/file`

Stores an encrypted attachment payload.

**Request shape**
```json
{
  "room": "ROOM_IDENTIFIER",
  "iv": "16_CHARACTER_BASE64URL_IV",
  "data": "BASE64URL_ENCODED_CIPHERTEXT"
}
```

The current server validates the room, IV encoding, ciphertext alphabet, and encoded payload length. The decoded attachment size is limited to 10 MiB plus the AES-GCM authentication tag allowance. The endpoint generates a random 24-character identifier and stores the payload with a 24-hour TTL in KV.

Success:
```json
{ "id": "RANDOM_24_CHARACTER_ID" }
```

The endpoint returns `503` if storage fails. An ID alone is not a substitute for a room key: clients need the correct encryption key to decrypt the file.

## `GET /api/chat/klipy?q=<search-term>`

Searches KLIPY GIFs through the server-side proxy.

- Requires `KLIPY_API_KEY` in the Pages Function environment.
- Query must be non-empty and at most 100 characters.
- Requests up to 18 GIF results with high content filtering.
- Returns only result URLs and previews using HTTPS on `static.klipy.com`.

Success response:
```json
{
  "results": [
    { "url": "https://static.klipy.com/...", "preview": "https://static.klipy.com/...", "title": "..." }
  ]
}
```

If the key is not configured, the endpoint returns `503`. Upstream failures return `502`.

## `POST /api/games/space`

Runs a bounded 2D gravity simulation.

**Request**
```json
{
  "gravity": 1,
  "steps": 4,
  "dt": 0.03,
  "bodies": [
    { "x": 0, "y": 0, "vx": 0, "vy": 0, "mass": 100, "radius": 20, "color": "#ffe48a" },
    { "x": 100, "y": 0, "vx": 0, "vy": 1, "mass": 10, "radius": 8, "color": "#72d8ff" }
  ]
}
```

**Limits**
- POST only.
- Maximum request body: 16 KiB.
- Bodies: 1–24.
- Gravity: 0–5.
- Steps: integer 1–8.
- Time step: 0.01–0.1.
- Position: −3,000 to 3,000 on each axis.
- Velocity: −1,000 to 1,000 on each axis.
- Mass: 0.1–10,000.
- Radius: 1–60.
- Color: six-digit hex color such as `#ffe48a`.

**Success**
```json
{
  "bodies": [],
  "stats": {
    "bodyCount": 2,
    "simulatedSeconds": 0.12,
    "kinetic": 0,
    "potential": 0,
    "energy": 0
  }
}
```

The numeric values above illustrate response shape only; real values depend on the input. The function returns `400` for malformed or out-of-range input, `405` for non-POST methods, `413` for oversized requests, and `422` if calculated energy values are non-finite.

## General client guidance

- Treat all input as untrusted, including requests from the official UI.
- Parse JSON defensively and handle non-2xx status codes.
- Do not expose API keys to browser code.
- Preserve `Cache-Control: no-store` for private or dynamic responses.
- Update this page when endpoint validation, payload shape, storage behavior, or status codes change.
