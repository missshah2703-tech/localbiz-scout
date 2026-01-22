import { Business } from "../types";

// Backend base URL used for image proxy links in CSV
const BACKEND_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4300";

// Export a flat list of businesses with the same columns
// that you see in the UI table
export const exportToCSV = (businesses: Business[]) => {
  // Helper to escape CSV fields
  const escape = (val: string | null | undefined) => {
    if (!val) return "";
    const stringVal = String(val);
    if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return stringVal;
  };

  const headers = [
    "Sr No",
    "Name",
    "Email",
    "Category",
    "Sub Category",
    "Description",
    "Location",
    "Street",
    "Country",
    "City",
    "Area",
    "Pincode",
    "Contact Person Name",
    "Contact No",
    "Website",
    "Registration No",
    "Company Landline",
    "Year Of Establishment",
    "Latitude",
    "Longitude",
    "Image"
  ];
  
  const rows: string[] = [];
  rows.push(headers.join(","));

  let counter = 1;

  const pushRow = (biz: Business) => {
    // Build a Google Maps URL for the location so that the
    // exported CSV has a clickable location cell. Prefer the
    // official place_id URL (more accurate pin), then fall back
    // to latitude/longitude, then formatted address.
    let locationCell = "";
    if (biz.id && biz.name) {
      const query = biz.name;
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(biz.id)}`;
    } else if (biz.latitude != null && biz.longitude != null) {
      const query = `${biz.latitude},${biz.longitude}`;
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    } else if (biz.address) {
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`;
    }

    const imageList = [biz.image, ...(biz.images || [])]
      .filter((v): v is string => !!v);

    // For the Image column we prefer to open just the photo.
    // If we have a Google Place photo_reference in the URL,
    // point to our backend proxy /api/place-photo so the
    // browser gets the image directly (no API key issues).
    let imageCell = "";
    const firstImageUrl = imageList[0];
    if (firstImageUrl) {
      const match = /photo_reference=([^&]+)/.exec(firstImageUrl);
      if (match && match[1]) {
        const photoRef = decodeURIComponent(match[1]);
        imageCell = `${BACKEND_BASE_URL}/api/place-photo?photo_reference=${encodeURIComponent(photoRef)}&maxwidth=800`;
      }
    }

    // Fallback: if no real photo, link to the place page so
    // user can still see images there.
    if (!imageCell && biz.id && biz.name) {
      const query = biz.name;
      imageCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(biz.id)}`;
    }

    rows.push([
      counter.toString(),
      escape(biz.name),
      escape(biz.email ?? null),
      escape(biz.category),
      escape(biz.subCategory ?? null),
      escape(biz.description ?? null),
      escape(locationCell || biz.address),
      escape(biz.street ?? null),
      escape(biz.country ?? null),
      escape(biz.city ?? null),
      escape(biz.area ?? null),
      escape(biz.pincode ?? null),
      escape(biz.contactPersonName ?? null),
      escape(biz.phone),
      escape(biz.website),
      escape(biz.registrationNo ?? null),
      escape(biz.companyLandline ?? null),
      escape(biz.yearOfEstablishment ?? null),
      biz.latitude != null ? String(biz.latitude) : "",
      biz.longitude != null ? String(biz.longitude) : "",
      escape(imageCell || (imageList.length > 0 ? imageList.join(" | ") : null))
    ].join(","));
    counter += 1;
  };

  // Process all businesses in order
  businesses.forEach(pushRow);

  // Prepend UTF-8 BOM so Excel correctly detects encoding and
  // displays non-Latin characters (e.g., Arabic) instead of boxes.
  const csvContent = "\uFEFF" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `localbizhunt_export_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};