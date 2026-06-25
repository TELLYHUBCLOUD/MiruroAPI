const axios = require("axios");

const PROXY_KEY = Buffer.from("a54d389c18527d9fd3e7f0643e27edbe", "hex");
const PRU_BASE = "https://pru.ultracloud.cc/";

function encodeForPru(rawUrl) {
  const urlBytes = Buffer.from(rawUrl, "utf-8");
  const xored = Buffer.alloc(urlBytes.length);
  for (let i = 0; i < urlBytes.length; i++) {
    xored[i] = urlBytes[i] ^ PROXY_KEY[i % PROXY_KEY.length];
  }
  return PRU_BASE + xored.toString("base64url");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Referer");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { url, referer } = req.query;
  if (!url) return res.status(400).json({ success: false, message: "url query parameter is required" });

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      Referer: referer || "https://vidtube.site/",
    };

    const response = await axios.get(url, {
      headers,
      timeout: 15000,
      responseType: "arraybuffer",
      validateStatus: (s) => s < 500,
    });

    const contentType = response.headers["content-type"] || "";
    res.setHeader("Cache-Control", "public, max-age=300");

    if (contentType.includes("mpegurl") || url.endsWith(".m3u8") || contentType.includes("x-mpegURL")) {
      let m3u8 = Buffer.from(response.data).toString("utf-8");
      const baseUrl = new URL(url);

      // Rewrite all URLs to go through pru.ultracloud.cc proxy
      m3u8 = m3u8.replace(/^(https?:\/\/[^\s]+)$/gm, (match) => {
        return encodeForPru(match);
      });
      // Rewrite relative URLs
      m3u8 = m3u8.replace(/^([^\s#<][^\s]*\.(m3u8|ts|m4s|m4v|mp4|cmfv|cmfa|vtt|srt|ass|json|aac|mp3))(?:\?[^\s]*)?$/gm, (match) => {
        const absolute = new URL(match, baseUrl).href;
        return encodeForPru(absolute);
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(m3u8);
    }

    // For segments/subtitles, pass through directly (they have CORS)
    res.setHeader("Content-Type", contentType);
    res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(500).json({ success: false, message: "Proxy failed: " + err.message });
  }
};
