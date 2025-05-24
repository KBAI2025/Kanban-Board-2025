import React from 'react';
import './GearLoader.css';

const GearLoader = ({ className = '' }) => {
  return (
    <div className={`gear-loader ${className}`.trim()}>
      <div className="gear">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`tooth tooth${i + 1}`}></div>
        ))}
      </div>
      <div className="gear">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`tooth tooth${i + 1}`}></div>
        ))}
      </div>
    </div>
  );
};

export default GearLoader;
