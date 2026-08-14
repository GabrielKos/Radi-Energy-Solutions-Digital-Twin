import React from 'react';

interface KmcLogoProps {
  className?: string;
  height?: number;
}

export const KmcLogo: React.FC<KmcLogoProps> = ({ className = 'h-9', height = 36 }) => {
  return (
    <div className={`inline-flex items-center select-none ${className}`} title="Kiira Motors Corporation (KMC)">
      {/* Official Kiira Motors Corporation (KMC) Trademark Vector Lockup */}
      <svg
        viewBox="0 0 460 140"
        height={height}
        className="w-auto max-h-full transition-transform hover:scale-[1.02]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id="kmc-red-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EE1C25" />
            <stop offset="50%" stopColor="#D91620" />
            <stop offset="100%" stopColor="#B30E17" />
          </linearGradient>
          <linearGradient id="kmc-chrome-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
        </defs>

        {/* Group with Official Scaled Geometry */}
        <g id="KMC_Official_Brandmark">
          {/* Main Italicized KMC Letterforms in Precision Solid Red */}
          {/* Letter 'K' */}
          <path
            d="M 28 112 L 62 18 L 96 18 L 68 70 L 108 18 L 148 18 L 94 78 L 132 112 L 96 112 L 67 84 L 54 112 Z"
            fill="url(#kmc-red-grad)"
          />

          {/* Letter 'M' */}
          <path
            d="M 124 112 L 158 18 L 194 18 L 216 78 L 254 18 L 290 18 L 256 112 L 222 112 L 206 58 L 182 112 Z"
            fill="url(#kmc-red-grad)"
          />

          {/* Letter 'C' */}
          <path
            d="M 374 28 C 352 16 322 14 292 22 C 252 32 230 68 238 94 C 244 114 268 120 300 118 C 330 116 360 102 372 90 L 348 76 C 338 86 322 94 302 96 C 278 98 266 88 262 74 C 256 56 272 38 300 34 C 318 31 334 35 348 44 Z"
            fill="url(#kmc-red-grad)"
          />

          {/* Dynamic Upper Aerodynamic Blade / Speed Swoosh */}
          <path
            d="M 34 76 C 92 84 174 88 252 58 C 316 34 366 22 410 20 C 374 30 312 50 242 78 C 180 102 102 102 34 76 Z"
            fill="url(#kmc-chrome-grad)"
          />

          {/* Dynamic Lower Aerodynamic Blade / Speed Swoosh */}
          <path
            d="M 44 104 C 76 102 114 92 148 72 C 178 54 202 36 224 22 C 200 42 172 64 138 84 C 106 100 74 104 44 104 Z"
            fill="url(#kmc-chrome-grad)"
          />

          {/* Registered Trademark Circle ® */}
          <circle cx="396" cy="100" r="8" stroke="#D91620" strokeWidth="1.8" fill="none" />
          <text
            x="396"
            y="103.5"
            textAnchor="middle"
            fill="#D91620"
            fontSize="9"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="bold"
          >
            R
          </text>

          {/* Subtitle: KIIRA MOTORS CORPORATION */}
          <text
            x="200"
            y="134"
            textAnchor="middle"
            fill="#64748B"
            fontSize="10.5"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="800"
            letterSpacing="3"
          >
            KIIRA MOTORS CORPORATION
          </text>
        </g>
      </svg>
    </div>
  );
};
