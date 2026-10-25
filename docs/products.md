# Products and features

## Olyra Search

**Page:** `/tools/search/`  
**Application:** `https://olyrasearch-app.base44.app`

The repository page introduces Search as a clean web-search experience and links to the hosted application. The actual search application is external to this repository. This means this repository does not establish its internal framework, search provider, logging behavior, ranking algorithm, or retention practices.

When changing Search, update the link and description here and inspect the external app's own documentation for implementation-specific details.

## Olyra URL

**Page:** `/tools/url/`  
**Primary endpoint:** `POST /api/shorten`  
**Additional endpoint:** `/tools/url/api?url=...&qrcode=yes`

Features:
- Accepts absolute HTTP and HTTPS URLs.
- Requests a short URL from is.gd.
- Displays the returned short link.
- Can display a QR-code image served by an external QR Server service.
- Does not require a user account in the interface.

Validation in `functions/api/shorten.js` rejects missing or invalid URLs, unsupported protocols, and URLs longer than 8,192 characters. The endpoint has a JSON response and returns `Cache-Control: no-store`. It accepts POST and an OPTIONS preflight request.

The optional `/tools/url/api` endpoint accepts a `url` query parameter, prepends HTTPS if no HTTP(S) scheme was provided, delegates to `/api/shorten`, and can return a QR-code image URL when `qrcode=yes`, `true`, or `1`.

## Olyra Chat

**Page:** `/tools/chat/`

Features represented in the client:
- Create a room or join using a room code/invite URL.
- Browser-side AES-GCM message encryption and decryption.
- Invite links with the encryption key in the URL fragment.
- Short invite aliases using an `olyralink` prefix and a random 4–6-character suffix through is.gd.
- Polling for messages newer than the last received message.
- KLIPY GIF search via a server-side proxy.
- Encrypted file attachments up to 10 MiB (10 × 1024 × 1024 bytes) in the current implementation.
- Message history bounded to the latest 200 records in the room endpoint.
- Message and file records expire after 24 hours when stored in KV.

The chat server receives ciphertext, an IV, and a room identifier. The browser is responsible for encrypting/decrypting message content. See [Security](security.md) for the threat model and caveats.

### GIF search
The `/api/chat/klipy` function reads the API key from `KLIPY_API_KEY`, accepts a query of up to 100 characters, requests up to 18 results, asks KLIPY for high content filtering and GIF format, and only returns URLs hosted on `static.klipy.com` over HTTPS. The browser can then select a GIF and include it with a message.

### File attachments
The file endpoint accepts encrypted payloads only, limits the decoded file size to 10 MiB, and stores them under random identifiers. Stored file records have a 24-hour TTL when KV is configured. The user-facing client should enforce the same limit before encryption/upload; the server must still validate independently.

## Olyra Games

**Page:** `/games/`

The game library currently lists these experiences:

| Game | Summary | Controls or interaction |
|---|---|---|
| Olyra Drive | Drive around a shared world with friends | WASD or arrow keys; private rooms use the chat service |
| Star Catcher | Collect stars and avoid meteors | Left/right arrows or A/D |
| Neon Rush | Jump over roadblocks and slide under barriers | Space/Up to jump; Down to slide |
| Block Logic | Clear complete rows with falling shapes | Arrow keys; Down to drop |
| Orbital Chaos | Place planets and watch them gravitationally interact | Click the field to launch a planet; R resets |
| Maze Breaker | Find a key and treasure, then reach the exit | Arrow keys or WASD |
| Beat Reactor | Hit notes in time with the pulse | D, F, J, K |
| Tiny Colony | Gather supplies and grow an outpost | Use the on-screen actions |
| Pixelbound | Collect coins and jump between platforms | Left/right or A/D; Space/Up to jump |
| Signal Sweep | Reveal safe tiles and mark hidden signals | Click to reveal; right-click to flag |
| Bumper Bots | Push rival robots out of an arena | Player 1: WASD; Player 2: arrows; R resets |
| Space Solution | Create a small 2D gravity simulation | Add bodies and adjust gravity using controls |

Game descriptions and control text are sourced from the current game metadata in `games/games.js`. Check that file if gameplay changes.

### Space Solution physics model
The backend is `functions/api/games/space.js`. It accepts 1–24 bodies, gravity from 0 to 5, 1–8 integration steps per request, and a time step from 0.01 to 0.1. Each body has bounded position, velocity, mass, radius, and a hex color. Request bodies are limited to 16 KiB.

The function calculates pairwise gravitational acceleration with a softening term in the distance calculation, advances positions and velocities in discrete steps, reflects bodies from world boundaries with velocity damping, and returns kinetic/potential/total energy statistics. This is a bounded educational simulation, not a precision orbital mechanics package.

## Other landing-page sections

- **LcF:** Listed as a sub-brand and described as a lossless compression image format.
- **Partners:** Displays BLT© and The Night Valley©.
- **Store:** Links to the Olyra Foundation Bonfire storefront.
- **Founders:** `/founders/` contains the founder page.

These sections are primarily static presentation content in the repository.
