// src/components/SplashScreen.jsx
import React, { useEffect, useState } from 'react';
import '../styles/SplashScreen.css';

export const SplashScreen = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let transitionTimer;
    const timer = setTimeout(() => {
      setIsExiting(true);
      transitionTimer = setTimeout(() => {
        onComplete();
      }, 1000); // Increased duration for a smoother transition
    }, 6000); // Minimum 6 seconds display

    return () => {
      clearTimeout(timer);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen ${isExiting ? 'splash-exit' : ''}`}>
      <div className="splash-content">
        <div className="splash-icon-container">
          <img 
            src="/icon.png"
            alt="Renance"
            className="splash-icon"
          />
          <div className="splash-glow"></div>
        </div>
        
        <div className="splash-text">
          <h1 className="splash-title">Renance</h1>
          <p className="splash-subtitle">Professional 8086 Assembly IDE</p>
          <p className="splash-subtitle splash-author">by Resolute Femi</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
