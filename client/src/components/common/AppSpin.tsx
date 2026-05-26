import React from 'react';

interface Props {
  spinning?: boolean;
  size?: 'small' | 'default' | 'large';
  tip?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Lightweight AntD Spin replacement: pure CSS spinner, no animation context.
// API surface matches the props this app uses: `spinning`, `size`, `tip`, `children`.
const AppSpin: React.FC<Props> = ({ spinning = true, size = 'default', tip, children, style, className }) => {
  const dim = size === 'small' ? 16 : size === 'large' ? 32 : 22;

  const spinner = (
    <span
      className={`app-spinner app-spinner-${size}`}
      style={{ width: dim, height: dim, display: 'inline-block' }}
      aria-label="loading"
    />
  );

  if (!children) {
    // Bare spinner (no overlay wrapper)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }} className={className}>
        {spinner}
        {tip && <span style={{ fontSize: 13, color: '#888' }}>{tip}</span>}
      </span>
    );
  }

  // Wrapped: render children with optional overlay
  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      {children}
      {spinning && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            background: 'rgba(255,255,255,0.6)',
            zIndex: 10,
          }}
        >
          {spinner}
          {tip && <span style={{ fontSize: 13, color: '#666' }}>{tip}</span>}
        </div>
      )}
    </div>
  );
};

export default AppSpin;
