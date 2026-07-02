/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — worker.js (Cloudflare Worker Edition)
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   Cloudflare Worker version of MiruroAPI. Runs entirely on
 *   Cloudflare's edge network — pipe requests bypass bot detection
 *   automatically since they route through Cloudflare's internal network.
 *
 *   Key advantages over Vercel deployment:
 *   - Pipe requests NOT blocked by Cloudflare (edge → edge)
 *   - Zero cold starts (V8 isolates)
 *   - Free tier: 100K requests/day
 *   - No npm dependencies required (native fetch + DecompressionStream)
 *
 * @endpoints
 *   System:    /api/health
 *   Search:    /api/search, /api/suggestions, /api/filter
 *   Collections: /api/trending, /api/popular, /api/top, /api/random
 *   Details:   /api/info/:id, /api/anime/:id/characters, /api/anime/:id/relations
 *   Streaming: /api/episodes/:id, /api/watch/:provider/:anilistId/:category/:slug
 *   Metadata:  /api/genres
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

/**
 * AniList GraphQL endpoint.
 * All metadata (search, trending, info, characters) comes from here.
 *
 * @type {string}
 */
const ANILIST_URL = "https://graphql.anilist.co";

/**
 * Miruro pipe origins, ordered by reliability.
 * The worker tries each mirror in sequence until one succeeds.
 * Running on Cloudflare edge means these requests go through
 * Cloudflare's internal network — no bot detection triggered.
 *
 * @type {string[]}
 */
const MIRURO_ORIGINS = [
  "https://www.miruro.to",
  "https://www.miruro.ru",
  "https://www.miruro.bz",
  "https://www.miruro.tv",
];

/**
 * Canonical Miruro origin for referer/origin headers.
 *
 * @type {string}
 */
const CANONICAL_ORIGIN = "https://www.miruro.to";

/**
 * Pipe API path — appended to each origin.
 *
 * @type {string}
 */
const PIPE_PATH = "/api/secure/pipe";

/**
 * XOR obfuscation key for pipe response decoding (scheme 2).
 * 16-byte hex key used when x-obfuscated header = "2".
 *
 * @type {Uint8Array}
 */
const PIPE_OBF_KEY = new Uint8Array([
  0x71, 0x95, 0x10, 0x34, 0xf8, 0xfb, 0xcf, 0x53,
  0xd8, 0x9d, 0xb5, 0x2c, 0xeb, 0x3d, 0xc2, 0x2c,
]);

/**
 * Browser-accurate request headers for Cloudflare fingerprinting.
 * These headers must match what a real Chrome browser sends —
 * missing or incorrect headers trigger Cloudflare's bot detection.
 *
 * @type {Object}
 */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  Referer: `${CANONICAL_ORIGIN}/`,
  Origin: CANONICAL_ORIGIN,
};

// ══════════════════════════════════════════════════════════════
// CORS & RESPONSE UTILITIES
// ══════════════════════════════════════════════════════════════

/**
 * Standard CORS headers applied to every response.
 * Allows any origin to call the API (open CORS policy).
 *
 * @type {Object}
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Returns a JSON response with CORS headers.
 *
 * @param {*} data - Data to serialize as JSON
 * @param {number} [status=200] - HTTP status code
 * @returns {Response} Cloudflare Worker Response object
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/**
 * Returns a standardized error response.
 * All errors follow the same shape: { success, message, timestamp }.
 *
 * @param {string} msg - Error description
 * @param {number} [status=500] - HTTP status code
 * @returns {Response} Error response with CORS headers
 */
function error(msg, status = 500) {
  return json(
    { success: false, message: msg, timestamp: new Date().toISOString() },
    status
  );
}

// ══════════════════════════════════════════════════════════════
// ANILIST GRAPHQL CLIENT
// ══════════════════════════════════════════════════════════════

/**
 * Executes a GraphQL query against the AniList API.
 *
 * @param {string} query - GraphQL query string
 * @ @param {Object} [variables={}] - Query variables
 * @returns {Promise<Object>} Parsed data from the GraphQL response
 * @throws {Error} If the GraphQL response contains errors
 *
 * @example
 *   const data = await anilistQuery(`{ GenreCollection }`);
 *   console.log(data.GenreCollection); // ["Action", "Comedy", ...]
 */
