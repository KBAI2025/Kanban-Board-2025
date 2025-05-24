import React from 'react';
import './DnaSpinner.css';

const DnaSpinner = ({ className = '' }) => {
  return (
    <div className={`dna-spinner ${className}`.trim()}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="strand">
          <div 
            className="top left" 
            style={{ 
              animationDelay: `${i * -0.15}s`,
              left: '30%'
            }}
          />
          <div 
            className="top right" 
            style={{ 
              animationDelay: `${i * -0.15}s`,
              left: '70%',
              animationDirection: 'reverse'
            }}
          />
          <div 
            className="bottom left" 
            style={{ 
              animationDelay: `${i * -0.15}s`,
              left: '30%'
            }}
          />
          <div 
            className="bottom right" 
            style={{ 
              animationDelay: `${i * -0.15}s`,
              left: '70%',
              animationDirection: 'reverse'
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default DnaSpinner;
