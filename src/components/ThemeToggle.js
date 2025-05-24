import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';

const ThemeToggle = () => {
  const { darkMode, toggleTheme } = useTheme();
  const toggleRef = useRef(null);

  // Add a subtle animation when theme changes
  useEffect(() => {
    if (toggleRef.current) {
      toggleRef.current.style.transform = 'scale(1.1)';
      const timeout = setTimeout(() => {
        if (toggleRef.current) {
          toggleRef.current.style.transform = 'scale(1)';
        }
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [darkMode]);

  return (
    <button
      ref={toggleRef}
      onClick={toggleTheme}
      className="theme-toggle p-2 rounded-full focus:outline-none transition-all duration-300 ease-in-out"
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        backgroundColor: 'var(--header-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      {darkMode ? (
        <FontAwesomeIcon 
          icon={faSun} 
          className="text-yellow-300 text-xl" 
          style={{ transition: 'all 0.3s ease' }}
        />
      ) : (
        <FontAwesomeIcon 
          icon={faMoon} 
          className="text-gray-700 text-xl" 
          style={{ transition: 'all 0.3s ease' }}
        />
      )}
      <style>{`
        .theme-toggle:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px var(--shadow-color);
        }
        .theme-toggle:active {
          transform: scale(0.95);
        }
        .theme-toggle:focus {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
      `}</style>
    </button>
  );
};

export default ThemeToggle;