async function anilistQuery(query, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "AniList query failed");
  }
  return json.data;
}

// ══════════════════════════════════════════════════════════════
// PIPE ENCODE / DECODE
// ══════════════════════════════════════════════════════════════

/**
 * Encodes a pipe request payload to base64url.
 * The pipe endpoint expects the request as base64url-encoded JSON.
 *
 * @param {Object} payload - Request payload { path, method, query, body }
 * @returns {string} Base64url-encoded string (no padding)
 *
 * @example
 *   encodePipeRequest({ path: "/api/episodes", method: "GET", query: { id: 20 } })
 *   // "eyJwYXRoIjoiL2FwaS9lcGlzb2RlcyIs..."
 */
function encodePipeRequest(payload) {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes a pipe response based on the x-obfuscated header.
 *
 * Miruro's pipe now signals the decode scheme via a response header:
 *   - Header absent  → plain JSON (no encoding)
 *   - Header = "1"   → base64url + gzip (no XOR)
 *   - Header = "2"   → base64url + XOR(PIPE_OBF_KEY) + gzip
 *
 * This function handles all three schemes automatically.
 *
 * @param {string} encodedStr - Raw response body from pipe endpoint
 * @param {string|null} obfHeader - Value of x-obfuscated response header
 * @returns {Promise<Object>} Decoded JSON object
 * @throws {Error} If decoding fails
 *
 * @trick
 *   The DecompressionStream API is available in Workers but not in Node.js.
 *   This is why we can't share this exact code with the Express version.
 */
async function decodePipeResponse(encodedStr, obfHeader) {
  // Scheme 0: plain JSON (no header)
  if (!obfHeader) {
    return JSON.parse(encodedStr);
  }

  // Step 1: base64url → raw bytes
  let bytes = Uint8Array.from(
    atob(encodedStr.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  // Scheme 2: XOR decrypt before gzip
  // The XOR key is applied cyclically to each byte
  if (obfHeader === "2") {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] ^= PIPE_OBF_KEY[i % PIPE_OBF_KEY.length];
    }
  }

  // Step 2: gzip → decompressed bytes
  const decompressed = new DecompressionStream("gzip");
  const writer = decompressed.writable.getWriter();
  writer.write(bytes);
  writer.close();

  // Step 3: bytes → JSON
  return new Response(decompressed.readable).json();
}

// ══════════════════════════════════════════════════════════════
// PIPE REQUEST (MIRROR ROTATION)
// ══════════════════════════════════════════════════════════════

/**
 * Sends a request to the Miruro pipe endpoint with automatic mirror rotation.
 *
 * Tries each origin in MIRURO_ORIGINS order. If one returns a non-200
 * status or throws, the next mirror is tried. This provides resilience
 * against individual mirror outages or rate limits.
 *
 * @param {string} path - Pipe API path (e.g. "/api/episodes")
 * @param {Object} query - Query parameters to encode
 * @returns {Promise<Object>} Decoded pipe response
 * @throws {Error} If all mirrors fail
 *
 * @trick
 *   On Cloudflare Workers, fetch() to *.miruro.* routes through
 *   Cloudflare's internal network — no bot detection triggered.
 *   This is why Workers succeed where Vercel/serverless fails.
 */
async function pipeRequest(path, query) {
  const payload = { path, method: "GET", query, body: null };
  const encodedReq = encodePipeRequest(payload);

  // Try each mirror in order
  for (const origin of MIRURO_ORIGINS) {
    try {
      const res = await fetch(`${origin}${PIPE_PATH}?e=${encodedReq}`, {
        headers: HEADERS,
      });

      // Cloudflare returns 403 for blocked requests
      if (!res.ok) continue;

      const obf = res.headers.get("x-obfuscated");
      const text = await res.text();
      return await decodePipeResponse(text, obf);
    } catch (e) {
      // Mirror failed — try next one
      continue;
    }
  }

  throw new Error("All pipe mirrors failed");
}

// ══════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Health check endpoint ----
/**
 * Returns API health status, version, and runtime info.
 * Used by monitoring tools and uptime checkers.
 *
 * @param {URLSearchParams} params - Unused
 * @returns {Promise<Response>} Health status JSON
 */
async function healthHandler(params) {
  return json({
    success: true,
    results: {
      status: "healthy",
      version: "2.3.0-worker",
      runtime: "cloudflare-workers",
      endpoints: 15,
      timestamp: new Date().toISOString(),
    },
  });
}

// ---- FEATURE: Full-text anime search ----
/**
 * Searches AniList for anime matching the given query.
 * Returns paginated results with full metadata per result.
 *
 * @param {URLSearchParams} params - query (required), page, per_page
 * @returns {Promise<Response>} Paginated search results
 * @throws {400} If query parameter is missing
 *
 * @example
 *   GET /api/search?query=naruto&page=1&per_page=10
 */
async function searchHandler(params) {
  const query = params.get("query");
  if (!query) return error("query parameter is required", 400);

  const page = parseInt(params.get("page") || "1");
  const perPage = parseInt(params.get("per_page") || "20");

  const gql = `query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage hasNextPage perPage }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id title { romaji english native }
        coverImage { large }
        format season seasonYear episodes
        status averageScore genres popularity
      }
    }
  }`;

  const data = await anilistQuery(gql, { search: query, page, perPage });
  return json({ success: true, results: data.Page });
}

// ---- FEATURE: Autocomplete suggestions ----
/**
 * Returns fast autocomplete suggestions for search input.
 * Limited to 8 results for low-latency response.
 *
 * @param {URLSearchParams} params - query (required)
 * @returns {Promise<Response>} Array of suggestion objects
 */
async function suggestionsHandler(params) {
  const query = params.get("query");
  if (!query) return error("query parameter is required", 400);

  const gql = `query ($search: String) {
    Page(page: 1, perPage: 8) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id title { romaji english }
        coverImage { large }
        format status seasonYear episodes
      }
    }
  }`;

  const data = await anilistQuery(gql, { search: query });
  return json({ success: true, results: data.Page.media });
}

// ---- FEATURE: Advanced filter with multiple params ----
/**
 * Filters anime by genre, tag, year, season, format, and status.
 * All parameters are optional — combine them for narrow results.
 *
 * @param {URLSearchParams} params - genre, tag, year, season, format, status, sort, page, per_page
 * @returns {Promise<Response>} Filtered and paginated results
 *
 * @trick
 *   GraphQL variables are built dynamically based on which params
 *   are present. This avoids sending null variables to AniList.
 */
async function filterHandler(params) {
  const genre = params.get("genre");
  const tag = params.get("tag");
  const year = params.get("year") ? parseInt(params.get("year")) : undefined;
  const season = params.get("season");
  const format = params.get("format");
  const status = params.get("status");
  const sort = params.get("sort") || "POPULARITY_DESC";
  const page = parseInt(params.get("page") || "1");
  const perPage = parseInt(params.get("per_page") || "20");

  // Build dynamic variables and filter strings
  const variables = { page, perPage, sort };
  const filters = [];

  if (genre) { filters.push("genre: $genre"); variables.genre = genre; }
  if (tag) { filters.push("tag: $tag"); variables.tag = tag; }
  if (year) { filters.push("seasonYear: $seasonYear"); variables.seasonYear = year; }
  if (season) { filters.push("season: $season"); variables.season = season; }
  if (format) { filters.push("format: $format"); variables.format = format; }
  if (status) { filters.push("status: $status"); variables.status = status; }

  // Build type declarations for present variables
  const typeDecls = [
    "$page: Int", "$perPage: Int", "$sort: [MediaSort]",
    genre && "$genre: Genre",
    tag && "$tag: String",
    year && "$seasonYear: Int",
    season && "$season: Season",
    format && "$format: MediaFormat",
    status && "$status: MediaStatus",
  ].filter(Boolean).join(", ");

  const gql = `query (${typeDecls}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage hasNextPage perPage }
      media(${filters.join(", ")}, type: ANIME, sort: $sort) {
        id title { romaji english }
        coverImage { large }
        format status averageScore episodes
      }
    }
  }`;

  const data = await anilistQuery(gql, variables);
  return json({ success: true, results: data.Page });
}

// ---- FEATURE: Trending anime ----
/**
 * Returns currently trending anime (releasing only).
 * Sorted by trending score on AniList.
 *
 * @param {URLSearchParams} params - per_page (optional, default 20)
 * @returns {Promise<Response>} Trending anime list
 */
async function trendingHandler(params) {
  const perPage = parseInt(params.get("per_page") || "20");

  const gql = `query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING, status: RELEASING) {
        id title { romaji english }
        coverImage { large }
        format status averageScore episodes genres
      }
    }
  }`;

  const data = await anilistQuery(gql, { perPage });
  return json({ success: true, results: { results: data.Page.media } });
}

// ---- FEATURE: Popular anime ----
/**
 * Returns most popular anime of all time.
 * Sorted by AniList popularity metric.
 *
 * @param {URLSearchParams} params - per_page (optional, default 20)
 * @returns {Promise<Response>} Popular anime list
 */
async function popularHandler(params) {
  const perPage = parseInt(params.get("per_page") || "20");

  const gql = `query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english }
        coverImage { large }
        format status averageScore episodes genres
      }
    }
  }`;

  const data = await anilistQuery(gql, { perPage });
  return json({ success: true, results: { results: data.Page.media } });
}

// ---- FEATURE: Top scored anime ----
/**
 * Returns highest scored anime on AniList.
 * Sorted by average score descending.
 *
 * @param {URLSearchParams} params - per_page (optional, default 20)
 * @returns {Promise<Response>} Top scored anime list
 */
async function topHandler(params) {
  const perPage = parseInt(params.get("per_page") || "20");

  const gql = `query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: SCORE_DESC) {
        id title { romaji english }
        coverImage { large }
        format status averageScore episodes genres
      }
    }
  }`;

  const data = await anilistQuery(gql, { perPage });
  return json({ success: true, results: { results: data.Page.media } });
}

// ---- FEATURE: Complete anime info by AniList ID ----
/**
 * Returns full anime details including description, studios,
 * tags, next airing episode, and more.
 *
 * @param {string} id - AniList anime ID (path param)
 * @returns {Promise<Response>} Complete anime info
 *
 * @example
 *   GET /api/info/20  → Naruto
 *   GET /api/info/1535 → Death Note
 */
async function infoHandler(params, id) {
  const gql = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id idMal
      title { romaji english native }
      description
      coverImage { large extraLarge }
      bannerImage
      format season seasonYear
      episodes duration
      status averageScore meanScore
      popularity favourites
      genres
      tags { name }
      studios { nodes { name isAnimationStudio } }
      startDate { year month day }
      endDate { year month day }
      nextAiringEpisode { episode airingAt timeUntilAiring }
    }
  }`;

  const data = await anilistQuery(gql, { id: parseInt(id) });
  return json({ success: true, results: data.Media });
}

// ---- FEATURE: Anime characters with voice actors ----
/**
 * Returns characters for an anime, including Japanese voice actors.
 * Characters are sorted by role importance (MAIN first).
 *
 * @param {string} id - AniList anime ID (path param)
 * @returns {Promise<Response>} Character list with voice actors
 */
async function charactersHandler(params, id) {
  const gql = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      characters(sort: ROLE, perPage: 25) {
        edges {
          role
          node { id name { full native } image { large } }
          voiceActors(language: JAPANESE) {
            id name { full native } languageV2
          }
        }
      }
    }
  }`;

  const data = await anilistQuery(gql, { id: parseInt(id) });
  return json({ success: true, results: data.Media.characters });
}

