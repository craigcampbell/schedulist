import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';

/**
 * Typeahead multi-select with removable tag chips.
 * Accepts custom values (anything typed + Enter) in addition to suggestions.
 */
const TagInput = ({
  value = [],          // string[]
  onChange,            // (newValues: string[]) => void
  suggestions = [],    // string[] — full suggestion list
  placeholder = 'Type to search or add…',
  label,
  description,
  maxSuggestions = 8,
}) => {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filtered = suggestions
    .filter(s => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()))
    .slice(0, maxSuggestions);

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
    setHighlighted(-1);
  };

  const removeTag = (tag) => {
    onChange(value.filter(v => v !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlighted >= 0 && filtered[highlighted]) {
        addTag(filtered[highlighted]);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-1">{label}</label>
      )}
      <div ref={dropdownRef} className="relative">
        {/* Tags + input field */}
        <div
          className="min-h-[2.5rem] flex flex-wrap gap-1.5 items-center px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-800 bg-white cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          onClick={() => inputRef.current?.focus()}
        >
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 leading-none"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            placeholder={value.length === 0 ? placeholder : ''}
            onChange={e => {
              setInput(e.target.value);
              setOpen(true);
              setHighlighted(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-0.5"
          />
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        </div>

        {/* Dropdown */}
        {open && (filtered.length > 0 || input.trim()) && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
            {filtered.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(s); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${i === highlighted ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              >
                {s}
              </button>
            ))}
            {input.trim() && !suggestions.includes(input.trim()) && !value.includes(input.trim()) && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(input); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-100 dark:border-gray-700"
              >
                + Add "{input.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
};

export default TagInput;
