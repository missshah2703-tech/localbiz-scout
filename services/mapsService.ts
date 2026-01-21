import { Business } from "../types";

// Backend base URL for API calls (Google Maps-backed backend only)
// Default matches backend/.env PORT=4300 for local dev
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4300";

export const fetchLocationSuggestions = async (query: string): Promise<string[]> => {
  try {
    const url = new URL("/api/locations/autocomplete", API_BASE_URL);
    url.searchParams.set("input", query);

    const resp = await fetch(url.toString());

    if (!resp.ok) {
      console.error("Location autocomplete backend error status:", resp.status);
      return [];
    }

    const data = (await resp.json()) as { suggestions?: string[] };
    if (!data || !Array.isArray(data.suggestions)) {
      return [];
    }

    return data.suggestions;
  } catch (error) {
    console.error("Location autocomplete error:", error);
    return [];
  }
};

export const fetchCategorySuggestions = async (query: string): Promise<string[]> => {
  try {
    const url = new URL("/api/categories/autocomplete", API_BASE_URL);
    url.searchParams.set("input", query);

    const resp = await fetch(url.toString());

    if (!resp.ok) {
      console.error("Category autocomplete backend error status:", resp.status);
      return [];
    }

    const data = (await resp.json()) as { suggestions?: string[] };
    if (!data || !Array.isArray(data.suggestions)) {
      return [];
    }

    return data.suggestions;
  } catch (error) {
    console.error("Category autocomplete error:", error);
    return [];
  }
};

export const searchBusinesses = async (
  location: string,
  category: string,
  limit: number,
  onLog: (msg: string) => void
): Promise<Business[]> => {
  onLog(`Calling backend API for location: ${location}...`);

  try {
    // Use the deep search endpoint to get maximum, de-duplicated results
    const url = new URL("/api/businesses/deep", API_BASE_URL);
    url.searchParams.set("location", location);
    url.searchParams.set("category", category);
    url.searchParams.set("limit", String(limit));

    const resp = await fetch(url.toString());

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Backend error response:", errText);
      throw new Error(`Backend error: ${resp.status}`);
    }

    const data = (await resp.json()) as Business[];

    onLog(`Successfully received ${data.length} businesses from backend.`);

    return data.map((item, index) => ({
      id: item.id || `biz-${Date.now()}-${index}`,
      name: item.name || "Unknown Business",
      category: item.category || category,
      subCategory: item.subCategory ?? null,
      description: item.description ?? null,
      address: item.address || "No address listed",
      street: item.street ?? null,
      country: item.country ?? null,
      city: item.city ?? null,
      area: item.area ?? null,
      pincode: item.pincode ?? null,
      phone: item.phone || "N/A",
      email: item.email ?? null,
      contactPersonName: item.contactPersonName ?? null,
      registrationNo: item.registrationNo ?? null,
      companyLandline: (item.companyLandline ?? item.phone) ?? null,
      yearOfEstablishment: item.yearOfEstablishment ?? null,
      latitude:
        typeof item.latitude === "number" ? item.latitude : null,
      longitude:
        typeof item.longitude === "number" ? item.longitude : null,
      image: item.image ?? null,
      images: Array.isArray((item as any).images) ? (item as any).images : null,
      website:
        typeof item.website === "string" && item.website.trim() !== ""
          ? item.website.trim()
          : null,
      socials: Array.isArray(item.socials) ? item.socials : [],
      seoScore:
        typeof (item as any).seoScore === "number" ? (item as any).seoScore : null,
      seoGrade:
        (item as any).seoGrade === "good" ||
        (item as any).seoGrade === "average" ||
        (item as any).seoGrade === "poor"
          ? (item as any).seoGrade
          : null,
      verificationNotes:
        item.verificationNotes ||
        (item as any).verification_notes ||
        "Fetched from backend",
    }));
  } catch (error) {
    console.error("Search backend error:", error);
    onLog("Critical error during search process.");
    throw error;
  }
};
