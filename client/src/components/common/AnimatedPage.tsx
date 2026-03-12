import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface AnimatedPageProps {
  children: React.ReactNode;
}

const AnimatedPage: React.FC<AnimatedPageProps> = ({ children }) => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    // Reset animation on route change
    if (prevPath.current !== location.pathname) {
      setVisible(false);
      prevPath.current = location.pathname;
    }
    const timer = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(timer);
  }, [location.pathname]);

  return (
    <div className={`page-transition ${visible ? 'page-visible' : ''}`}>
      {children}
    </div>
  );
};

export default AnimatedPage;
