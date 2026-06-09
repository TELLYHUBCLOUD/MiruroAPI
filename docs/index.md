# MiruroAPI Documentation

> Free REST API for anime streaming data. 18 endpoints, 12 providers, M3U8 URLs. No API key required.

## Overview

MiruroAPI is a free, open-source REST API that provides anime data by aggregating from AniList GraphQL and Miruro streaming providers. It's built with Node.js and Express, and deployed on Vercel.

**Base URL:** `https://mirurotvapi.vercel.app/api`

## Quick Start

```bash
# Search for anime
curl "https://mirurotvapi.vercel.app/api/search?query=naruto"

# Get anime info
curl "https://mirurotvapi.vercel.app/api/info/20"

# Get episodes
curl "https://mirurotvapi.vercel.app/api/episodes/20"
```

**Live Response — Search:**

```json
{
  "success": true,
  "results": {
    "page": 1,
    "perPage": 20,
    "total": 5000,
    "hasNextPage": true,
    "results": [
      {
        "id": 20,
        "title": { "romaji": "NARUTO", "english": "Naruto" },
        "coverImage": { "large": "https://s4.anilist.co/file/..." },
        "format": "TV",
        "episodes": 220,
        "status": "FINISHED",
        "averageScore": 80
      }
    ]
  }
}
```

## Features

- **18 Endpoints** — Search, info, episodes, streaming, characters, relations, and more
- **12 Streaming Providers** — M3U8 URLs with resolution, codec, fansub info
- **No API Key** — Just make requests, no registration needed
- **In-Memory Cache** — 1-5 minute TTL for fast responses
- **CORS Enabled** — Access from any domain
- **JSON Responses** — Standardized `{success, results}` format

## Documentation

- [API Endpoints Reference](endpoints.md) — Complete endpoint documentation with real responses
- [Streaming Flow Guide](streaming.md) — How to get stream URLs step by step
- [Code Examples](examples.md) — cURL, JavaScript, Python (all tested and working)
- [Architecture](architecture.md) — Project structure and design decisions

## Response Format

All endpoints return JSON in this format:

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

## Rate Limiting

Rate limiting is enforced at 100 requests per minute per IP address. The API also uses a 1-5 minute in-memory cache. Repeated requests for the same data will be served from cache.

## Disclaimer

This API is for **educational purposes only**. It fetches data from AniList GraphQL and Miruro streaming providers. We are not affiliated with or endorsed by Miruro. All content belongs to its respective owners.
