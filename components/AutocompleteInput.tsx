import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  staticSuggestions?: string[];
  fetchSuggestions?: (query: string) => Promise<string[]>;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  staticSuggestions = [],
  fetchSuggestions
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = setTimeout(async () => {
      // If menu shouldn't be shown, do nothing
      if (!showSuggestions) return;

      // If value is empty or too short, clear suggestions
      if (!value || value.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      // 1. Static suggestions filtering
      if (staticSuggestions.length > 0) {
        const lowerVal = value.toLowerCase();
        const filtered = staticSuggestions.filter(item =>
          item.toLowerCase().includes(lowerVal)
        );
        setSuggestions(filtered);
      } 
      // 2. Async fetch suggestions
      else if (fetchSuggestions) {
        setLoading(true);
        // Clear previous suggestions while loading new ones to avoid confusion
        setSuggestions([]); 
        try {
          const results = await fetchSuggestions(value);
          // Only update if component is still mounted and showing suggestions
          if (showSuggestions) {
            setSuggestions(results);
          }
        } catch (error) {
          console.error("Error fetching suggestions", error);
        } finally {
          setLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [value, showSuggestions, staticSuggestions, fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (value && value.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2.5 text-sm"
        autoComplete="off"
      />
      
      {showSuggestions && (
        <ul className="absolute z-[100] w-full bg-white border border-slate-200 rounded-md mt-1 shadow-xl max-h-60 overflow-y-auto">
          {loading && (
            <li className="px-4 py-2 text-sm text-slate-400 italic">Finding suggestions...</li>
          )}
          
          {!loading && suggestions.length === 0 && value.length >= 2 && fetchSuggestions && (
            <li className="px-4 py-2 text-sm text-slate-400 italic">No locations found</li>
          )}

          {!loading && suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};