import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.warn('Warning: GOOGLE_MAPS_API_KEY is not set. API routes will fail until you add it.');
}

app.use(cors());
app.use(express.json());

// Helper: fetch with timeout to avoid hanging on external APIs
async function fetchWithTimeout(resource, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

// --- Simple SEO evaluation helpers ---
function evaluateSeoHtml(html) {
  const $ = cheerio.load(html);

  const title = $('head > title').text().trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
  const h1Count = $('h1').length;
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robotsMeta = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const totalImages = $('img').length;
  const imagesWithAlt = $('img[alt]').length;

  let score = 50; // start from a neutral baseline

  // Title tag quality
  if (!title) {
    score -= 15;
  } else {
    const len = title.length;
    if (len >= 30 && len <= 65) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // Meta description quality
  if (!metaDescription) {
    score -= 15;
  } else {
    const len = metaDescription.length;
    if (len >= 50 && len <= 160) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // H1 usage
  if (h1Count === 0) {
    score -= 10;
  } else if (h1Count === 1) {
    score += 10;
  } else {
    score += 5;
  }

  // Canonical tag
  if (canonical) {
    score += 5;
  }

  // Robots meta (penalize noindex/nofollow)
  if (robotsMeta.includes('noindex') || robotsMeta.includes('nofollow')) {
    score -= 10;
  }

  // Image alt text coverage
  if (totalImages > 0) {
    const ratio = imagesWithAlt / totalImages;
    if (ratio >= 0.7) {
      score += 10;
    } else if (ratio >= 0.3) {
      score += 5;
    } else {
      score -= 5;
    }
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score));

  let grade = 'poor';
  if (score >= 75) {
    grade = 'good';
  } else if (score >= 45) {
    grade = 'average';
  }

  return { score, grade };
}

// Extract social media profile links from HTML
function extractSocialLinksFromHtml(html) {
  const $ = cheerio.load(html);
  const socialDomains = [
    'facebook.com',
    'instagram.com',
    'linkedin.com',
    'twitter.com',
    'x.com',
    'youtube.com',
    'tiktok.com'
  ];

  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim();
    if (!href) return;

    const lower = href.toLowerCase();
    const hasDomain = socialDomains.some((d) => lower.includes(d));
    if (!hasDomain) return;

    // Ignore sharing URLs with query-only params when possible
    if (lower.includes('share=') || lower.includes('intent/tweet')) return;

    // Normalize protocol-relative URLs
    const normalized = href.startsWith('http') ? href : href.startsWith('//') ? `https:${href}` : href;
    links.add(normalized);
  });

  return Array.from(links);
}

async function scrapeSocialLinksFromSite(url) {
  try {
    const resp = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'LocalBizScoutBot/1.0 (+https://example.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    }, 8000);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error('Non-HTML response');
    }

    const html = await resp.text();
    return extractSocialLinksFromHtml(html);
  } catch (err) {
    console.warn('HTML social scrape failed for', url, err?.message || err);
    return [];
  }
}

