import { Business } from "../types";

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
    // exported CSV has a clickable location cell. Prefer
    // latitude/longitude when available, otherwise fall back
    // to the formatted address.
    let locationCell = "";
    if (biz.latitude != null && biz.longitude != null) {
      const query = `${biz.latitude},${biz.longitude}`;
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    } else if (biz.address) {
      locationCell = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`;
    }

    const imageList = [biz.image, ...(biz.images || [])]
      .filter((v): v is string => !!v);

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
      escape(imageList.length > 0 ? imageList.join(" | ") : null)
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