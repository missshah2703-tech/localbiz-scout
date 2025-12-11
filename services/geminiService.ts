import { Business } from "../types";

// Backend base URL for API calls
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:4000";

export const searchBusinesses = async (
  location: string,
  category: string,
  limit: number,
  onLog: (msg: string) => void
): Promise<Business[]> => {
  
  onLog(`Calling backend API for location: ${location}...`);

  try {
    const url = new URL("/api/businesses", API_BASE_URL);
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
      address: item.address || "No address listed",
      phone: item.phone || "N/A",
      // Trust backend: if it sends a non-empty string, treat as website
      website: typeof item.website === "string" && item.website.trim() !== ""
        ? item.website.trim()
        : null,
      socials: Array.isArray(item.socials) ? item.socials : [],
      verificationNotes: item.verificationNotes || (item as any).verification_notes || "Fetched from backend"
    }));

  } catch (error) {
    console.error("Search backend error:", error);
    onLog("Critical error during search process.");
    throw error;
  }
};