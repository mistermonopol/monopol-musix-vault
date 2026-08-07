import { useEffect, useRef, useState } from 'react';
import { THEMES, type ThemePath } from '../lib/themes';

interface DesignMenuProps {
  readonly activePath: ThemePath;
  readonly onNavigate: (path: ThemePath) => void;
}

export function DesignMenu({ activePath, onNavigate }: DesignMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return <div className="design-menu" ref={root}>
    <button className="design-trigger" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">◫</span> UI Design <span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="design-options" role="menu" aria-label="UI Design">
      <p>Choose an interface</p>
      {THEMES.map((theme) => <button key={theme.path} role="menuitemradio" aria-checked={theme.path === activePath} type="button" onClick={() => { onNavigate(theme.path); setOpen(false); }}>
        <span className={`theme-swatch ${theme.id}`} aria-hidden="true" />
        <span><strong>{theme.label.replace(' inspired', '')}</strong><small>{theme.kicker}</small></span>
        {theme.path === activePath && <span className="menu-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>;
}
