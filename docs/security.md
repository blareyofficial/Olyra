# Security and privacy

This page describes the security mechanisms visible in the current source code and the boundaries of the guarantees they provide. It is not a security audit or a promise of perfect security.

## General principles

- Validate data at the server boundary, even when the UI already validates it.
- Keep secrets in Cloudflare Pages environment variables, never in committed source files or browser JavaScript.
- Return no-store cache headers for private/dynamic data.
- Keep third-party integrations explicit and document what they do.
- Avoid logging message content, encryption keys, or attachment contents.
- Treat room invites and API credentials as sensitive.

## Olyra Chat encryption

The chat client uses the browser Web Crypto API with AES-GCM. Message JSON is encrypted in the browser before being sent to `/api/chat`. The server stores the encrypted `iv` and `data` fields and does not implement message decryption.

The room encryption key is encoded into the URL fragment (the portion after `#`). URL fragments are not included in the HTTP request sent to the server. The invite-link function does see the complete URL when the browser submits it to create a short alias, and the is.gd service receives that URL as part of shortening. Do not assume a fragment remains private from every service involved in creating a shortened invite.

### Invite links are bearer secrets

Anyone who obtains a complete room invite can potentially join and decrypt room content. Share links only with intended participants. Do not post them publicly, include them in screenshots, or send them to untrusted link-shortening or analytics services.

### What the encryption does and does not mean

Encryption in the browser helps prevent the chat storage endpoint from reading message plaintext. It does **not** by itself prove:
- That the user is anonymous to hosting providers or network observers.
- That the browser, device, extensions, or operating system are uncompromised.
- That the person using an invite is the intended person.
- That metadata such as request timing, IP address, room identifiers, message sizes, or activity patterns is hidden.
- That third-party link-shortening or GIF services never log requests.
- That the current implementation has undergone an independent cryptographic audit.

Use cautious product language. Prefer “messages are encrypted in the browser before storage” over broad guarantees such as “nobody can ever see anything.”

## Attachments

The chat client encrypts files before upload. The file endpoint stores the encrypted IV and data, not a plaintext file. Current code limits attachments to 10 MiB and sets a 24-hour KV expiration. Treat attachment identifiers as sensitive metadata and keep encryption keys out of server logs.

The server validates the room ID, IV format, encoded data alphabet, and payload length. Validation reduces malformed input but is not a substitute for rate limiting, abuse monitoring, or a complete threat assessment.

## Message storage and retention

When `CHAT_ROOMS` is configured, message room records and attachment records use a 24-hour TTL. Room message history is trimmed to the latest 200 records by the current chat endpoint. KV TTL behavior is a storage expiration policy; do not promise instantaneous deletion from all provider backups or infrastructure.

If `CHAT_ROOMS` is absent, local in-memory maps are used. That fallback is ephemeral and does not provide reliable shared persistence.

## URL shortening and QR codes

Olyra URL sends the target URL to is.gd for shortening. The optional QR-code feature uses a third-party QR Server URL that contains the shortened URL as a query parameter. A user should assume those providers can process the URL needed to perform their service. Avoid sending sensitive URLs through URL-shortening or QR-code services.

## KLIPY GIF search

The KLIPY API key is read from `KLIPY_API_KEY` on the server. Keep it in Cloudflare's environment configuration and never embed it in `tools/chat/index.html`. Search terms and requests are sent to KLIPY. The proxy checks that returned media URLs use HTTPS and the expected `static.klipy.com` host.

## Space Solution validation

The simulation endpoint limits request size, number of bodies, coordinates, velocities, mass, radius, gravity, time step, and integration steps. These limits help bound CPU and memory use and constrain numeric inputs. They do not replace deployment-level rate limits or monitoring.

## Deployment checklist

- [ ] Configure `CHAT_ROOMS` as a Cloudflare KV namespace binding for the Pages project.
- [ ] Configure `KLIPY_API_KEY` as a secret/environment variable, not in source.
- [ ] Verify production Pages Function environment variables and KV bindings.
- [ ] Review third-party services and their privacy terms before adding more data flows.
- [ ] Test invalid inputs and oversized requests.
- [ ] Avoid printing ciphertext, invite URLs, keys, or user-submitted sensitive data to logs.
- [ ] Keep dependencies and external links under review.
- [ ] Publish a contact route for vulnerability reports if the project establishes one.

## Reporting a vulnerability

If a security issue is discovered, report it privately to the project maintainers through a trusted private channel. Do not publish room invite links, credentials, encryption keys, or exploit details in a public issue. Add a formal security contact or security policy to the repository when the maintainers choose an official channel.
