import React from 'react';
import radiLogoImg from '../assets/images/radi.png';

interface RadiLogoProps {
  className?: string;
  height?: number | string;
  isDark?: boolean;
}

export const RadiLogo: React.FC<RadiLogoProps> = ({ className = '', height = 36 }) => {
  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      title="RADI Energy Systems Ltd — Powering the Future"
    >
      <img
        src={radiLogoImg}
        alt="RADI Energy Systems Ltd"
        style={{ height, width: 'auto', maxHeight: '100%', objectFit: 'contain' }}
        loading="eager"
      />
    </div>
  );
};
