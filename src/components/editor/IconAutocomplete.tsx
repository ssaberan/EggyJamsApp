import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';

// Get all available lucide icon names.
// Icons are forwardRef components (objects, not functions) whose keys are PascalCase.
const getAllIconNames = (): string[] => {
  const icons = LucideIcons as unknown as Record<string, unknown>;
  return Object.keys(icons)
    .filter((key) => {
      // Icon names are PascalCase — always start with an uppercase letter.
      // This filters out utility exports like "createLucideIcon", "icons", "default", etc.
      if (!/^[A-Z]/.test(key)) return false;
      const value = icons[key];
      // forwardRef components are objects with a $$typeof symbol
      return value != null && typeof value === 'object';
    })
    .sort();
};

interface IconAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function IconAutocomplete({
  value,
  onChange,
  placeholder = 'e.g. Castle, Shield, Sword...',
  className = '',
}: IconAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get all icon names once
  const allIconNames = useMemo(() => getAllIconNames(), []);

  // Filter icons based on current input
  const filteredIcons = useMemo(() => {
    if (!value.trim()) return [];
    const searchTerm = value.toLowerCase();
    return allIconNames
      .filter((name) => name.toLowerCase().includes(searchTerm))
      .slice(0, 50); // Limit to 50 results for performance
  }, [value, allIconNames]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredIcons]);

  // Compute dropdown position relative to the viewport
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4, // 4px gap
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Reposition on open, scroll, and resize
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();

    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && filteredIcons.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
        return;
      }
    }

    if (isOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredIcons.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredIcons[highlightedIndex]) {
            handleSelect(filteredIcons[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'Tab':
          if (filteredIcons[highlightedIndex]) {
            e.preventDefault();
            handleSelect(filteredIcons[highlightedIndex]);
          }
          break;
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(newValue.trim().length > 0);
  };

  const handleFocus = () => {
    if (value.trim().length > 0) {
      setIsOpen(true);
    }
  };

  // Render icon preview
  const renderIcon = (iconName: string) => {
    const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    const IconComponent = icons[iconName];
    if (!IconComponent) return null;
    return <IconComponent className="h-3.5 w-3.5 text-purple-400" />;
  };

  // Dropdown content (rendered via portal)
  const showDropdown = isOpen && dropdownPos;
  const dropdownContent = showDropdown ? (
    filteredIcons.length > 0 ? (
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
        }}
        className="z-[9999] rounded-md border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 shadow-lg max-h-60 overflow-y-auto"
      >
        <div ref={listRef} className="py-1">
          {filteredIcons.map((iconName, index) => (
            <button
              key={iconName}
              type="button"
              onClick={() => handleSelect(iconName)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                index === highlightedIndex
                  ? 'bg-purple-600/30 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-500/10 shrink-0">
                {renderIcon(iconName)}
              </span>
              <span className="flex-1 truncate">{iconName}</span>
            </button>
          ))}
        </div>
      </div>
    ) : value.trim().length > 0 ? (
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
        }}
        className="z-[9999] rounded-md border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 shadow-lg"
      >
        <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-500 italic">
          No icons found matching &ldquo;{value}&rdquo;
        </div>
      </div>
    ) : null
  ) : null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck="false"
      />
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}
