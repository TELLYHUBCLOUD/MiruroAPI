# Code Examples

All examples are tested and working with the live API.

---

## cURL

### Search

```bash
curl "https://mirurotvapi.vercel.app/api/search?query=naruto"
```

### Suggestions

```bash
curl "https://mirurotvapi.vercel.app/api/suggestions?query=naruto"
```

### Anime Info

```bash
curl "https://mirurotvapi.vercel.app/api/info/20"
```

### Episodes

```bash
curl "https://mirurotvapi.vercel.app/api/episodes/20"
```

### Characters

```bash
curl "https://mirurotvapi.vercel.app/api/anime/20/characters"
```

### Stream URL

```bash
curl "https://mirurotvapi.vercel.app/api/watch/kiwi/20/sub/animepahe-1"
```

### Filter

```bash
curl "https://mirurotvapi.vercel.app/api/filter?genre=Action&per_page=3"
```

### Trending

```bash
curl "https://mirurotvapi.vercel.app/api/trending?per_page=5"
```

### Popular

```bash
curl "https://mirurotvapi.vercel.app/api/popular?per_page=5"
```

### Schedule

```bash
curl "https://mirurotvapi.vercel.app/api/schedule?date=2026-06-09"
```

### Health

```bash
curl "https://mirurotvapi.vercel.app/api/health"
```

---

## JavaScript (Browser)

### Search

```javascript
async function searchAnime(query) {
  const res = await fetch(`https://mirurotvapi.vercel.app/api/search?query=${encodeURIComponent(query)}`);
  const data = await res.json();
  
  return data.results.results.map(anime => ({
    id: anime.id,
    title: anime.title.english || anime.title.romaji,
    format: anime.format,
    episodes: anime.episodes,
    score: anime.averageScore
  }));
}

searchAnime('naruto').then(results => {
  results.forEach(a => console.log(`${a.title} (${a.format}) — Score: ${a.score}`));
});
```

### Anime Info

```javascript
async function getAnimeInfo(anilistId) {
  const res = await fetch(`https://mirurotvapi.vercel.app/api/info/${anilistId}`);
  const data = await res.json();
  
  const info = data.results;
  console.log(`Title: ${info.title.english || info.title.romaji}`);
  console.log(`Format: ${info.format}`);
  console.log(`Status: ${info.status}`);
  console.log(`Episodes: ${info.episodes || 'Unknown'}`);
  console.log(`Score: ${info.averageScore}`);
  
  return info;
}

getAnimeInfo(20);
```

### Full Streaming Flow

```javascript
async function getStreamUrl(anilistId) {
  // Step 1: Get episodes
  const episodesRes = await fetch(`https://mirurotvapi.vercel.app/api/episodes/${anilistId}`);
  const episodesData = await episodesRes.json();
  const providers = episodesData.results.providers;
  
  const provider = Object.keys(providers)[0];
  const episodes = providers[provider].episodes.sub;
  
  if (!episodes || episodes.length === 0) {
    throw new Error('No episodes found');
  }
  
  const episodeId = episodes[0].id;
  const parts = episodeId.split('/');
  const category = parts[3];
  const slug = parts[4];
  
  // Step 2: Get stream URLs
  const streamRes = await fetch(`https://mirurotvapi.vercel.app/api/watch/${provider}/${anilistId}/${category}/${slug}`);
  const streamData = await streamRes.json();
  
  return streamData.results.streams[0].url;
}

// Usage
getStreamUrl(20)
  .then(url => {
    console.log('Stream URL:', url);
    // Use with HLS.js player
  })
  .catch(err => console.error('Error:', err.message));
```

### Characters

```javascript
async function getCharacters(anilistId) {
  const res = await fetch(`https://mirurotvapi.vercel.app/api/anime/${anilistId}/characters`);
  const data = await res.json();
  
  return data.results.edges.map(edge => ({
    name: edge.node.name.full,
    role: edge.role,
    voiceActor: edge.voiceActors[0]?.name.full || 'N/A'
  }));
}

getCharacters(20).then(chars => {
  chars.forEach(c => console.log(`${c.name} (${c.role}) — VA: ${c.voiceActor}`));
});
```

---

## Node.js (with axios)

### Search

```javascript
const axios = require('axios');

async function searchAnime(query) {
  const { data } = await axios.get('https://mirurotvapi.vercel.app/api/search', {
    params: { query }
  });
  
  return data.results.results;
}

searchAnime('naruto').then(results => {
  results.forEach(a => console.log(`${a.title.english || a.title.romaji}`));
});
```

### Full Streaming Flow

```javascript
const axios = require('axios');

async function getStreamUrl(anilistId) {
  const BASE = 'https://mirurotvapi.vercel.app/api';
  
  // Step 1: Get episodes
  const { data: episodesData } = await axios.get(`${BASE}/episodes/${anilistId}`);
  const providers = episodesData.results.providers;
  
  const provider = Object.keys(providers)[0];
  const episodes = providers[provider].episodes.sub;
  
  if (!episodes || episodes.length === 0) {
    throw new Error('No episodes found');
  }
  
  const episodeId = episodes[0].id;
  const parts = episodeId.split('/');
  const category = parts[3];
  const slug = parts[4];
  
  // Step 2: Get stream URLs
  const { data: streamData } = await axios.get(`${BASE}/watch/${provider}/${anilistId}/${category}/${slug}`);
  
  return streamData.results.streams[0].url;
}

// Usage
getStreamUrl(20)
  .then(url => console.log('Stream URL:', url))
  .catch(err => console.error('Error:', err.message));
```

### Filter by Genre

```javascript
const axios = require('axios');

async function filterAnime(genre, perPage = 5) {
  const { data } = await axios.get('https://mirurotvapi.vercel.app/api/filter', {
    params: { genre, per_page: perPage }
  });
  
  return data.results.results;
}

filterAnime('Action', 3).then(anime => {
  anime.forEach(a => console.log(`${a.title.english || a.title.romaji} (Score: ${a.averageScore})`));
});
```

### Schedule

```javascript
const axios = require('axios');

async function getSchedule(date) {
  const { data } = await axios.get('https://mirurotvapi.vercel.app/api/schedule', {
    params: { date }
  });
  
  console.log('Scheduled anime:', data.results.length);
  return data.results;
}

getSchedule('2026-06-09');
```
