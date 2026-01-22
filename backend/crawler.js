import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Load environment variables (PORT, GOOGLE_MAPS_API_KEY, etc.)
dotenv.config();

// Base URL of your running backend API (must have /api/businesses)
const API_BASE_URL = process.env.CRAWLER_API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;

// ---------------------------------------------------------------------------
// CONFIGURATION: countries, locations (cities/areas) and categories for bulk search
// ---------------------------------------------------------------------------
// Each entry is a "search group" (country + cities/areas + categories)
// that the crawler will run through. This structure is ready to cover
// the whole GCC. You can freely add/remove cities and categories
// according to your client's master lists.

const SEARCH_GROUPS = [
  {
    country: 'UAE',
    locations: [
      'Dubai - United Arab Emirates',
      'Abu Dhabi - United Arab Emirates',
      'Sharjah - United Arab Emirates',
      'Ajman - United Arab Emirates',
      'Al Ain - United Arab Emirates',
    ],
    categories: [
      'Restaurant',
      'Clothing Store',
      'Real Estate Agent',
      'Supermarket',
      'Beauty Salon',
    ],
  },
  {
    country: 'Saudi Arabia',
    locations: [
      'Riyadh - Saudi Arabia',
      'Jeddah - Saudi Arabia',
      'Dammam - Saudi Arabia',
      'Khobar - Saudi Arabia',
      'Mecca - Saudi Arabia',
      'Medina - Saudi Arabia',
    ],
    categories: [
      'Restaurant',
      'Clothing Store',
      'Real Estate Agent',
      'Supermarket',
      'Beauty Salon',
    ],
  },
  {
    country: 'Qatar',
    locations: [
      'Doha - Qatar',
      'Al Wakrah - Qatar',
      'Al Rayyan - Qatar',
    ],
    categories: [
      'Restaurant',
      'Clothing Store',
      'Real Estate Agent',
      'Supermarket',
      'Beauty Salon',
    ],
  },
  {
    country: 'Oman',
    locations: [
      'Muscat - Oman',
      'Salalah - Oman',
      'Sohar - Oman',
    ],
    categories: [
      'Restaurant',
      'Clothing Store',
      'Real Estate Agent',
      'Supermarket',
      'Beauty Salon',
    ],
  },
  {
    country: 'Bahrain',
    locations: [
      'Manama - Bahrain',
      'Riffa - Bahrain',
      'Muharraq - Bahrain',
    ],
    categories: [
      'Restaurant',
      'Clothing Store',
      'Real Estate Agent',
      'Supermarket',
      'Beauty Salon',
    ],
  },
  {
    country: 'Kuwait',
    locations: [
      'Kuwait City - Kuwait',
      'Farwaniya - Kuwait',
      'Hawally - Kuwait',
    ],
    categories: [
      'Restaurant',
      'Clothing Store',
      'Real Estate Agent',
      'Supermarket',
      'Beauty Salon',
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper: simple fetch with timeout
// ---------------------------------------------------------------------------
async function fetchWithTimeout(resource, options = {}, timeoutMs = 60000) {
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

// ---------------------------------------------------------------------------
// Helper: escape CSV field
// ---------------------------------------------------------------------------
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const stringVal = String(val);
  if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
    return '"' + stringVal.replace(/"/g, '""') + '"';
  }
  return stringVal;
}

// ---------------------------------------------------------------------------
// Convert businesses to CSV text (same columns as frontend export)
// ---------------------------------------------------------------------------
function businessesToCsv(businesses) {
  const headers = [
    'Sr No',
    'Name',
    'Email',
    'Category',
    'Sub Category',
    'Description',
    'Location',
    'Street',
    'Country',
    'City',
    'Area',
    'Pincode',
    'Contact Person Name',
    'Contact No',
    'Website',
    'Registration No',
    'Company Landline',
    'Year Of Establishment',
    'Latitude',
    'Longitude',
    'Image',
  ];

  const rows = [];
  rows.push(headers.join(','));

  let counter = 1;

  for (const biz of businesses) {
    // Build Google Maps URL for clickable location cell
    let locationCell = '';
    if (biz.id && biz.name) {
      const query = biz.name;
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(biz.id)}`;
    } else if (biz.latitude != null && biz.longitude != null) {
      const query = `${biz.latitude},${biz.longitude}`;
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    } else if (biz.address) {
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`;
    }

    const imageList = [biz.image, ...(biz.images || [])].filter((v) => !!v);

    // For the Image column, prefer a direct photo via our
    // backend proxy /api/place-photo when photo_reference is
    // present in the URL.
    let imageCell = '';
    const firstImageUrl = imageList[0];
    if (firstImageUrl) {
      const match = /photo_reference=([^&]+)/.exec(firstImageUrl);
      if (match && match[1]) {
        const photoRef = decodeURIComponent(match[1]);
        imageCell = `${API_BASE_URL}/api/place-photo?photo_reference=${encodeURIComponent(photoRef)}&maxwidth=800`;
      }
    }

    // Fallback: if no real photo, link to the place page so
    // user can still see any images there.
    if (!imageCell && biz.id && biz.name) {
      const query = biz.name;
      imageCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(biz.id)}`;
    }

    const row = [
      String(counter),
      escapeCsv(biz.name),
      escapeCsv(biz.email ?? null),
      escapeCsv(biz.category),
      escapeCsv(biz.subCategory ?? null),
      escapeCsv(biz.description ?? null),
      escapeCsv(locationCell || biz.address || ''),
      escapeCsv(biz.street ?? null),
      escapeCsv(biz.country ?? null),
      escapeCsv(biz.city ?? null),
      escapeCsv(biz.area ?? null),
      escapeCsv(biz.pincode ?? null),
      escapeCsv(biz.contactPersonName ?? null),
      escapeCsv(biz.phone),
      escapeCsv(biz.website),
      escapeCsv(biz.registrationNo ?? null),
      escapeCsv(biz.companyLandline ?? null),
      escapeCsv(biz.yearOfEstablishment ?? null),
      biz.latitude != null ? String(biz.latitude) : '',
      biz.longitude != null ? String(biz.longitude) : '',
      escapeCsv(imageCell || (imageList.length > 0 ? imageList.join(' | ') : null)),
    ].join(',');

    rows.push(row);
    counter += 1;
  }

  // Prepend UTF-8 BOM for Excel
  const csvContent = '\uFEFF' + rows.join('\n');
  return csvContent;
}

// ---------------------------------------------------------------------------
// MAIN: run batch crawler over all configured search groups
// ---------------------------------------------------------------------------
async function runCrawler() {
  console.log('Batch crawler starting...');
  console.log('API base URL:', API_BASE_URL);

  const allBizMap = new Map(); // place_id -> business (unique across all groups)
  const stats = [];

  for (const group of SEARCH_GROUPS) {
    for (const location of group.locations) {
      for (const category of group.categories) {
        console.log(`Deep fetching: country=${group.country}, location="${location}", category="${category}"`);

        // Use the deep search endpoint which performs a grid of
        // Nearby Search calls around the city/area to get more
        // coverage than a single text search.
        const url = new URL('/api/businesses/deep', API_BASE_URL);
        url.searchParams.set('location', location);
        url.searchParams.set('category', category);

        try {
          const resp = await fetchWithTimeout(url.toString(), {}, 10 * 60 * 1000); // up to 10 minutes per combo
          if (!resp.ok) {
            console.error('Request failed with status', resp.status, 'for', url.toString());
            stats.push({ country: group.country, location, category, status: 'error', count: 0 });
            continue;
          }

          const data = await resp.json();
          if (!Array.isArray(data)) {
            console.error('Unexpected response (not array) for', url.toString());
            stats.push({ country: group.country, location, category, status: 'error', count: 0 });
            continue;
          }

          let foundForCombo = 0;
          for (const biz of data) {
            if (!biz || !biz.id) continue;
            if (!allBizMap.has(biz.id)) {
              allBizMap.set(biz.id, biz);
              foundForCombo += 1;
            }
          }

          console.log(`  -> added ${foundForCombo} new unique businesses (this combo).`);
          stats.push({ country: group.country, location, category, status: 'ok', count: foundForCombo });
        } catch (err) {
          console.error('Error fetching businesses for', url.toString(), err?.message || err);
          stats.push({ country: group.country, location, category, status: 'error', count: 0 });
        }
      }
    }
  }

  const allBusinesses = Array.from(allBizMap.values());
  console.log('----------------------------------------------------------------');
  console.log('Crawl finished. Total unique businesses:', allBusinesses.length);

  // Ensure output directory exists
  const outDir = path.resolve(process.cwd(), 'crawler-output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `leads-${timestamp}.json`);
  const csvPath = path.join(outDir, `leads-${timestamp}.csv`);

  // Write JSON
  fs.writeFileSync(jsonPath, JSON.stringify({ stats, businesses: allBusinesses }, null, 2), 'utf8');
  console.log('Saved JSON to', jsonPath);

  // Write CSV
  const csvContent = businessesToCsv(allBusinesses);
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('Saved CSV to', csvPath);

  console.log('Batch crawler complete.');
}

runCrawler().catch((err) => {
  console.error('Crawler crashed:', err);
  process.exit(1);
});
