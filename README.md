# Olyra

**Paid tools, made free.**

Olyra is an open, accessible collection of online tools created by **Olyra Foundation**. The project is designed around a simple idea: useful internet tools should be available without unnecessary paywalls, subscriptions, ads, or artificial limits.

## Documentation

The full project documentation lives in [docs/](./docs/README.md). It covers the project mission, architecture, repository structure, products, API endpoints, security and privacy model, Cloudflare Pages deployment, configuration, and development workflow.

Start here: **[Olyra Documentation](./docs/README.md)**.

## What is included

- **Olyra Search** — web search, currently linked to a separately hosted application.
- **Olyra URL** — URL shortening and QR-code support.
- **Olyra Chat** — room-based chat with browser-side encryption, GIF search, and encrypted file attachments.
- **Olyra Games** — free browser games, including multiplayer driving and a bounded 2D gravity simulation.

The landing page also includes project information, founders, sub-brand and partner sections, and a link to the Olyra Store.

## Repository structure

```
/
├── docs/
│   ├── README.md
│   ├── overview.md
│   ├── architecture.md
│   ├── products.md
│   ├── api-reference.md
│   ├── security.md
│   ├── deployment.md
│   └── development.md
├── founders/
├── functions/
│   └── api/
│       ├── shorten.js
│       ├── chat.js
│       ├── chat/
│       │   ├── share.js
│       │   ├── file.js
│       │   └── klipy.js
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
├── brands.css
├── OlyraLogo.svg
└── LICENSE
```

## Cloudflare Pages

The repository is designed to work with Cloudflare Pages. The functions/ directory contains Cloudflare Pages Functions. When the repository is connected to Cloudflare Pages, pushes to the configured production branch can trigger automatic deployments.

Olyra Chat's KLIPY GIF search requires a KLIPY app key configured as the KLIPY_API_KEY environment variable in the Cloudflare Pages project. Get an app key from [KLIPY](https://partner.klipy.com/api-keys). Custom file attachments are encrypted in the browser before being stored in the CHAT_ROOMS KV namespace, and are limited to 10 MiB; stored files expire after 24 hours when KV is configured.

Olyra Drive uses the existing /api/chat encrypted room endpoint for private room messages and multiplayer car positions. Space Solution sends bounded gravity simulation requests to /api/games/space; the server limits request size, object count, integration steps, time step, mass, and world coordinates.

See [Deployment and configuration](./docs/deployment.md) for the setup checklist and [API reference](./docs/api-reference.md) for request/response details.

## Development

Olyra is primarily a static HTML/CSS/JavaScript project with Cloudflare Pages Functions where server-side request handling is needed. The repository currently does not define a root package-based frontend build step.

For a quick local preview, serve the repository with any static web server. Some Cloudflare Pages Functions features require the Cloudflare development environment rather than a plain static server. See the [Development guide](./docs/development.md).

## Contributing

1. Keep tools accessible.
2. Avoid unnecessary paywalls or subscriptions.
3. Keep the interface simple and responsive.
4. Prefer lightweight client-side code where practical.
5. Keep keyboard and mobile usability in mind.
6. Do not introduce unnecessary tracking or advertising.
7. Update documentation when changing features, APIs, security behavior, or deployment configuration.

## License

See [LICENSE](./LICENSE) for the project's license terms.

---

Made for the web by **Olyra Foundation**.

**Infrastructure is a public good.**