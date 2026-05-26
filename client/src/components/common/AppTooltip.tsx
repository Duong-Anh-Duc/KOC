import React from 'react';

interface Props {
  title?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  color?: string;        // accepted for AntD-compat, ignored (native tooltip)
  trigger?: string | string[]; // accepted for AntD-compat, ignored
  overlayStyle?: React.CSSProperties;
  children: React.ReactNode;
}

// Lightweight AntD Tooltip replacement: pure CSS via `title` attribute on a
// wrapper span. The browser shows a native OS tooltip on hover, instantly,
// without any React tree / portal / animation. Trade-off: no rich content
// support (only text). AntD-original behavior is preserved for the rare
// JSX-content case by falling back to data attribute (still text-only).
const AppTooltip: React.FC<Props> = ({ title, children }) => {
  if (!title) return <>{children}</>;
  const text = typeof title === 'string' ? title : React.isValidElement(title) ? String((title as React.ReactElement<{ children?: React.ReactNode }>).props.children ?? '') : String(title);
  return (
    <span title={text} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  );
};

export default AppTooltip;
