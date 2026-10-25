# Development and contribution guide

## Prerequisites

- Git
- A code editor
- A modern browser with support for the Web Crypto API
- A static web server for front-end-only previews
- Cloudflare Pages development tooling for exercising Pages Functions locally
- Cloudflare KV and a KLIPY API key for testing persistent chat and GIF search end-to-end

The repository is static-first and currently has no root package manifest or declared frontend build pipeline. Do not run framework-specific build commands unless a future change introduces them.

## Clone and inspect

```bash
git clone https://github.com/blareyofficial/Olyra.git
cd Olyra
git status
```

Inspect the files relevant to your change before editing. Important entry points:

- Landing page: `index.html`
- Shared styles: `styles.css`, `brands.css`
- Tool directory: `tools/index.html`
- URL UI: `tools/url/index.html`
- Chat UI and browser crypto: `tools/chat/index.html`
- Game library and logic: `games/index.html`, `games/games.js`, `games/games.css`
- URL backend: `functions/api/shorten.js`
- Chat backend: `functions/api/chat.js` and `functions/api/chat/`
- Space Solution backend: `functions/api/games/space.js`
- Documentation: `docs/`

## Local preview

Serve the repository root with any simple static HTTP server to preview page markup and styling. A static server does not emulate Cloudflare Pages Functions; API-backed features will not work unless the local environment routes those functions correctly.

For full-stack local testing, use the Cloudflare Pages development workflow compatible with the deployed project and configure the required KV binding and KLIPY key locally. Never commit real credentials or private room invite links.

## Code conventions

- Keep pages semantic and usable at mobile widths.
- Prefer native HTML/CSS/JavaScript where it fits the existing architecture.
- Use responsive layouts and clear focus states.
- Keep API input validation on the server, even if the browser validates first.
- Handle network failures and malformed JSON without breaking the page.
- Avoid putting API keys in browser JavaScript.
- Keep private or dynamic API responses non-cacheable.
- Keep the game simulation bounds intact unless the API and its safety limits are deliberately redesigned together.
- Avoid adding third-party dependencies for tasks that can be solved simply with the current stack.
- Respect reduced-motion preferences for animations.
- Keep labels and accessible names meaningful for interactive controls.

## Testing checklist

There is no test runner or automated test suite declared in the inspected root project files. For each change, perform relevant manual tests and consider adding automated tests when the project adopts a test setup.

### Static pages
- Check desktop and narrow/mobile layouts.
- Check links, browser console, and missing assets.
- Test keyboard navigation and focus visibility.

### URL service
- Valid HTTP and HTTPS URL.
- Missing URL, malformed URL, unsupported scheme, and very long URL.
- Upstream service failure handling.
- QR-code rendering and link safety.

### Chat
- Create and join a room in two separate browser sessions.
- Verify message ciphertext is sent to the server and plaintext is decrypted only in the client.
- Test wrong/malformed invite values and expired attachment IDs.
- Test attachment size limits and GIF-search failure states.
- Confirm room invite keys are never printed to logs or exposed in unrelated UI.

### Space Solution
- One body and multiple bodies.
- Lowest/highest allowed gravity, time step, and step count.
- Minimum and maximum body counts.
- Invalid colors, non-finite numbers, out-of-range positions/velocities, and oversized payloads.
- Confirm UI can handle non-2xx responses and returned statistics.

## Contribution workflow

1. Make a focused change.
2. Update documentation for behavior, routes, configuration, or security changes.
3. Test the relevant page and API path.
4. Review the diff for accidental secrets, unrelated changes, and misleading claims.
5. Commit with a concise message describing the change.
6. Open a pull request or otherwise review the change before merging it into the production branch.

## Documentation maintenance

When code changes, update:
- `products.md` for user-visible feature changes.
- `api-reference.md` for endpoint, payload, limit, or status changes.
- `security.md` for changes to encryption, data flows, third parties, or retention.
- `deployment.md` for new bindings, secrets, or hosting configuration.
- `architecture.md` for file layout or technology changes.

If a feature is planned but not present in the repository, label it as planned rather than documenting it as live.
