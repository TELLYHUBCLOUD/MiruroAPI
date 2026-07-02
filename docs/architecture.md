# Architecture

## Project Structure

```
MiruroAPI/
├── server.js                          # Express entry point, port 3000
├── package.json                       # name: "miruro-api"
├── vercel.json                        # Routes /api/* and /* to server.js
├── Dockerfile                         # Docker support (node:20-alpine)
├── .dockerignore                      # Docker ignore file
│
├── public/                            # Static files served from process.cwd()
│   ├── index.html                     # Premium landing page (SVG icons, live console)
│   ├── docs.html                      # Swagger UI interactive documentation
│   ├── openapi.json                   # OpenAPI 3.0 spec
│   ├── 404.html                       # Glitch animation error page
│   ├── manifest.json                  # PWA manifest (theme: #A855F7)
│   ├── robots.txt                     # Crawler directives
│   ├── sitemap.xml                    # 4 pages (/, /tos, /privacy, /api)
│   ├── icon-dark.svg                  # Miruro dark mode SVG icon
│   ├── icon-light.svg                 # Miruro light mode SVG icon
│   ├── icon-512x512.png              # Miruro app icon
│   ├── favicon.ico                    # Classic favicon
│   ├── apple-touch-icon-180x180.png  # iOS home screen icon
│   ├── og-image.png                   # OG/Twitter share image
│   ├── privacy.html                   # Privacy policy (served at /privacy)
│   └── tos.html                       # Terms of service (served at /tos)
│
├── assets/                            # Scraped Miruro assets
│   ├── favicons/                      # All favicon variants
│   ├── logos/                         # Status page logo
│   ├── fonts/                         # Inter + FontAwesome
│   └── media/                         # Testimonial avatars
│
├── docs/                              # API documentation
│   ├── index.md                       # Overview, quick start, features
│   ├── endpoints.md                   # Full API reference (18 endpoints)
│   ├── streaming.md                   # Streaming flow guide (3-step)
│   ├── examples.md                    # cURL, JavaScript, Python
│   └── architecture.md               # This file
│
├── src/
│   ├── helpers/
│   │   ├── anilist.js                 # AniList GraphQL integration
│   │   ├── pipe.js                    # Miruro pipe integration
│   │   └── cache.js                   # In-memory Map cache with TTL
│   │
│   └── routes/
│       └── apiRoutes.js               # All route definitions
│
├── test.js                            # Integration test suite
├── CHANGELOG.md                       # Version history
├── LICENSE                            # MIT License
└── README.md                          # Full API documentation
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Metadata | AniList GraphQL (`graphql.anilist.co`) |
| Streaming | Miruro pipe (`miruro.{to,ru,bz,tv}/api/secure/pipe`) |
| Deployment | Vercel (Serverless) |
| Caching | In-memory Map with 1-5 min TTL |
| Static Files | Express static middleware |

## Request Flow

```
Client Request
    ↓
Vercel Routes (/api/* → server.js)
    ↓
Express Router (apiRoutes.js)
    ↓
Helper (e.g., anilist.js or pipe.js)
    ↓
HTTP Request to AniList GraphQL / Miruro pipe
    ↓
Response decoded (base64url + gzip for pipe)
    ↓
Returns structured JSON
    ↓
Client Response
```

## Streaming Flow

```
/api/episodes/:anilistId
    ↓
    Returns: providers with sub/dub episode lists
    ↓
/api/watch/:provider/:anilistId/:category/:slug
    ↓
    Returns: streams[] with M3U8 URLs, quality, codec, fansub
    ↓
Play M3U8 in HLS player (hls.js, video.js, native)
```

## Caching Strategy

- **Type:** In-memory Map
- **TTL:** 1-5 minutes depending on endpoint
- **Max Size:** 100 entries with FIFO eviction
- **Key:** Full request URL
- **Behavior:** First request fetches from source, subsequent requests served from cache
- **Eviction:** Automatic when TTL expires or max size reached

## Data Sources

### AniList GraphQL

- **Endpoint:** `https://graphql.anilist.co`
- **Data:** Search, suggestions, info, characters, relations, recommendations, filter, schedule
- **Format:** Standard GraphQL queries

### Miruro Pipe

- **Endpoint:** `https://miruro.{to,ru}/api/secure/pipe`
- **Data:** Episodes, streaming sources (M3U8 URLs)
- **Encoding:** Base64url + gzip compressed request/response
- **Providers:** kiwi, pewe, bee, bonk, bun, ally, nun, twin, cog, moo, hop, telli

## Self-Healing Fallback System (v2.3.0)

When Cloudflare blocks streaming requests, the API automatically tries fallback methods in order:

1. **Direct** → Mirror rotation across 4 domains (miruro.to, miruro.ru, miruro.bz, miruro.tv)
2. **ScraperAPI** → Free proxy bypass via ScraperAPI (1K req/month, requires `SCRAPER_API_KEY`)
3. **FlareSolverr** → Self-hosted browser proxy for full Cloudflare bypass

The system tracks success/failure rates per method and auto-rotates to the most reliable option. Check status via `/api/pipe-health`.

## Vercel Configuration

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.js"
    },
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

- `/api/*` routes to Express for API handling
- `/*` routes to Express for static file serving
- Static files served from `process.cwd()` (Vercel serverless compatible)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (Express mode only) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated allowed origins |

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "results": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.21.0 | Web framework |
| axios | ^1.8.0 | HTTP requests |
| cors | ^2.8.5 | CORS headers |
| dotenv | ^16.4.0 | Environment variables |


