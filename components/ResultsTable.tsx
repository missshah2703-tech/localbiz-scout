import React from 'react';
import { Business } from '../types';

interface ResultsTableProps {
  businesses: Business[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ businesses }) => {
  if (businesses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No businesses found in this category.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg shadow-sm">
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="bg-gray-100 text-gray-700 uppercase font-semibold text-xs">
          <tr>
            <th className="px-4 py-3">Sr No</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Sub Category</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Street</th>
            <th className="px-4 py-3">Country</th>
            <th className="px-4 py-3">City</th>
            <th className="px-4 py-3">Area</th>
            <th className="px-4 py-3">Pincode</th>
            <th className="px-4 py-3">Contact Person</th>
            <th className="px-4 py-3">Contact No</th>
            <th className="px-4 py-3">Website</th>
            <th className="px-4 py-3">Registration No</th>
            <th className="px-4 py-3">Company Landline</th>
            <th className="px-4 py-3">Year Of Establishment</th>
            <th className="px-4 py-3">Latitude</th>
            <th className="px-4 py-3">Longitude</th>
            <th className="px-4 py-3">Image</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {businesses.map((biz, index) => (
            <tr key={biz.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-xs text-gray-500">{index + 1}</td>
              <td
                className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate"
                title={biz.name}
              >
                {biz.name}
              </td>
              <td className="px-4 py-3 text-xs break-all">{biz.email || ""}</td>
              <td className="px-4 py-3">{biz.category}</td>
              <td className="px-4 py-3">{biz.subCategory || ""}</td>
              <td className="px-4 py-3 max-w-xs truncate" title={biz.description || undefined}>
                {biz.description || ""}
              </td>
              <td className="px-4 py-3 max-w-xs truncate" title={biz.address}>{biz.address}</td>
              <td className="px-4 py-3">{biz.street || ""}</td>
              <td className="px-4 py-3">{biz.country || ""}</td>
              <td className="px-4 py-3">{biz.city || ""}</td>
              <td className="px-4 py-3">{biz.area || ""}</td>
              <td className="px-4 py-3">{biz.pincode || ""}</td>
              <td className="px-4 py-3">{biz.contactPersonName || ""}</td>
              <td className="px-4 py-3 font-mono text-xs">{biz.phone}</td>
              <td className="px-4 py-3">
                {biz.website ? (
                  <a
                    href={biz.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                  >
                    View Website
                  </a>
                ) : (
                  ""
                )}
              </td>
              <td className="px-4 py-3 text-xs">{biz.registrationNo || ""}</td>
              <td className="px-4 py-3 text-xs">{biz.companyLandline || ""}</td>
              <td className="px-4 py-3 text-xs">{biz.yearOfEstablishment || ""}</td>
              <td className="px-4 py-3 text-xs">{biz.latitude != null ? biz.latitude : ""}</td>
              <td className="px-4 py-3 text-xs">{biz.longitude != null ? biz.longitude : ""}</td>
              <td className="px-4 py-3">
                {biz.image ? (
                  <a
                    href={biz.image}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                  >
                    View
                  </a>
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};