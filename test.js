/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — test.js
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   Integration test suite for MiruroAPI endpoints.
 *   Tests all major endpoints for correct response format.
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const BASE = process.env.API_URL || "https://mirurotvapi.vercel.app/api";

const tests = [
  { name: "Health", url: "/health" },
  { name: "Stats", url: "/stats" },
  { name: "OpenAPI", url: "/openapi" },
  { name: "Search", url: "/search?query=naruto" },
  { name: "Suggestions", url: "/suggestions?query=naruto" },
  { name: "Filter", url: "/filter?genre=Action&per_page=1" },
  { name: "Trending", url: "/trending?per_page=1" },
  { name: "Popular", url: "/popular?per_page=1" },
  { name: "Upcoming", url: "/upcoming?per_page=1" },
  { name: "Recent", url: "/recent?per_page=1" },
  { name: "Spotlight", url: "/spotlight" },
  { name: "Schedule", url: "/schedule" },
  { name: "Info", url: "/info/20" },
  { name: "Characters", url: "/anime/20/characters" },
  { name: "Relations", url: "/anime/20/relations" },
  { name: "Recommendations", url: "/anime/20/recommendations" },
  { name: "Episodes", url: "/episodes/20" },
  { name: "Watch", url: "/watch/kiwi/20/sub/animepahe-1" },
];

let passed = 0;
let failed = 0;

async function runTest(test) {
  try {
    const res = await fetch(`${BASE}${test.url}`);
    if (!res.ok) {
      console.log(`❌ ${test.name} - HTTP ${res.status}`);
      failed++;
      return;
    }
    const data = await res.json();
    if (data.success === true && data.results) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name} - Invalid response format`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - ${error.message}`);
    failed++;
  }
}

async function runAll() {
  console.log(`\n🧪 Running ${tests.length} tests...\n`);

  for (const test of tests) {
    await runTest(test);
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
