import React from 'react';

interface Props {
  size?: number | 'small' | 'large';
  src?: string | null;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Lightweight AntD Avatar replacement: pure <img>/<div> + CSS.
// Same API surface as the AntD Avatar props we actually use in this app:
// `size` (number | 'small' | 'large'), `src`, `icon`, `style`.
const AppAvatar: React.FC<Props> = ({ size = 32, src, icon, style, className }) => {
  const px = typeof size === 'number' ? size : size === 'large' ? 40 : 24;
  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    fontSize: px * 0.5,
    background: '#ccc',
    color: '#fff',
    verticalAlign: 'middle',
    ...style,
  };
  if (src) {
    return (
      <span style={baseStyle} className={className}>
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </span>
    );
  }
  return <span style={baseStyle} className={className}>{icon}</span>;
};

export default AppAvatar;
