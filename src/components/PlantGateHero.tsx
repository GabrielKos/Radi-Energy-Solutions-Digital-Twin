import React from 'react';

interface PlantGateHeroProps {
  isDark?: boolean;
  compact?: boolean;
}

export const PlantGateHero: React.FC<PlantGateHeroProps> = ({ isDark = true, compact = false }) => {
  return (
    <div className={`relative overflow-hidden rounded-xl border select-none transition-all ${
      isDark ? 'bg-[#0B0D13] border-[#2A2F3D] text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-white shadow-md'
    }`}>
      {/* SVG Canvas depicting the Radi Energy Solutions Plant Entrance Gate */}
      <svg
        viewBox="0 0 1200 480"
        className="w-full h-auto max-h-[140px] md:max-h-[160px] object-cover"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dusk Sky Gradient */}
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="35%" stopColor="#334155" />
            <stop offset="70%" stopColor="#475569" />
            <stop offset="90%" stopColor="#F59E0B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* Wet Asphalt Reflection Gradient */}
          <linearGradient id="asphaltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="40%" stopColor="#1E293B" />
            <stop offset="70%" stopColor="#0B0F19" />
            <stop offset="100%" stopColor="#05070B" />
          </linearGradient>

          {/* Wing Canopy Gradient */}
          <linearGradient id="canopyGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          {/* Gatehouse Texture */}
          <linearGradient id="stoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          {/* Light Glow Filter */}
          <filter id="lightGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Sky Background */}
        <rect width="1200" height="320" fill="url(#skyGrad)" />

        {/* Distant Clouds & Sun Glow */}
        <circle cx="280" cy="200" r="140" fill="#FBBF24" opacity="0.15" filter="url(#lightGlow)" />
        <ellipse cx="600" cy="180" rx="350" ry="80" fill="#94A3B8" opacity="0.2" />

        {/* Distant Tree Line & Foliage */}
        <path
          d="M 0 290 Q 60 260 140 285 Q 220 250 320 280 Q 450 240 540 275 Q 600 210 660 270 Q 800 245 920 280 Q 1050 250 1200 285 L 1200 320 L 0 320 Z"
          fill="#14532D"
          opacity="0.6"
        />
        <path
          d="M 0 295 Q 120 275 250 295 Q 400 265 580 290 Q 750 265 950 290 Q 1100 275 1200 295 L 1200 320 L 0 320 Z"
          fill="#064E3B"
          opacity="0.8"
        />

        {/* Central Lone Silhouette Tree behind Gate */}
        <path
          d="M 590 280 Q 585 220 575 180 Q 560 140 550 110 Q 580 130 600 90 Q 620 140 640 180 Q 630 230 610 280 Z"
          fill="#064E3B"
          opacity="0.85"
        />

        {/* Perimeter Vertical Slatted Fence & Boundary Walls */}
        <g stroke="#334155" strokeWidth="3">
          {Array.from({ length: 32 }).map((_, i) => (
            <line key={`fence-l-${i}`} x1={40 + i * 11} y1={230} x2={40 + i * 11} y2={310} />
          ))}
          {Array.from({ length: 30 }).map((_, i) => (
            <line key={`fence-r-${i}`} x1={800 + i * 12} y1={230} x2={800 + i * 12} y2={310} />
          ))}
        </g>

        {/* Architectural Gate Posts & Stone Pillars */}
        {/* Left Outer Pillar */}
        <rect x="110" y="200" width="85" height="115" rx="3" fill="url(#stoneGrad)" stroke="#1E293B" strokeWidth="2" />
        <rect x="145" y="225" width="15" height="50" fill="#FEF08A" filter="url(#lightGlow)" />

        {/* Right Outer Pillar */}
        <rect x="800" y="205" width="80" height="110" rx="3" fill="url(#stoneGrad)" stroke="#1E293B" strokeWidth="2" />
        <rect x="830" y="225" width="15" height="50" fill="#FEF08A" filter="url(#lightGlow)" />

        {/* Sliding Security Slat Gates */}
        <rect x="200" y="225" width="220" height="90" fill="#0F172A" stroke="#475569" strokeWidth="2" />
        <g stroke="#64748B" strokeWidth="2">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`gate-l-${i}`} x1={208 + i * 12} y1={226} x2={208 + i * 12} y2={313} />
          ))}
        </g>
        <rect x="630" y="225" width="165" height="90" fill="#0F172A" stroke="#475569" strokeWidth="2" />
        <g stroke="#64748B" strokeWidth="2">
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={`gate-r-${i}`} x1={638 + i * 12} y1={226} x2={638 + i * 12} y2={313} />
          ))}
        </g>

        {/* Central Modern Security Gatehouse */}
        <rect x="425" y="170" width="200" height="145" rx="4" fill="url(#stoneGrad)" stroke="#0F172A" strokeWidth="3" />
        <rect x="425" y="170" width="200" height="30" fill="#1E293B" />
        {/* Gatehouse Glass Pedestrian Doors */}
        <rect x="555" y="225" width="60" height="90" fill="#0284C7" opacity="0.3" stroke="#0F172A" strokeWidth="2" />
        {/* Gatehouse Radi "R" Logo Badge */}
        <rect x="480" y="225" width="55" height="55" rx="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />
        <path d="M 495 265 L 495 235 L 512 235 Q 525 235 525 245 Q 525 255 512 255 L 495 255 M 508 255 L 522 265" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />

        {/* Iconic Twin Soaring White Wing Arch Canopies */}
        {/* Left Wing Canopy */}
        <path
          d="M 130 90 Q 260 115 370 200 Q 425 240 440 250 L 440 230 Q 405 180 300 115 Q 210 75 130 90 Z"
          fill="url(#canopyGrad)"
          stroke="#0F172A"
          strokeWidth="2"
        />
        <rect x="195" y="120" width="16" height="190" fill="#1E293B" />
        {/* Integrated Under-Canopy Strip Lighting */}
        <path d="M 215 138 Q 300 160 410 230" stroke="#FEF08A" strokeWidth="4" filter="url(#lightGlow)" />

        {/* Right Wing Canopy */}
        <path
          d="M 890 90 Q 760 115 650 200 Q 595 240 580 250 L 580 230 Q 615 180 720 115 Q 810 75 890 90 Z"
          fill="url(#canopyGrad)"
          stroke="#0F172A"
          strokeWidth="2"
        />
        <rect x="810" y="120" width="16" height="190" fill="#1E293B" />
        {/* Integrated Under-Canopy Strip Lighting */}
        <path d="M 800 138 Q 715 160 605 230" stroke="#FEF08A" strokeWidth="4" filter="url(#lightGlow)" />

        {/* RADI ENERGY SOLUTIONS LTD Monument Signboard (Right Side) */}
        <rect x="910" y="220" width="260" height="95" rx="6" fill="#F8FAFC" stroke="#0F172A" strokeWidth="3" />
        <rect x="918" y="228" width="244" height="79" rx="3" fill="#FFFFFF" />
        {/* RADI Bold Monogram */}
        <text x="1040" y="264" textAnchor="middle" fill="#0284C7" fontSize="28" fontFamily="Arial, sans-serif" fontWeight="900" letterSpacing="4">
          RADI
        </text>
        {/* Subtitle & Slogan */}
        <text x="1040" y="282" textAnchor="middle" fill="#10B981" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="bold" letterSpacing="1.5">
          — ENERGY SOLUTIONS LTD —
        </text>
        <text x="1040" y="296" textAnchor="middle" fill="#475569" fontSize="8" fontFamily="Arial, sans-serif" fontWeight="bold" letterSpacing="1">
          POWERING THE FUTURE
        </text>

        {/* Wet Reflective Asphalt Ground */}
        <rect y="315" width="1200" height="165" fill="url(#asphaltGrad)" />

        {/* Ground Reflections of Canopies, Gatehouse and Lights */}
        <ellipse cx="260" cy="350" rx="90" ry="15" fill="#FEF08A" opacity="0.25" filter="url(#lightGlow)" />
        <ellipse cx="750" cy="350" rx="90" ry="15" fill="#FEF08A" opacity="0.25" filter="url(#lightGlow)" />
        <ellipse cx="510" cy="360" rx="60" ry="10" fill="#38BDF8" opacity="0.2" filter="url(#lightGlow)" />
        <ellipse cx="1040" cy="355" rx="100" ry="12" fill="#38BDF8" opacity="0.15" filter="url(#lightGlow)" />

        {/* Passing Black Executive Vehicle */}
        <g transform="translate(250, 275) scale(0.85)">
          {/* Car Body Silhouette */}
          <path
            d="M 10 70 L 40 45 Q 65 35 110 35 L 170 35 Q 210 40 230 55 L 250 70 L 255 85 L 0 85 Z"
            fill="#1E293B"
            stroke="#0F172A"
            strokeWidth="1.5"
          />
          {/* Windows */}
          <path d="M 50 46 L 105 40 L 105 65 L 25 65 Z" fill="#0284C7" opacity="0.4" />
          <path d="M 115 40 L 165 40 Q 195 44 205 65 L 115 65 Z" fill="#0284C7" opacity="0.4" />
          {/* Wheels */}
          <circle cx="50" cy="85" r="14" fill="#0F172A" stroke="#64748B" strokeWidth="3" />
          <circle cx="50" cy="85" r="7" fill="#94A3B8" />
          <circle cx="205" cy="85" r="14" fill="#0F172A" stroke="#64748B" strokeWidth="3" />
          <circle cx="205" cy="85" r="7" fill="#94A3B8" />
          {/* Headlights & Tail Lights */}
          <ellipse cx="252" cy="72" rx="4" ry="3" fill="#FEF08A" filter="url(#lightGlow)" />
          <ellipse cx="4" cy="72" rx="3" ry="3" fill="#EF4444" filter="url(#lightGlow)" />
        </g>
      </svg>

      {/* Floating Badges for Facility Identity */}
      <div className="absolute top-2 left-3 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-emerald-400 font-bold border border-emerald-500/40">
          📍 KATUUGO, NAKASONGOLA PLANT ENTRANCE
        </span>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-blue-900/60 backdrop-blur-md text-[10px] font-mono text-blue-300 border border-blue-500/30">
          10 GWh FACILITY GATE
        </span>
      </div>
    </div>
  );
};
