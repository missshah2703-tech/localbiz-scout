import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn('Warning: GOOGLE_MAPS_API_KEY is not set. API routes will fail until you add it.');
}

let ai = null;
if (geminiKey) {
  ai = new GoogleGenAI({ apiKey: geminiKey });
} else {
  console.warn('Note: GOOGLE_GEMINI_API_KEY not set. Social media extraction will be skipped.');
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/businesses', async (req, res) => {
  const { location, category, limit = 10 } = req.query;

  if (!location || !category) {
    return res.status(400).json({ error: 'location and category are required query params' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server' });
  }

  try {
    const textQuery = `${category} in ${location}`;
    const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    textUrl.searchParams.set('query', textQuery);
    textUrl.searchParams.set('key', apiKey);

    const textResp = await fetch(textUrl);
    const textData = await textResp.json();

    if (textData.status !== 'OK' && textData.status !== 'ZERO_RESULTS') {
      console.error('Places text search error:', textData);
      return res.status(502).json({ error: 'Google Places text search failed', details: textData });
    }

    const places = (textData.results || []).slice(0, Number(limit));

    const detailResults = [];
    for (const place of places) {
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', place.place_id);
      detailsUrl.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,website,types');
      detailsUrl.searchParams.set('key', apiKey);

      const detailsResp = await fetch(detailsUrl);
      const detailsData = await detailsResp.json();

      if (detailsData.status !== 'OK') {
        console.warn('Places details error for', place.place_id, detailsData.status);
        continue;
      }

      const result = detailsData.result || {};

      detailResults.push({
        id: place.place_id,
        name: result.name || place.name || 'Unknown Business',
        category: category,
        address: result.formatted_address || place.formatted_address || 'No address listed',
        phone: result.formatted_phone_number || 'N/A',
        website: result.website || null,
        socials: [],
        verificationNotes: 'Fetched from Google Places API'
      });
    }

    // Optional: enrich with social links using Gemini when website exists
    if (ai) {
      for (const biz of detailResults) {
        if (!biz.website) continue;
        try {
          const prompt = `You are given a business website URL. If you can confidently identify official social media profile URLs for this business (Facebook, Instagram, LinkedIn, X/Twitter, YouTube), return them.

Rules:
- Only return links you are confident are official profiles for this same business.
- Do not guess or fabricate handles.
- If you are not sure, return an empty array.
- Respond with ONLY valid JSON: an array of URL strings, no comments, no extra text.

Website: ${biz.website}`;

          const gRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              temperature: 0.1,
            },
          });

          let text = gRes.text || '';
          text = String(text).trim();

          // Extract JSON array if wrapped in code fences
          const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (match && match[1]) {
            text = match[1].trim();
          }

          let socials = [];
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              socials = parsed.filter((u) => typeof u === 'string' && u.startsWith('http'));
            }
          } catch {
            console.warn('Gemini social parse failed for', biz.website);
          }

          if (socials.length > 0) {
            biz.socials = socials;
            biz.verificationNotes += ' | Socials via Gemini';
          }
        } catch (e) {
          console.warn('Gemini social lookup failed for', biz.website, e?.message || e);
        }
      }
    }

    res.json(detailResults);
  } catch (err) {
    console.error('Backend /api/businesses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`LocalBiz backend listening on port ${port}`);
});
