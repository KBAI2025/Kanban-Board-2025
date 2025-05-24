import React from 'react';
import './DnaSpinner.css';

const DnaSpinner = ({ className = '', size = 'small' }) => {
  const strandCount = size === 'small' ? 8 : 12;
  
  return (
    <div className={`dna-spinner ${size} ${className}`.trim()}>
      {[...Array(strandCount)].map((_, i) => (
        <div key={i} className="strand">
          <div 
            className="top" 
            style={{
              '--delay': `${i * -0.2}s`,
              '--bg-start': 'rgba(255, 255, 255, 0.9)',
              '--bg-middle': 'rgba(160, 216, 255, 0.9)',
              '--bg-end': 'rgba(255, 255, 255, 0.9)'
            }}
          />
          <div 
            className="bottom" 
            style={{
              '--delay': `${-1.5 - (i * 0.2)}s`,
              '--bg-start': 'rgba(160, 216, 255, 0.9)',
              '--bg-middle': 'rgba(255, 255, 255, 0.9)',
              '--bg-end': 'rgba(160, 216, 255, 0.9)'
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default DnaSpinner;