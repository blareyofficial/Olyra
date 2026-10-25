# Architecture and repository map

## High-level architecture

Olyra is currently a **static-first web application with serverless endpoints**.

```text
Browser
  ├── /                    → index.html + styles.css + brands.css
  ├── /tools/               → tool index
  │    ├── /search/         → link to external Base44 application
  │    ├── /url/            → URL form + QR presentation
  │    └── /chat/           → browser encryption + chat UI
  ├── /games/               → game library + Canvas 2D rendering
  └── /api/...              → Cloudflare Pages Functions
        ├── /api/shorten
        ├── /api/chat
        ├── /api/chat/share
        ├── /api/chat/file
        ├── /api/chat/klipy
        └── /api/games/space
```

The route-to-file mapping is supplied by Cloudflare Pages Functions conventions: a JavaScript file under `functions/` maps to a URL based on its path. For example, `functions/api/chat.js` serves `/api/chat`; `functions/api/chat/file.js` serves `/api/chat/file`.

## Technology choices

### Frontend
- Semantic HTML pages are the entry points.
- CSS handles layout, responsive behavior, themes, and component styling.
- Browser JavaScript handles forms, encryption, chat polling, game state, and rendering.
- The game library uses the Canvas 2D API plus DOM-based controls.
- The chat uses the browser Web Crypto API for AES-GCM encryption.

No frontend framework such as React or Vue, package manager, bundler, or transpilation step is declared in the root project files inspected for this documentation. Avoid adding instructions that assume one exists unless the repository changes.

### Server-side
Cloudflare Pages Functions provide server-side request validation, external API calls, encrypted-payload storage, and simulation calculations. Functions use standard Web APIs such as `Request`, `Response`, `URL`, `fetch`, and `crypto`.

### Storage
The chat functions look for a Cloudflare KV binding named `CHAT_ROOMS`. Message records use keys in the form `room:<room-id>`; encrypted attachments use keys in the form `chat-file:<room-id>:<file-id>`. Both use a 24-hour TTL in the current implementation.

Without the KV binding, the message and file endpoints use process-local `Map` objects. That fallback is useful only for limited local testing: it is not durable and is not shared across different workers or instances.

### External services
- **is.gd:** URL shortening for Olyra URL and Olyra Chat invite aliases.
- **KLIPY:** GIF search, called from a server-side proxy using `KLIPY_API_KEY`.
- **QR Server:** Generates the QR-code image URL used by the URL interface.
- **Base44:** Hosts the linked Olyra Search application.
- **Cloudflare Pages:** Hosts static assets and serverless functions.
- **Cloudflare KV:** Stores encrypted chat payloads and encrypted attachment payloads when configured.

External services can have their own availability, logging, rate limits, and privacy practices. Olyra cannot promise their behavior on their behalf.

## Repository layout

```text
/
├── docs/                       # Project documentation
├── founders/
│   └── index.html              # Founder information page
├── functions/
│   └── api/
│       ├── shorten.js          # URL shortening proxy
│       ├── chat.js             # Encrypted room message endpoint
│       ├── chat/
│       │   ├── share.js        # Short invite-link creation
│       │   ├── file.js         # Encrypted attachment storage
│       │   └── klipy.js        # GIF-search proxy
│       └── games/
│           └── space.js        # Bounded 2D gravity simulation
├── games/
│   ├── index.html              # Game library interface
│   ├── games.css               # Game page and dialog styles
│   └── games.js                # Game logic and rendering
├── tools/
│   ├── index.html              # Tool directory
│   ├── chat/
│   │   └── index.html          # Chat interface and client logic
│   ├── search/
│   │   └── index.html          # Link to hosted Search app
│   └── url/
│       ├── index.html          # URL shortener interface
│       └── api.js              # Optional URL API route under /tools/url/api
├── index.html                  # Main landing page
├── styles.css                  # Shared site styling
├── brands.css                 # Sub-brand and partner styling
├── OlyraLogo.svg               # Shared brand asset
├── LICENSE                     # GNU AGPL v3
└── README.md
```

This is a map of known important files, not an exhaustive listing of every asset or founder file. Check the repository itself for the current full tree.

## Request flows

### URL shortening
1. The browser submits a URL to `POST /api/shorten`.
2. The function parses and validates the URL, allowing only HTTP and HTTPS.
3. The function calls is.gd and validates the response.
4. The browser displays the returned short URL and can construct a QR-code image URL.

### Chat messages
1. A room is identified by a random room ID.
2. The browser generates/holds a room key and encrypts message data using AES-GCM.
3. The browser sends the room ID plus ciphertext and IV to `/api/chat`.
4. The server stores the encrypted record in KV with a 24-hour TTL when KV is configured.
5. Clients poll for records newer than their last received message and decrypt them locally.

### Attachments
1. The browser encrypts a file before upload.
2. The file endpoint validates the room ID, IV, and encoded ciphertext shape.
3. It assigns a random file identifier and stores the encrypted payload with a 24-hour TTL.
4. Authorized room clients retrieve the ciphertext and decrypt it in their browser.

### Gravity simulation
1. The game sends a JSON request to `POST /api/games/space`.
2. The function enforces request-size, object-count, mass, coordinate, velocity, gravity, and integration-step bounds.
3. It performs a limited 2D numerical integration and calculates kinetic, potential, and total energy values.
4. The response returns updated bodies and summary statistics.

## Architectural boundaries

Keep the browser responsible for presentation and user interaction; keep server functions responsible for validating requests and handling shared services. Never trust client-provided values simply because the normal UI would not send them. Server-side validation must remain authoritative.
