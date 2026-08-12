import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, Buildings, ArrowRight } from '@phosphor-icons/react';

export default function CommandPalette({ open, onClose, companies, views, onSelectCompany, onSelectView }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const companyItems = companies
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q))
      .map((c) => ({ type: 'company', id: c.company_id, label: c.name, meta: c.sector }));
    const viewItems = views
      .filter((v) => !q || v.label.toLowerCase().includes(q))
      .map((v) => ({ type: 'view', id: v.id, label: v.label, meta: 'View', icon: v.icon }));
    return [...companyItems, ...viewItems];
  }, [query, companies, views]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const item = items[activeIndex];
        if (item) select(item);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, items, activeIndex]);

  function select(item) {
    if (item.type === 'company') onSelectCompany(item.id);
    else onSelectView(item.id);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div className="cmdk-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <MagnifyingGlass size={16} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Jump to a company or view…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="cmdk-kbd">Esc</span>
        </div>
        <div className="cmdk-list" role="listbox">
          {items.length === 0 && <div className="cmdk-empty">No matches</div>}
          {items.map((item, i) => (
            <div
              key={`${item.type}-${item.id}`}
              className={['cmdk-item', i === activeIndex ? 'selected' : ''].join(' ')}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => select(item)}
              role="option"
              aria-selected={i === activeIndex}
              tabIndex={-1}
            >
              <span className="cmdk-item-icon">
                {item.type === 'company' ? <Buildings size={16} /> : item.icon}
              </span>
              {item.label}
              <span className="cmdk-item-meta">{item.meta}</span>
              {i === activeIndex && <ArrowRight size={13} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
