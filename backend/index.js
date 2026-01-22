import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

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

// Simple sleep helper (used for handling Google next_page_token delays)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Geocode a human-readable location string into a lat/lng center
async function geocodeLocationString(locationText) {
  try {
    const geoUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    geoUrl.searchParams.set('address', locationText);
    geoUrl.searchParams.set('key', apiKey);

    const resp = await fetchWithTimeout(geoUrl, {}, 10000);
    const data = await resp.json();

    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      console.warn('Geocoding failed for location:', locationText, data.status, data.error_message || '');
      return null;
    }

    const loc = data.results[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return null;
    }

    return { lat: loc.lat, lng: loc.lng };
  } catch (err) {
    console.warn('Geocoding error for location:', locationText, err?.message || err);
    return null;
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

app.get('/api/businesses', async (req, res) => {
  const { location, category } = req.query;

  if (!location || !category) {
    return res.status(400).json({ error: 'location and category are required query params' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server' });
  }

  try {
    const trimmedLocation = String(location).trim();
    const trimmedCategory = String(category).trim();

    // We'll run multiple related text queries and paginate each to
    // collect more unique businesses than a single query (~60 max).
    const textQueries = [
      `${trimmedCategory} in ${trimmedLocation}`,
      `${trimmedCategory} near ${trimmedLocation}`,
      `${trimmedCategory} ${trimmedLocation}`,
    ];

    // Hard cap for how many unique places we will process per request
    const MAX_TOTAL_RESULTS = 500;
    const MAX_PAGES_PER_QUERY = 3; // Google usually allows up to 3 pages
    const allPlacesMap = new Map(); // place_id -> text search result

    for (const textQuery of textQueries) {
      if (allPlacesMap.size >= MAX_TOTAL_RESULTS) break;

      let pageToken = null;
      let pageCount = 0;

      // Paginate through results for this query
      while (pageCount < MAX_PAGES_PER_QUERY && allPlacesMap.size < MAX_TOTAL_RESULTS) {
        const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');

        if (pageToken) {
          textUrl.searchParams.set('pagetoken', pageToken);
        } else {
          textUrl.searchParams.set('query', textQuery);
        }

        textUrl.searchParams.set('language', 'en');
        textUrl.searchParams.set('key', apiKey);

        // When using next_page_token, Google may require a short delay
        if (pageToken) {
          await sleep(2000);
        }

        const textResp = await fetchWithTimeout(textUrl, {}, 10000);
        const textData = await textResp.json();

        if (textData.status === 'INVALID_REQUEST' && pageToken) {
          // next_page_token not ready yet; wait a bit and retry this page once
          await sleep(2000);
          continue;
        }

        if (textData.status !== 'OK' && textData.status !== 'ZERO_RESULTS') {
          console.error('Places text search error:', textData.status, textData.error_message || '');
          break;
        }

        const results = Array.isArray(textData.results) ? textData.results : [];
        for (const place of results) {
          if (!place || !place.place_id) continue;
          if (!allPlacesMap.has(place.place_id)) {
            allPlacesMap.set(place.place_id, place);
          }
        }

        if (textData.next_page_token && results.length > 0) {
          pageToken = textData.next_page_token;
          pageCount += 1;
        } else {
          break;
        }
      }
    }

    // Deepen coverage inside the city using a small grid of Nearby Search calls
    const center = await geocodeLocationString(trimmedLocation);
    if (center && allPlacesMap.size < MAX_TOTAL_RESULTS) {
      const NEARBY_RADIUS_METERS = 2000;
      const MAX_PAGES_PER_NEARBY = 3;
      const OFFSETS = [-1, 0, 1]; // 3x3 grid around the geocoded center

      const latUnit = NEARBY_RADIUS_METERS / 111000; // approx degrees per radius north/south
      const cosLat = Math.cos((center.lat * Math.PI) / 180) || 1;
      const lngUnit = NEARBY_RADIUS_METERS / (111000 * cosLat); // degrees per radius east/west

      for (const di of OFFSETS) {
        for (const dj of OFFSETS) {
          if (allPlacesMap.size >= MAX_TOTAL_RESULTS) break;

          const lat = center.lat + di * latUnit;
          const lng = center.lng + dj * lngUnit;

          let pageToken = null;
          let pageCount = 0;

          while (pageCount < MAX_PAGES_PER_NEARBY && allPlacesMap.size < MAX_TOTAL_RESULTS) {
            const nearUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');

            nearUrl.searchParams.set('location', `${lat},${lng}`);
            nearUrl.searchParams.set('radius', String(NEARBY_RADIUS_METERS));
            nearUrl.searchParams.set('keyword', trimmedCategory);
            nearUrl.searchParams.set('language', 'en');
            nearUrl.searchParams.set('key', apiKey);

            if (pageToken) {
              nearUrl.searchParams.set('pagetoken', pageToken);
            }

            if (pageToken) {
              await sleep(2000);
            }

            const nearResp = await fetchWithTimeout(nearUrl, {}, 10000);
            const nearData = await nearResp.json();

            if (nearData.status === 'INVALID_REQUEST' && pageToken) {
              await sleep(2000);
              continue;
            }

            if (nearData.status !== 'OK' && nearData.status !== 'ZERO_RESULTS') {
              console.error('Nearby search error:', nearData.status, nearData.error_message || '');
              break;
            }

            const nearResults = Array.isArray(nearData.results) ? nearData.results : [];
            for (const place of nearResults) {
              if (!place || !place.place_id) continue;
              if (!allPlacesMap.has(place.place_id)) {
                allPlacesMap.set(place.place_id, place);
              }
            }

            if (nearData.next_page_token && nearResults.length > 0) {
              pageToken = nearData.next_page_token;
              pageCount += 1;
            } else {
              break;
            }
          }
        }
      }
    }

    const places = Array.from(allPlacesMap.values()).slice(0, MAX_TOTAL_RESULTS);
    const detailResults = await fetchBusinessDetailsForPlaces(places, category);

    res.json(detailResults);
  } catch (err) {
    console.error('Backend /api/businesses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Shared helper to fetch full business details for a list of Places search results
async function fetchBusinessDetailsForPlaces(places, category) {
  const detailResults = [];

  const detailPromises = places.map(async (place) => {
    let result = null;

    // First, try to fetch full details. If this fails or returns a
    // non-OK status, we will still fall back to building a business
    // record from the basic search result so we don't lose data.
    try {
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', place.place_id);
      // Request richer fields so we can fill CSV columns
      detailsUrl.searchParams.set('fields', 'name,formatted_address,address_components,formatted_phone_number,website,types,geometry,photos,editorial_summary');
      // Force details responses in English to avoid Arabic/local
      // scripts in address pieces.
      detailsUrl.searchParams.set('language', 'en');
      detailsUrl.searchParams.set('key', apiKey);

      // Details calls can be slow when we fetch hundreds of
      // places, so allow a longer timeout here.
      const detailsResp = await fetchWithTimeout(detailsUrl, {}, 30000);
      const detailsData = await detailsResp.json();

      if (detailsData.status !== 'OK') {
        console.warn('Places details error for', place.place_id, detailsData.status);
      } else {
        result = detailsData.result || {};
      }
    } catch (e) {
      console.warn('Places details fetch failed for', place.place_id, e?.message || e);
    }

    try {
      const addressComponents = Array.isArray(result?.address_components)
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

      let locationGeo = { lat: null, lng: null };
      if (result && result.geometry && result.geometry.location) {
        locationGeo = {
          lat: typeof result.geometry.location.lat === 'function'
            ? result.geometry.location.lat()
            : result.geometry.location.lat,
          lng: typeof result.geometry.location.lng === 'function'
            ? result.geometry.location.lng()
            : result.geometry.location.lng,
        };
      } else if (place.geometry && place.geometry.location) {
        locationGeo = {
          lat: typeof place.geometry.location.lat === 'function'
            ? place.geometry.location.lat()
            : place.geometry.location.lat,
          lng: typeof place.geometry.location.lng === 'function'
            ? place.geometry.location.lng()
            : place.geometry.location.lng,
        };
      }

      const primaryType = Array.isArray(result?.types)
        ? result.types.find((t) => !!t)
        : (Array.isArray(place.types) ? place.types.find((t) => !!t) : null);

      const subCategory = primaryType
        ? primaryType
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : null;

      const photosArray = Array.isArray(result?.photos)
        ? result.photos
        : (Array.isArray(place.photos) ? place.photos : []);

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
        (result && result.editorial_summary && result.editorial_summary.overview
          ? result.editorial_summary.overview
          : null) || place.vicinity || null;

      const baseBiz = {
        id: place.place_id,
        name: (result && result.name) || place.name || 'Unknown Business',
        category: category,
        subCategory,
        description,
        address:
          (result && result.formatted_address) ||
          place.formatted_address ||
          place.vicinity ||
          'No address listed',
        street,
        country,
        city,
        area,
        pincode,
        phone:
          (result && result.formatted_phone_number) ||
          place.formatted_phone_number ||
          'N/A',
        email: null,
        contactPersonName: null,
        registrationNo: null,
        companyLandline:
          (result && result.formatted_phone_number) ||
          place.formatted_phone_number ||
          'N/A',
        yearOfEstablishment: null,
        latitude: locationGeo.lat ?? null,
        longitude: locationGeo.lng ?? null,
        image: imageUrl,
        images: imageUrls.length > 0 ? imageUrls : null,
        website: (result && result.website) || place.website || null,
        socials: [],
        verificationNotes: result
          ? 'Fetched from Google Places API (details)'
          : 'Fetched from Google Places API (search fallback)',
        seoScore: null,
        seoGrade: null
      };

      return baseBiz;
    } catch (e2) {
      console.warn('Failed to build business object for', place.place_id, e2?.message || e2);
      return null;
    }
  });

  const detailSettled = await Promise.allSettled(detailPromises);
  for (const item of detailSettled) {
    if (item.status === 'fulfilled' && item.value) {
      detailResults.push(item.value);
    }
  }

  return detailResults;
}

// Deep search endpoint: use geocoding + grid of Nearby Search around a city/area
app.get('/api/businesses/deep', async (req, res) => {
  const { location, category, limit } = req.query;

  if (!location || !category) {
    return res.status(400).json({ error: 'location and category are required query params' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server' });
  }

  try {
    const trimmedLocation = String(location).trim();
    const trimmedCategory = String(category).trim();

    // 1) Geocode location string to get a center lat/lng for the grid
    const geoUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    geoUrl.searchParams.set('address', trimmedLocation);
    geoUrl.searchParams.set('language', 'en');
    geoUrl.searchParams.set('key', apiKey);

    const geoResp = await fetchWithTimeout(geoUrl, {}, 10000);
    const geoData = await geoResp.json();

    if (geoData.status !== 'OK' || !Array.isArray(geoData.results) || geoData.results.length === 0) {
      console.warn('Geocoding failed for deep search location:', trimmedLocation, geoData.status, geoData.error_message || '');
      return res.status(502).json({ error: 'Google Geocoding failed for deep search location', details: geoData.status });
    }

    const centerLocation = geoData.results[0]?.geometry?.location;
    if (!centerLocation || typeof centerLocation.lat !== 'number' || typeof centerLocation.lng !== 'number') {
      console.warn('Geocoding missing geometry for deep search location:', trimmedLocation);
      return res.status(502).json({ error: 'Google Geocoding returned no coordinates for location' });
    }

    const centerLat = centerLocation.lat;
    const centerLng = centerLocation.lng;

    // Determine desired max results from optional "limit" query
    // (frontend sends e.g. 600). This controls how heavy the grid
    // search should be so normal UI searches stay reasonably fast
    // while crawler/batch jobs can still push higher.
    let requestedLimit = 7000;
    if (typeof limit === 'string') {
      const parsed = Number(limit);
      if (Number.isFinite(parsed) && parsed > 0) {
        requestedLimit = parsed;
      }
    }

    // Hard cap on total results regardless of requested limit
    const MAX_TOTAL_RESULTS = Math.min(Math.max(Math.floor(requestedLimit), 50), 7000);

    // 2) Build a simple grid of lat/lng points around the center.
    // We dynamically adjust grid density and radius depending on
    // how many results are requested so that interactive searches
    // (limit ~600) are lighter and faster than full deep crawls.
    let GRID_STEPS = 5; // default 5x5 grid
    let GRID_RADIUS_METERS = 8000; // default 8km
    let MAX_PAGES_PER_POINT = 3; // Nearby Search allows up to 3 pages

    if (MAX_TOTAL_RESULTS <= 800) {
      // Light mode: metro/area-level quick scan
      GRID_STEPS = 3; // 3x3 grid
      GRID_RADIUS_METERS = 6000; // 6km radius
      MAX_PAGES_PER_POINT = 2;
    } else if (MAX_TOTAL_RESULTS >= 3000) {
      // Heavy mode: wide coverage for crawler / big searches
      GRID_STEPS = 7; // 7x7 grid (49 points)
      GRID_RADIUS_METERS = 10000; // 10km radius
      MAX_PAGES_PER_POINT = 3;
    }

    const metersPerDegLat = 111320; // approx
    const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

    const latStep = GRID_RADIUS_METERS / metersPerDegLat;
    const lngStep = GRID_RADIUS_METERS / metersPerDegLng;

    const gridPoints = [];
    const half = Math.floor(GRID_STEPS / 2);
    for (let i = -half; i <= half; i++) {
      for (let j = -half; j <= half; j++) {
        gridPoints.push({
          lat: centerLat + i * latStep,
          lng: centerLng + j * lngStep,
        });
      }
    }

    const allPlacesMap = new Map(); // place_id -> nearby search result

    // Build multiple keyword variants to widen coverage for
    // popular categories like Restaurants, Schools, etc.
    const keywordSet = new Set();
    keywordSet.add(trimmedCategory);
    const catLc = trimmedCategory.toLowerCase();

    if (catLc.includes('restaurant')) {
      [
        'restaurant',
        'fast food restaurant',
        'fast food',
        'cafe',
        'coffee shop',
        'dining',
        'family restaurant',
        'grill restaurant',
        'pizza restaurant',
        'burger restaurant',
      ].forEach((k) => keywordSet.add(k));
    }
    if (catLc.includes('cafe')) {
      [
        'cafe',
        'coffee shop',
        'coffee',
        'tea house',
        'bakery',
        'restaurant',
      ].forEach((k) => keywordSet.add(k));
    }
    if (catLc.includes('school')) {
      [
        'school',
        'primary school',
        'secondary school',
        'high school',
        'academy',
        'college',
        'university',
        'institute',
        'training center',
      ].forEach((k) => keywordSet.add(k));
    }
    if (catLc.includes('clothing') || catLc.includes('fashion') || catLc.includes('apparel')) {
      [
        'clothing store',
        'fashion store',
        'garments shop',
        'boutique',
        'mens clothing store',
        'womens clothing store',
        'kids clothing store',
      ].forEach((k) => keywordSet.add(k));
    }
    if (catLc.includes('supermarket') || catLc.includes('grocery')) {
      [
        'supermarket',
        'grocery store',
        'hypermarket',
        'mini mart',
        'convenience store',
        'department store',
      ].forEach((k) => keywordSet.add(k));
    }
    if (catLc.includes('salon') || catLc.includes('beauty')) {
      [
        'beauty salon',
        'hair salon',
        'barbershop',
        'spa',
        'nail salon',
        'beauty parlour',
      ].forEach((k) => keywordSet.add(k));
    }

    const keywordVariants = Array.from(keywordSet);

    // 3) For each keyword and grid point, run Nearby Search with
    // pagination and accumulate unique places up to MAX_TOTAL_RESULTS
    for (const keyword of keywordVariants) {
      if (allPlacesMap.size >= MAX_TOTAL_RESULTS) break;

      for (const point of gridPoints) {
        if (allPlacesMap.size >= MAX_TOTAL_RESULTS) break;

        let pageToken = null;
        let pageCount = 0;

        while (pageCount < MAX_PAGES_PER_POINT && allPlacesMap.size < MAX_TOTAL_RESULTS) {
          const nearbyUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');

          nearbyUrl.searchParams.set('location', `${point.lat},${point.lng}`);
          nearbyUrl.searchParams.set('radius', String(GRID_RADIUS_METERS));
          nearbyUrl.searchParams.set('keyword', keyword);
          nearbyUrl.searchParams.set('language', 'en');
          nearbyUrl.searchParams.set('key', apiKey);

          if (pageToken) {
            nearbyUrl.searchParams.set('pagetoken', pageToken);
            // next_page_token requires a short delay before it becomes valid
            await sleep(2000);
          }

          const nearbyResp = await fetchWithTimeout(nearbyUrl, {}, 10000);
          const nearbyData = await nearbyResp.json();

          if (nearbyData.status === 'INVALID_REQUEST' && pageToken) {
            // next_page_token not ready yet; wait a bit and retry this page once
            await sleep(2000);
            continue;
          }

          if (nearbyData.status !== 'OK' && nearbyData.status !== 'ZERO_RESULTS') {
            console.error('Nearby Search error (deep):', nearbyData.status, nearbyData.error_message || '');
            break;
          }

          const results = Array.isArray(nearbyData.results) ? nearbyData.results : [];
          for (const place of results) {
            if (!place || !place.place_id) continue;
            if (!allPlacesMap.has(place.place_id)) {
              allPlacesMap.set(place.place_id, place);
            }
          }

          if (nearbyData.next_page_token && results.length > 0) {
            pageToken = nearbyData.next_page_token;
            pageCount += 1;
          } else {
            break;
          }
        }
      }
    }

    const places = Array.from(allPlacesMap.values()).slice(0, MAX_TOTAL_RESULTS);
    const detailResults = await fetchBusinessDetailsForPlaces(places, trimmedCategory);

    res.json(detailResults);
  } catch (err) {
    console.error('Backend /api/businesses/deep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy endpoint to fetch a single Place photo image.
// This lets CSV "Image" links open just the image without
// exposing the API key or depending on referrer restrictions.
app.get('/api/place-photo', async (req, res) => {
  const { photo_reference, maxwidth } = req.query;

  if (!photo_reference || typeof photo_reference !== 'string') {
    return res.status(400).json({ error: 'photo_reference query param is required' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured on the server' });
  }

  try {
    const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
    photoUrl.searchParams.set('photo_reference', photo_reference);
    photoUrl.searchParams.set('maxwidth', String(maxwidth || 800));
    photoUrl.searchParams.set('key', apiKey);

    const photoResp = await fetchWithTimeout(photoUrl, { redirect: 'follow' }, 15000);

    const contentType = photoResp.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);

    res.status(photoResp.status);
    if (photoResp.body) {
      photoResp.body.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error('Backend /api/place-photo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`LocalBiz backend listening on port ${port}`);
});
