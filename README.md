# Olyra

**Paid tools, made free.**

Olyra is an open, accessible collection of online tools created by **Olyra Foundation**. The project is designed around a simple idea: useful internet tools should be available without unnecessary paywalls, subscriptions, ads, or artificial limits.

## What is included

The main Olyra site currently includes:

- **Olyra Search** — web search.
- **Olyra URL** — URL-related tools.
- **Olyra Chat** — an encrypted chat experience.
- **Olyra Games** — free browser games, including multiplayer driving and a server-simulated solar system.

## Repository structure

```
/
├── founders/
├── functions/
│   └── api/
│       ├── chat.js
│       └── games/
│           └── space.js
├── games/
│   ├── games.css
│   ├── games.js
│   └── index.html
├── tools/
│   ├── chat/
│   ├── search/
│   └── url/
├── index.html
├── styles.css
├── OlyraLogo.svg
└── LICENSE
```

## Cloudflare Pages

The repository is designed to work with Cloudflare Pages.

The `functions/` directory contains Cloudflare Pages Functions. When the repository is connected to Cloudflare Pages, pushes to the configured production branch can trigger automatic deployments.

Olyra Chat's KLIPY GIF search requires a KLIPY app key configured as the `KLIPY_API_KEY` environment variable in the Cloudflare Pages project. Get an app key from [KLIPY](https://partner.klipy.com/api-keys). Custom file attachments are encrypted in the browser before being stored in the existing `CHAT_ROOMS` KV namespace, and are limited to 10 MB; stored files expire after 24 hours.

Olyra Drive uses the existing `/api/chat` encrypted room endpoint for private room messages and multiplayer car positions. Space Solution sends bounded gravity simulation requests to `/api/games/space`; the server limits request size, object count, integration steps, time step, mass, and world coordinates.

## Development

Olyra is primarily a static HTML/CSS/JavaScript project with Cloudflare Pages Functions where server-side request handling is needed.

For a quick local preview, serve the repository with any static web server. Some Cloudflare Pages Functions features require the Cloudflare development environment rather than a plain static server.

## Contributing

Changes should keep Olyra's goals in mind:

1. Keep tools accessible.
2. Avoid unnecessary paywalls or subscriptions.
3. Keep the interface simple and responsive.
4. Prefer lightweight client-side code where practical.
5. Keep keyboard and mobile usability in mind.
6. Do not introduce unnecessary tracking or advertising.

## License

See [LICENSE](./LICENSE) for the project's license terms.

---

Made for the web by **Olyra Foundation**.

**Infrastructure is a public good.**
