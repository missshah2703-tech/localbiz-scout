import { Business } from "../types";

export const exportToCSV = (withWebsite: Business[], noWebsite: Business[]) => {
  // Helper to escape CSV fields
  const escape = (val: string | null | undefined) => {
    if (!val) return "";
    const stringVal = String(val);
    if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return stringVal;
  };

  const headers = ["Business Name", "Category", "Phone", "Address", "Website", "Status", "Social Links", "Verification Notes"];
  
  const rows: string[] = [];
  rows.push(headers.join(","));

  // Process "With Website"
  withWebsite.forEach(biz => {
    rows.push([
      escape(biz.name),
      escape(biz.category),
      escape(biz.phone),
      escape(biz.address),
      escape(biz.website),
      "Has Website",
      escape(biz.socials.join("; ")),
      escape(biz.verificationNotes)
    ].join(","));
  });

  // Process "No Website"
  noWebsite.forEach(biz => {
    rows.push([
      escape(biz.name),
      escape(biz.category),
      escape(biz.phone),
      escape(biz.address),
      "",
      "No Website",
      "",
      escape(biz.verificationNotes)
    ].join(","));
  });

  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `local_biz_scout_export_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};