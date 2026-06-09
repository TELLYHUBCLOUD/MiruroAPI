# API Endpoints Reference

Complete documentation for all 18 MiruroAPI endpoints.

---

## Table of Contents

- [Health Check](#health-check)
- [Stats](#stats)
- [Search](#search)
- [Suggestions](#suggestions)
- [Filter](#filter)
- [Trending](#trending)
- [Popular](#popular)
- [Upcoming](#upcoming)
- [Recent](#recent)
- [Spotlight](#spotlight)
- [Schedule](#schedule)
- [Anime Info](#anime-info)
- [Characters](#characters)
- [Relations](#relations)
- [Recommendations](#recommendations)
- [Episodes](#episodes)
- [Watch (Streaming)](#watch-streaming)

---

## Health Check

```
GET /api/health
```

Returns API health status, version, uptime, memory usage, and available providers.

**Response:**

```json
{
  "success": true,
  "results": {
    "status": "healthy",
    "version": "1.2.0",
    "uptime": "0h 0m 34s",
    "node": "v24.14.1",
    "memory": { "used": "13MB", "total": "15MB" },
    "endpoints": 16,
    "providers": ["kiwi","pewe","bee","bonk","bun","ally","nun","twin","cog","moo","hop","telli"]
  }
}
```

---

## Stats

```
GET /api/stats
```

Returns request statistics, cache info, and memory usage.

---

## Search

```
GET /api/search
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search keyword |
| `page` | number | No | 1 | Page number |
| `per_page` | number | No | 20 | Results per page |

**Example:** `GET /api/search?query=naruto&per_page=2`

**Response:**

```json
{
  "success": true,
  "results": {
    "page": 1,
    "perPage": 2,
    "total": 5000,
    "hasNextPage": true,
    "results": [
      {
        "id": 20,
        "title": { "romaji": "NARUTO", "english": "Naruto", "native": "NARUTO -ナルト-" },
        "coverImage": { "large": "https://s4.anilist.co/file/..." },
        "format": "TV",
        "episodes": 220,
        "status": "FINISHED",
        "averageScore": 80,
        "genres": ["Action","Adventure","Comedy","Drama","Fantasy","Supernatural"]
      }
    ]
  }
}
```

---

## Suggestions

```
GET /api/suggestions
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search keyword |

**Example:** `GET /api/suggestions?query=naruto`

Returns fast autocomplete suggestions with title, poster, format, status, year, and episode count.

---

## Filter

```
GET /api/filter
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `genre` | string | No | — | Genre name (e.g. "Action") |
| `tag` | string | No | — | Tag name |
| `year` | number | No | — | Release year |
| `season` | string | No | — | FALL, WINTER, SPRING, SUMMER |
| `format` | string | No | — | TV, MOVIE, OVA, ONA, SPECIAL, MUSIC |
| `status` | string | No | — | RELEASING, FINISHED, NOT_YET_RELEASED, CANCELLED |
| `sort` | string | No | POPULARITY_DESC | Sort order |
| `page` | number | No | 1 | Page number |
| `per_page` | number | No | 20 | Results per page |

**Example:** `GET /api/filter?genre=Action&year=2024&season=WINTER&per_page=3`

---

## Trending

```
GET /api/trending
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `per_page` | number | No | 20 | Results per page |

**Example:** `GET /api/trending?per_page=5`

---

## Popular

```
GET /api/popular
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `per_page` | number | No | 20 | Results per page |

---

## Upcoming

```
GET /api/upcoming
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `per_page` | number | No | 20 | Results per page |

---

## Recent

```
GET /api/recent
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `per_page` | number | No | 20 | Results per page |

---

## Spotlight

```
GET /api/spotlight
```

Returns featured/spotlight anime for the hero carousel.

---

## Schedule

```
GET /api/schedule
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | string | No | today | Date in YYYY-MM-DD format |

---

## Anime Info

```
GET /api/info/:id
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | AniList anime ID |

**Example:** `GET /api/info/20`

**Response:**

```json
{
  "success": true,
  "results": {
    "id": 20,
    "idMal": 20,
    "title": { "romaji": "NARUTO", "english": "Naruto", "native": "NARUTO -ナルト-" },
    "description": "Naruto Uzumaki, a hyperactive and knuckle-headed ninja...",
    "coverImage": { "large": "https://s4.anilist.co/file/..." },
    "format": "TV",
    "episodes": 220,
    "duration": 23,
    "status": "FINISHED",
    "averageScore": 80,
    "genres": ["Action","Adventure","Comedy","Drama","Fantasy","Supernatural"],
    "studios": [{ "name": "Studio Pierrot", "isAnimationStudio": true }]
  }
}
```

---

## Characters

```
GET /api/anime/:id/characters
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | AniList anime ID |

**Example:** `GET /api/anime/20/characters`

Returns characters with voice actors.

---

## Relations

```
GET /api/anime/:id/relations
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | AniList anime ID |

Returns related anime (sequels, prequels, side stories, etc.).

---

## Recommendations

```
GET /api/anime/:id/recommendations
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | AniList anime ID |

Returns recommended anime based on the given ID.

---

## Episodes

```
GET /api/episodes/:id
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | AniList anime ID |

**Example:** `GET /api/episodes/20`

**Response:**

```json
{
  "success": true,
  "results": {
    "providers": {
      "kiwi": {
        "meta": { "id": "1571", "title": "Naruto", "type": "TV" },
        "episodes": {
          "sub": [
            {
              "id": "watch/kiwi/20/sub/animepahe-1",
              "number": 1,
              "title": "Enter: Naruto Uzumaki!",
              "airDate": "2002-10-03",
              "audio": "sub",
              "filler": false
            }
          ]
        }
      }
    }
  }
}
```

---

## Watch (Streaming)

```
GET /api/watch/:provider/:anilistId/:category/:slug
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | Provider name (kiwi, pewe, etc.) |
| `anilistId` | number | Yes | AniList anime ID |
| `category` | string | Yes | sub or dub |
| `slug` | string | Yes | Episode slug from episodes response |

**Example:** `GET /api/watch/kiwi/20/sub/animepahe-1`

**Response:**

```json
{
  "success": true,
  "results": {
    "streams": [
      {
        "url": "https://vault-01.uwucdn.top/stream/.../uwu.m3u8",
        "type": "hls",
        "quality": "360p",
        "resolution": { "width": 640, "height": 360 },
        "codec": "h264",
        "audio": "sub",
        "fansub": "df68",
        "referer": "https://kwik.cx/e/..."
      }
    ],
    "download": "https://pahe.win/LJmbA"
  }
}
```
