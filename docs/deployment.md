# Deployment and configuration

## Hosting model

Olyra is structured for Cloudflare Pages: static files are served directly and files under `functions/` become Pages Functions. A connected GitHub repository can be configured to build/deploy on pushes to the selected production branch.

The repository currently does not declare a root `package.json`, framework build command, or compiled output directory in the files inspected. For a static-first Pages deployment, configure the repository root as the project root and use no build command unless the project is later given an actual build step. The output directory should match the root static assets for this repository. Confirm these settings against the current Cloudflare dashboard and the Pages documentation before production changes.

## Setup checklist

1. Connect `blareyofficial/Olyra` to a Cloudflare Pages project.
2. Select the intended production branch (the repository currently uses `main` in its links).
3. Configure the Pages project to serve the repository's static files and detect the `functions/` directory.
4. Create a Cloudflare KV namespace for chat data.
5. Bind that namespace to the Pages project with the exact variable name `CHAT_ROOMS`.
6. Add `KLIPY_API_KEY` as a server-side environment variable/secret for GIF search.
7. Set the variables/bindings in both preview and production environments if both should work.
8. Deploy and test every page and API route listed in the [API reference](api-reference.md).
9. Confirm the deployed site origin is the intended canonical origin and that invite URLs are generated correctly for it.

## Environment variables and bindings

| Name | Type | Required for | Notes |
|---|---|---|---|
| `CHAT_ROOMS` | Cloudflare KV namespace binding | Shared, persistent chat messages and attachment storage | Bind the KV namespace under this exact name |
| `KLIPY_API_KEY` | Secret/environment variable | GIF search | Obtain from KLIPY; never commit the value |

No other required environment variables are established by the currently inspected code. Do not add fictional configuration values to deployment instructions.

## KV retention

The current chat message and file code requests a 24-hour TTL when writing to KV. Message records use `room:<room-id>`. Attachments use `chat-file:<room-id>:<file-id>`.

Check KV permissions, namespace binding names, and preview/production configuration if messages or attachments appear not to persist. Without KV, the code falls back to in-memory maps; that is not appropriate for a multi-instance production chat service.

## External services

- **is.gd** is called by `/api/shorten` and `/api/chat/share`.
- **KLIPY** is called by `/api/chat/klipy` and requires `KLIPY_API_KEY`.
- **QR Server** provides the QR-code image used by the URL interface.
- **Base44** hosts the linked Search app.

Deployment can be healthy even when a third-party provider is unavailable, but the related feature may return an error. Test failure states rather than assuming all external services are always reachable.

## Smoke tests after deployment

- [ ] Home page loads and shared CSS/logo assets resolve.
- [ ] `/tools/`, `/tools/search/`, `/tools/url/`, and `/tools/chat/` load.
- [ ] `/games/` loads and all game cards can open their experiences.
- [ ] `POST /api/shorten` returns a short URL for a valid HTTP(S) URL.
- [ ] Invalid URL input is rejected.
- [ ] Two clients can exchange encrypted messages in the same room.
- [ ] A shared chat invite opens the intended room.
- [ ] Chat attachments can be uploaded and downloaded while still encrypted at rest.
- [ ] GIF search works when `KLIPY_API_KEY` is configured and fails gracefully when not.
- [ ] `POST /api/games/space` returns updated bodies for a valid bounded request.
- [ ] Oversized and out-of-range simulation requests are rejected.

## Local preview

A plain static server is enough to inspect HTML and CSS, but it will not automatically execute Cloudflare Pages Functions. For full local testing of serverless routes, use the Cloudflare Pages development workflow (for example, Wrangler/Pages tooling) and configure local bindings/secrets as supported by the chosen version. No specific Wrangler version is pinned by this repository, so install and use a current compatible version and avoid committing local secret files.

## Rollback and release discipline

Before deploying a change that affects routes, encryption, storage, or game simulation, keep the change isolated and verify the API contract. Use Git history/Cloudflare deployment history to roll back a broken release. Never roll back by overwriting unrelated user changes or force-pushing shared history without explicit intent.
