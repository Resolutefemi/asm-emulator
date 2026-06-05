// src/components/SplashScreen.jsx
import React, { useEffect, useState } from 'react';
import '../styles/SplashScreen.css';

export const SplashScreen = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      const transitionTimer = setTimeout(() => {
        onComplete();
      }, 800); // Duration of fade animation
      return () => clearTimeout(transitionTimer);
    }, 3000); // Minimum 3 seconds display

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-screen ${isExiting ? 'splash-exit' : ''}`}>
      <div className="splash-content">
        <div className="splash-icon-container">
          <img 
            src="/ice.jpg"
            alt="Renance"
            className="splash-icon"
          />
          <div className="splash-glow"></div>
        </div>
        
        <div className="splash-text">
          <h1 className="splash-title">Renance</h1>
          <p className="splash-subtitle">Professional 8086 Assembly IDE</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
