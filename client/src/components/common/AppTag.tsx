import React from 'react';

interface Props {
  color?: string;
  style?: React.CSSProperties;
  className?: string;
  icon?: React.ReactNode;
  closable?: boolean;
  onClose?: (e: React.MouseEvent<HTMLElement>) => void;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

// Lightweight AntD Tag replacement. Maps `color` to a CSS class on a <span>.
// Preserves AntD's color presets (success/error/warning/processing/default
// + named hues). Custom hex colors fall back to inline background.
const AppTag: React.FC<Props> = ({ color, style, className, icon, closable, onClose, children, onClick }) => {
  const isHex = !!color && color.startsWith('#');
  const presetClass = !isHex && color ? `app-tag-${color}` : '';
  return (
    <span
      onClick={onClick}
      className={`app-tag ${presetClass} ${className || ''}`.trim()}
      style={isHex ? { background: color, ...style } : style}
    >
      {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
      {children}
      {closable && (
        <span
          role="button"
          aria-label="close"
          onClick={(e) => { e.stopPropagation(); onClose?.(e); }}
          style={{ marginLeft: 6, cursor: 'pointer', opacity: 0.6 }}
        >×</span>
      )}
    </span>
  );
};

export default AppTag;