async function analyzeSeoForUrl(url) {
  let timeoutId;
  try {
    const controller = new AbortController();
    const timeoutMs = 7000;
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'LocalBizScoutBot/1.0 (+https://example.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error('Non-HTML response');
    }

    const html = await resp.text();
    const { score, grade } = evaluateSeoHtml(html);
    return { score, grade };
  } catch (err) {
    console.warn('SEO analysis failed for', url, err?.message || err);
    return { score: null, grade: null };
  } finally {
    // Clear timeout if it hasn't fired yet
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Google Maps Places Autocomplete for locations (countries/cities/areas)
app.get('/api/locations/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;

    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server' });
    }

    if (!input || typeof input !== 'string' || input.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const trimmed = input.trim();

    const autoUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    autoUrl.searchParams.set('input', trimmed);
    // Force results in English so Arabic/local scripts do not
    // appear in CSV exports.
    autoUrl.searchParams.set('language', 'en');
    autoUrl.searchParams.set('key', apiKey);

    const resp = await fetchWithTimeout(autoUrl, {}, 8000);
    const data = await resp.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Places autocomplete error:', data.status, data.error_message || '');
      return res.status(502).json({ error: 'Google Places autocomplete failed', details: data.status });
    }

    const predictions = Array.isArray(data.predictions) ? data.predictions : [];
    const suggestions = predictions
      .map((p) => p && typeof p.description === 'string' ? p.description : null)
      .filter(Boolean);

    res.json({ suggestions });
  } catch (err) {
    console.error('Backend /api/locations/autocomplete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google Maps-based autocomplete for business categories
app.get('/api/categories/autocomplete', async (req, res) => {
  try {
    const { input } = req.query;

    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server' });
    }

    if (!input || typeof input !== 'string' || input.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const trimmed = input.trim();

    const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    textUrl.searchParams.set('query', trimmed);
    textUrl.searchParams.set('language', 'en');
    textUrl.searchParams.set('key', apiKey);

    const resp = await fetchWithTimeout(textUrl, {}, 10000);
    const data = await resp.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Places category text search error:', data.status, data.error_message || '');
      return res.status(502).json({ error: 'Google Places text search failed', details: data.status });
    }

    const genericTypes = new Set([
      'point_of_interest',
      'establishment',
      'premise',
      'route',
      'street_address',
      'plus_code',
      'political',
      'country',
      'locality',
      'sublocality',
      'postal_code',
      'postal_town',
      'administrative_area_level_1',
      'administrative_area_level_2',
      'administrative_area_level_3',
      'administrative_area_level_4',
      'administrative_area_level_5'
    ]);

    const typeFrequency = new Map();

    const results = Array.isArray(data.results) ? data.results : [];
    for (const place of results) {
      const types = Array.isArray(place.types) ? place.types : [];
      for (const t of types) {
        if (!t || genericTypes.has(t)) continue;
        typeFrequency.set(t, (typeFrequency.get(t) || 0) + 1);
      }
    }

    const normalizedQuery = trimmed.toLowerCase();

    const ranked = Array.from(typeFrequency.entries())
      .map(([typeSlug, count]) => {
        const humanLabel = typeSlug
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const labelLc = humanLabel.toLowerCase();
        const relevanceBoost = labelLc.includes(normalizedQuery) ? 2 : 0;

        return {
          typeSlug,
          humanLabel,
          score: count + relevanceBoost
        };
      })
      .sort((a, b) => b.score - a.score);

    const suggestions = ranked
      .slice(0, 15)
      .map((item) => item.humanLabel)
      .filter((v, idx, arr) => v && arr.indexOf(v) === idx);

    res.json({ suggestions });
  } catch (err) {
    console.error('Backend /api/categories/autocomplete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// On-demand SEO check for a single URL
app.get('/api/seo-check', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query param is required' });
  }

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  const result = await analyzeSeoForUrl(normalizedUrl);
  if (result.score === null) {
    return res.status(502).json({ error: 'SEO analysis failed for this URL' });
  }

  res.json(result);
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
    textUrl.searchParams.set('language', 'en');
    textUrl.searchParams.set('key', apiKey);

    const textResp = await fetchWithTimeout(textUrl, {}, 10000);
    const textData = await textResp.json();

    if (textData.status !== 'OK' && textData.status !== 'ZERO_RESULTS') {
      console.error('Places text search error:', textData);
      return res.status(502).json({ error: 'Google Places text search failed', details: textData });
    }

    const places = (textData.results || []).slice(0, Number(limit));

    // Fetch place details in parallel with timeouts so the request
    // finishes in a predictable amount of time.
    const detailResults = [];
    const detailPromises = places.map(async (place) => {
      try {
        const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailsUrl.searchParams.set('place_id', place.place_id);
        // Request richer fields so we can fill CSV columns
        detailsUrl.searchParams.set('fields', 'name,formatted_address,address_components,formatted_phone_number,website,types,geometry,photos,editorial_summary');
        // Force details responses in English to avoid Arabic/local
        // scripts in address pieces.
        detailsUrl.searchParams.set('language', 'en');
        detailsUrl.searchParams.set('key', apiKey);

        const detailsResp = await fetchWithTimeout(detailsUrl, {}, 10000);
        const detailsData = await detailsResp.json();

        if (detailsData.status !== 'OK') {
          console.warn('Places details error for', place.place_id, detailsData.status);
          return null;
        }

        const result = detailsData.result || {};

        const addressComponents = Array.isArray(result.address_components)
          ? result.address_components
          : [];

        const getAddressPart = (type) => {
          const comp = addressComponents.find((c) => Array.isArray(c.types) && c.types.includes(type));
          return comp ? comp.long_name : null;
        };

        const streetNumber = getAddressPart('street_number');
        const route = getAddressPart('route');
        const street = [streetNumber, route].filter(Boolean).join(' ') || null;

        const country = getAddressPart('country');
        const city = getAddressPart('locality');
        const area = getAddressPart('sublocality') || getAddressPart('sublocality_level_1');
        const pincode = getAddressPart('postal_code');

        const locationGeo =
          result.geometry && result.geometry.location
            ? {
                lat: typeof result.geometry.location.lat === 'function'
                  ? result.geometry.location.lat()
                  : result.geometry.location.lat,
                lng: typeof result.geometry.location.lng === 'function'
                  ? result.geometry.location.lng()
                  : result.geometry.location.lng,
              }
            : { lat: null, lng: null };

        const primaryType = Array.isArray(result.types)
          ? result.types.find((t) => !!t)
          : null;
        const subCategory = primaryType
          ? primaryType
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : null;

        const photosArray = Array.isArray(result.photos) ? result.photos : [];
        const photoRefs = photosArray
          .map((p) => p && p.photo_reference)
          .filter(Boolean)
          .slice(0, 5);

        const imageUrls = photoRefs.map((ref) =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(
            ref
          )}&key=${apiKey}`
        );

        const imageUrl = imageUrls.length > 0 ? imageUrls[0] : place.icon || null;

        const description =
          result.editorial_summary && result.editorial_summary.overview
            ? result.editorial_summary.overview
            : null;

        const baseBiz = {
          id: place.place_id,
          name: result.name || place.name || 'Unknown Business',
          category: category,
          subCategory,
          description,
          address: result.formatted_address || place.formatted_address || 'No address listed',
          street,
          country,
          city,
          area,
          pincode,
          phone: result.formatted_phone_number || 'N/A',
          email: null,
          contactPersonName: null,
          registrationNo: null,
          companyLandline: result.formatted_phone_number || 'N/A',
          yearOfEstablishment: null,
          latitude: locationGeo.lat ?? null,
          longitude: locationGeo.lng ?? null,
          image: imageUrl,
          images: imageUrls.length > 0 ? imageUrls : null,
          website: result.website || null,
          socials: [],
          verificationNotes: 'Fetched from Google Places API',
          seoScore: null,
          seoGrade: null
        };

        return baseBiz;
      } catch (e) {
        console.warn('Places details fetch failed for', place.place_id, e?.message || e);
        return null;
      }
    });

    const detailSettled = await Promise.allSettled(detailPromises);
    for (const item of detailSettled) {
      if (item.status === 'fulfilled' && item.value) {
        detailResults.push(item.value);
      }
    }

    // Enrich with basic on-page SEO score/grade for a small subset of businesses that have a website
    // to keep response times reasonable.
    const seoTargets = detailResults.filter((biz) => biz.website).slice(0, 5);

    await Promise.allSettled(
      seoTargets.map(async (biz) => {
        const normalizedUrl = biz.website.startsWith('http')
          ? biz.website
          : `https://${biz.website}`;

        const seo = await analyzeSeoForUrl(normalizedUrl);
        biz.seoScore = seo.score;
        biz.seoGrade = seo.grade;

        if (seo.grade) {
          biz.verificationNotes += ` | SEO: ${seo.grade.toUpperCase()}`;
        }
      })
    );

    // Try to discover social links directly from website HTML for
    // a limited subset of businesses to keep response times reasonable.
    const socialScrapeTargets = detailResults.filter((biz) => biz.website).slice(0, 15);

    await Promise.allSettled(
      socialScrapeTargets.map(async (biz) => {
        const normalizedUrl = biz.website.startsWith('http')
          ? biz.website
          : `https://${biz.website}`;

        const socials = await scrapeSocialLinksFromSite(normalizedUrl);
        if (socials.length > 0) {
          biz.socials = socials;
          biz.verificationNotes += ' | Socials via HTML scan';
        }
      })
    );

    res.json(detailResults);
  } catch (err) {
    console.error('Backend /api/businesses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`LocalBiz backend listening on port ${port}`);
});
