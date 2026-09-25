# Olyra

**Paid tools, made free.**

Olyra is an open, accessible collection of online tools created by **Olyra Foundation**. The project is designed around a simple idea: useful internet tools should be available without unnecessary paywalls, subscriptions, ads, or artificial limits.

## What is included

The main Olyra site currently includes:

- **Olyra Search** — web search.
- **Olyra URL** — URL-related tools.
- **Olyra Chat** — an encrypted chat experience.
- **OlyraAI** — an AI assistant powered through Puter.js.
- **OlyraAI API-style endpoint** — send a query through `/api/olyraai/request` and receive an OlyraAI response page.

## Repository structure

```
/
├── founders/
├── functions/
│   └── api/
│       ├── chat.js
│       └── olyraai/
│           └── request.js
├── tools/
│   ├── chat/
│   ├── search/
│   ├── url/
│   └── ai/
├── index.html
├── styles.css
├── OlyraLogo.svg
└── LICENSE
```

## OlyraAI

OlyraAI is the AI assistant provided by Olyra.

The current web interface uses:

- [Puter.js](https://js.puter.com/v2/)
- Markdown rendering with [marked](https://marked.js.org/)
- Streaming AI responses
- A browser-side conversation history
- A dedicated OlyraAI identity prompt

OlyraAI is currently an interface built around Puter rather than a separately hosted Olyra language model.

### API-style request

You can send a URL-encoded query to:

```
/api/olyraai/request?your%20query%20here
```

For example:

```
/api/olyraai/request?What%20is%20Olyra
```

The endpoint returns a small OlyraAI page which runs the Puter request and renders the response as Markdown.

## Cloudflare Pages

The repository is designed to work with Cloudflare Pages.

The `functions/` directory contains Cloudflare Pages Functions. When the repository is connected to Cloudflare Pages, pushes to the configured production branch can trigger automatic deployments.

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
