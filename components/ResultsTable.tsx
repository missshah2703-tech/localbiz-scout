import React from 'react';
import { Business } from '../types';

interface ResultsTableProps {
  businesses: Business[];
  type: 'with-website' | 'no-website';
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ businesses, type }) => {
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
            <th className="px-6 py-3">Business Name</th>
            <th className="px-6 py-3">Category</th>
            <th className="px-6 py-3">Contact</th>
            <th className="px-6 py-3">Location</th>
            {type === 'with-website' ? (
              <>
                <th className="px-6 py-3">Website</th>
                <th className="px-6 py-3">Socials Found</th>
                <th className="px-6 py-3 text-xs text-gray-500">Source</th>
              </>
            ) : (
              <>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Verification Note</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {businesses.map((biz) => (
            <tr key={biz.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 font-medium text-gray-900">{biz.name}</td>
              <td className="px-6 py-4">{biz.category}</td>
              <td className="px-6 py-4 font-mono text-xs">{biz.phone}</td>
              <td className="px-6 py-4 truncate max-w-xs" title={biz.address}>{biz.address}</td>
              
              {type === 'with-website' ? (
                <>
                  <td className="px-6 py-4">
                    {biz.website ? (
                      <a 
                        href={biz.website} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        Visit Site
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Unreachable</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {biz.socials.length > 0 ? (
                        biz.socials.map((social, idx) => (
                          <a 
                            key={idx} 
                            href={social} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs hover:bg-indigo-100 border border-indigo-200"
                          >
                            {new URL(social).hostname.replace('www.', '').split('.')[0]}
                          </a>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">None detected</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {biz.verificationNotes || "Verified"}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      No Website
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 italic">
                    {biz.verificationNotes || "Checked Maps & Search"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};