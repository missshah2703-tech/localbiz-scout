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
  const activeRequestIdRef = useRef(0);
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

      const trimmed = value.trim();

      // 1. Combined static + async suggestions:
      //    - If staticSuggestions exist and input is empty, show full static list
      //    - When user types, prefer async fetchSuggestions; if that returns
      //      empty, fall back to filtered static list.
      if (fetchSuggestions) {
        if (!trimmed) {
          if (staticSuggestions.length > 0) {
            setSuggestions(staticSuggestions);
          } else {
            setSuggestions([]);
          }
          setLoading(false);
          return;
        }

        const requestId = ++activeRequestIdRef.current;
        setLoading(true);
        try {
          const results = await fetchSuggestions(trimmed);
          let finalResults = results;

          if ((!results || results.length === 0) && staticSuggestions.length > 0) {
            const lowerVal = trimmed.toLowerCase();
            finalResults = staticSuggestions.filter(item =>
              item.toLowerCase().includes(lowerVal)
            );
          }

          if (activeRequestIdRef.current === requestId && showSuggestions) {
            setSuggestions(finalResults || []);
          }
        } catch (error) {
          console.error("Error fetching suggestions", error);
          // On error, still let user pick from filtered static suggestions
          if (staticSuggestions.length > 0) {
            const lowerVal = trimmed.toLowerCase();
            const filtered = staticSuggestions.filter(item =>
              item.toLowerCase().includes(lowerVal)
            );
            setSuggestions(filtered);
          }
        } finally {
          if (activeRequestIdRef.current === requestId) {
            setLoading(false);
          }
        }
      } else if (staticSuggestions.length > 0) {
        const lowerVal = trimmed.toLowerCase();
        const filtered = !trimmed
          ? staticSuggestions
          : staticSuggestions.filter(item =>
              item.toLowerCase().includes(lowerVal)
            );
        setSuggestions(filtered);
        setLoading(false);
      }
    }, 150); // 150ms debounce for snappier suggestions

    return () => clearTimeout(handler);
  }, [value, showSuggestions, staticSuggestions, fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    // Always open the dropdown on focus; the effect
    // will decide what to show (full static list or
    // filtered/remote suggestions).
    setShowSuggestions(true);
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
      
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-[100] w-full bg-white border border-slate-200 rounded-md mt-1 shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
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