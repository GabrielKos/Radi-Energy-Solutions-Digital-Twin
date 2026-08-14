import React, { useState } from 'react';

interface RadiLogoProps {
  className?: string;
  height?: number | string;
  isDark?: boolean;
}

export const RadiLogo: React.FC<RadiLogoProps> = ({
  className = '',
  height = 36,
  isDark = true,
}) => {
  const [imgError, setImgError] = useState<boolean>(false);

  // Direct Google Drive image export and thumbnail URLs for File ID: 1ZeEat97cbj7r3W35lhj-9wcqiPLStZBp
  const gdriveDirectUrl = 'https://lh3.googleusercontent.com/d/1ZeEat97cbj7r3W35lhj-9wcqiPLStZBp';
  const gdriveThumbnailUrl = 'https://drive.google.com/thumbnail?id=1ZeEat97cbj7r3W35lhj-9wcqiPLStZBp&sz=w1000';

  // Navy text color adapted for dark / light modes
  const navyColor = isDark ? '#F1F5F9' : '#0B2240';
  const navySubColor = isDark ? '#E2E8F0' : '#0B2240';

  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      title="RADI ENERGY SYSTEMS LTD — POWERING THE FUTURE"
    >
      {/* Primary: Direct Image Embed from User's Google Drive Asset */}
      {!imgError ? (
        <img
          src={gdriveDirectUrl}
          onError={() => {
            // Try thumbnail URL before falling back to SVG vector
            const img = new Image();
            img.src = gdriveThumbnailUrl;
            img.onload = () => {
              // thumbnail works
            };
            img.onerror = () => {
              setImgError(true);
            };
          }}
          alt="RADI Energy Systems Ltd"
          style={{ height, width: 'auto', maxHeight: '100%', objectFit: 'contain' }}
          className={`transition-all duration-200 ${
            isDark ? 'brightness-110 drop-shadow-[0_1px_4px_rgba(255,255,255,0.15)]' : ''
          }`}
          loading="eager"
        />
      ) : (
        /* High-Definition 1:1 Vector Replica of the Official RADI Brandmark */
        <svg
          viewBox="0 0 540 180"
          style={{ height }}
          className="w-auto max-h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            {/* Smooth Radial & Linear Gradient for the Green 'A' Arch */}
            <linearGradient id="radi-green-arch-grad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#75C344" />
              <stop offset="35%" stopColor="#5BB739" />
              <stop offset="75%" stopColor="#2E8632" />
              <stop offset="100%" stopColor="#1B6628" />
            </linearGradient>
            <linearGradient id="radi-navy-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? '#FFFFFF' : '#0D274A'} />
              <stop offset="100%" stopColor={isDark ? '#E2E8F0' : '#091E38'} />
            </linearGradient>
          </defs>

          <g id="RADI_Official_Logo_Group" transform="translate(15, 10)">
            {/* 1. Letter 'R' (Bold Modern Geometric with Top-Left Angular Chamfer) */}
            <path
              d="M 12 28 L 38 2 L 95 2 C 122 2 138 18 138 44 C 138 65 125 78 105 84 L 140 134 L 105 134 L 74 88 L 44 88 L 44 134 L 12 134 Z M 44 32 L 44 62 L 90 62 C 102 62 108 54 108 47 C 108 39 102 32 90 32 Z"
              fill={navyColor}
            />

            {/* 2. Letter 'A' (Smooth Sleek Green Chevron Arch with Rounded Apex) */}
            <path
              d="M 215 2 C 228 2 239 9 245 20 L 298 134 L 260 134 L 222 46 C 220 42 216 42 214 46 L 176 134 L 138 134 L 191 20 C 197 9 208 2 215 2 Z"
              fill="url(#radi-green-arch-grad)"
            />

            {/* 3. Letter 'D' (Bold Geometric with Curved Outer Profile) */}
            <path
              d="M 315 2 L 368 2 C 408 2 438 28 438 68 C 438 108 408 134 368 134 L 315 134 Z M 347 32 L 347 104 L 365 104 C 388 104 405 88 405 68 C 405 48 388 32 365 32 Z"
              fill={navyColor}
            />

            {/* 4. Letter 'I' (Clean Solid Vertical Stem) */}
            <path
              d="M 465 2 L 497 2 L 497 134 L 465 134 Z"
              fill={navyColor}
            />

            {/* 5. Subline: — ENERGY SYSTEMS LTD — */}
            <g id="RADI_Subline" transform="translate(0, 148)">
              {/* Left Green Accent Dash */}
              <rect x="0" y="4.5" width="28" height="4" rx="2" fill="#48B738" />

              {/* Central Text: ENERGY SYSTEMS LTD */}
              <text
                x="255"
                y="10"
                textAnchor="middle"
                fill={navySubColor}
                fontSize="17.5"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                letterSpacing="5.5"
              >
                ENERGY SYSTEMS LTD
              </text>

              {/* Right Green Accent Dash */}
              <rect x="482" y="4.5" width="28" height="4" rx="2" fill="#48B738" />
            </g>

            {/* 6. Tagline: POWERING THE FUTURE */}
            <g id="RADI_Tagline" transform="translate(255, 178)">
              <text
                x="0"
                y="0"
                textAnchor="middle"
                fill="#48B738"
                fontSize="12.5"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="700"
                letterSpacing="7.5"
              >
                POWERING THE FUTURE
              </text>
            </g>
          </g>
        </svg>
      )}
    </div>
  );
};