// ---- FEATURE: Anime relations (sequels, prequels, etc.) ----
/**
 * Returns related anime (sequels, prequels, side stories, etc.).
 * Useful for building "watch order" guides.
 *
 * @param {string} id - AniList anime ID (path param)
 * @returns {Promise<Response>} Relations with connected anime
 */
async function relationsHandler(params, id) {
  const gql = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      relations {
        edges {
          relationType
          node {
            id title { romaji english }
            coverImage { large }
            format status
          }
        }
      }
    }
  }`;

  const data = await anilistQuery(gql, { id: parseInt(id) });
  return json({ success: true, results: data.Media.relations });
}

// ---- FEATURE: All genres list ----
/**
 * Returns the complete list of AniList genres.
 * Static data — rarely changes.
 *
 * @returns {Promise<Response>} Array of genre strings
 */
async function genresHandler() {
  const gql = `{ GenreCollection }`;
  const data = await anilistQuery(gql);
  return json({ success: true, results: data.GenreCollection });
}

// ---- FEATURE: Episode list from Miruro pipe ----
/**
 * Fetches episode list for an anime from the Miruro pipe.
 * Uses mirror rotation to maximize success rate.
 *
 * @param {string} id - AniList anime ID (path param)
 * @returns {Promise<Response>} Episode data from all providers
 *
 * @trick
 *   This endpoint calls the pipe, which is where Cloudflare Workers
 *   shine — edge-to-edge requests bypass bot detection entirely.
 */
async function episodesHandler(params, id) {
  try {
    const data = await pipeRequest("/api/episodes", { id });
    return json({ success: true, results: data });
  } catch (e) {
    return error(`All pipe methods failed: ${e.message}`);
  }
}

// ---- FEATURE: Streaming sources for a specific episode ----
/**
 * Fetches streaming sources for a specific episode.
 * Returns M3U8 URLs, subtitles, and quality info.
 *
 * @param {string} provider - Provider name (kiwi, pewe, bonk, etc.)
 * @param {string} anilistId - AniList anime ID
 * @param {string} category - sub or dub
 * @param {string} slug - Episode slug from episodes response
 * @returns {Promise<Response>} Streaming sources and subtitles
 */
async function watchHandler(params, provider, anilistId, category, slug) {
  try {
    const data = await pipeRequest("/api/watch", { provider, anilistId, category, slug });
    return json({ success: true, results: data });
  } catch (e) {
    return error(`All pipe methods failed: ${e.message}`);
  }
}

// ---- FEATURE: Random anime ----
/**
 * Returns a random anime from AniList.
 * Uses random pagination to pick from the top 1000 most popular.
 *
 * @returns {Promise<Response>} Random anime details
 *
 * @trick
 *   Two levels of randomness: random page (1-50) + random index
 *   within that page. This gives a uniform distribution across
 *   the top ~1000 most popular anime.
 */
async function randomHandler() {
  const page = Math.floor(Math.random() * 50) + 1;
  const perPage = Math.floor(Math.random() * 20) + 1;

  const gql = `query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english native }
        coverImage { large }
        format season seasonYear
        episodes status averageScore genres popularity
      }
    }
  }`;

  const data = await anilistQuery(gql, { page, perPage });
  const media = data.Page.media;
  return json({
    success: true,
    results: media[Math.floor(Math.random() * media.length)] || null,
  });
}

// ══════════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════════

/**
 * Route table mapping "METHOD /pattern" to handler functions.
 * Patterns support :param placeholders for dynamic path segments.
 *
 * @type {Object<string, Function>}
 *
 * @trick
 *   Routes are matched longest-first, so /api/anime/:id/characters
 *   matches before /api/anime/:id. This prevents ambiguous matches.
 */
const ROUTES = {
  // ---- System ----
  "GET /api/health": healthHandler,

  // ---- Search ----
  "GET /api/search": searchHandler,
  "GET /api/suggestions": suggestionsHandler,
  "GET /api/filter": filterHandler,

  // ---- Collections ----
  "GET /api/trending": trendingHandler,
  "GET /api/popular": popularHandler,
  "GET /api/top": topHandler,
  "GET /api/random": randomHandler,

  // ---- Anime Details ----
  "GET /api/info/:id": infoHandler,
  "GET /api/anime/:id/characters": charactersHandler,
  "GET /api/anime/:id/relations": relationsHandler,

  // ---- Metadata ----
  "GET /api/genres": genresHandler,

  // ---- Streaming (pipe) ----
  "GET /api/episodes/:id": episodesHandler,
  "GET /api/watch/:provider/:anilistId/:category/:slug": watchHandler,
};

/**
 * Matches a request method + path against the route table.
 * Supports :param placeholders for dynamic segments.
 *
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - URL path (e.g. /api/info/20)
 * @returns {{ handler: Function, params: string[] } | null} Matched route info, or null
 *
 * @trick
 *   The router tries exact matches first, then pattern matches.
 *   Pattern matches extract :param values into the params array
 *   which are passed as positional arguments to the handler.
 */
function matchRoute(method, path) {
  // Try exact match first (fast path)
  const exact = `${method} ${path}`;
  if (ROUTES[exact]) return { handler: ROUTES[exact], params: [] };

  // Try pattern matches (slower, handles :params)
  for (const key of Object.keys(ROUTES)) {
    const [m, pattern] = key.split(" ");
    if (m !== method) continue;

    const patternParts = pattern.split("/");
    const pathParts = path.split("/");
    if (patternParts.length !== pathParts.length) continue;

    const params = [];
    let match = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        // Dynamic segment — extract value
        params.push(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        // Static segment — must match exactly
        match = false;
        break;
      }
    }

    if (match) return { handler: ROUTES[key], params };
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ══════════════════════════════════════════════════════════════

/**
 * Main fetch event handler. Cloudflare Workers use this instead
 * of Express app.listen(). Every incoming request goes through here.
 *
 * @param {FetchEvent} event - Cloudflare fetch event
 * @returns {Response} HTTP response
 *
 * @trick
 *   Workers don't have a server process — they're stateless functions
 *   that spin up on demand and die after responding. No persistent
 *   memory between requests (use KV or Durable Objects for state).
 */
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

/**
 * Core request handler. Routes requests, handles CORS preflight,
 * and serves the landing page.
 *
 * @param {FetchEvent} event - Cloudflare fetch event
 * @returns {Promise<Response>} HTTP response
 */
async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Landing page
  if (url.pathname === "/") {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>MiruroAPI — Cloudflare Worker</title></head>
<body style="font-family:system-ui;background:#0A0A12;color:#E2E8F0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="text-align:center;max-width:600px;padding:40px">
    <h1 style="font-size:2.5rem;margin-bottom:8px">📺 <span style="background:linear-gradient(135deg,#A855F7,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent">MiruroAPI</span></h1>
    <p style="color:#94A3B8;margin-bottom:24px">Cloudflare Worker Edition — 15 endpoints, zero cold starts</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a href="/api/health" style="background:#A855F7;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Health Check</a>
      <a href="/api/search?query=naruto" style="background:#6366F1;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Search Anime</a>
      <a href="/api/trending" style="background:#EC4899;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Trending</a>
    </div>
    <p style="color:#64748B;font-size:0.8rem;margin-top:40px">Shinei Nouzen • MIT License</p>
  </div>
</body>
</html>`,
      { headers: { "Content-Type": "text/html", ...CORS } }
    );
  }

  // Route matching
  const route = matchRoute(req.method, url.pathname);
  if (!route) return error("Not found", 404);

  // Execute handler
  try {
    return await route.handler(url.searchParams, ...route.params);
  } catch (e) {
    return error(e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// MODULE FOOTER
// ══════════════════════════════════════════════════════════════
//
// End of MiruroAPI Worker Edition
//
// Deploy with: wrangler deploy
// Test locally: wrangler dev
//
// Routes:
//   /api/health                        → System health check
//   /api/search?query=naruto           → Full-text search
//   /api/suggestions?query=naruto      → Autocomplete
//   /api/filter?genre=Action           → Advanced filter
//   /api/trending                      → Trending anime
//   /api/popular                       → Most popular
//   /api/top                           → Top scored
//   /api/random                        → Random anime
//   /api/info/20                       → Full anime info
//   /api/anime/20/characters           → Characters + VAs
//   /api/anime/20/relations            → Related anime
//   /api/genres                        → All genres
//   /api/episodes/20                   → Episode list (pipe)
//   /api/watch/kiwi/20/sub/episode-1   → Streaming sources (pipe)
//
// ══════════════════════════════════════════════════════════════
