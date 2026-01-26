// Logo SVG Component - Reusable across the app
export interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  animated?: boolean;
}

export default function KicksPremiumLogo({ 
  width = 200, 
  height = 120,
  className = '',
  animated = false
}: LogoProps) {
  return (
    <svg
      viewBox="0 0 400 240"
      width={width}
      height={height}
      className={`${animated ? 'animate-pulse' : ''} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shoe outline - White */}
      <g stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Main shoe body */}
        <path d="M 60 140 Q 80 110 120 95 L 260 75 Q 300 85 320 130 L 310 170 Q 280 190 210 195 L 80 200 Q 65 190 60 170 Z" />
        
        {/* Wings - Left */}
        <path d="M 120 75 Q 100 55 90 35" />
        <path d="M 135 70 Q 125 45 120 20" />
        <path d="M 150 68 Q 145 40 142 15" />
        
        {/* Shoe details */}
        <circle cx="280" cy="95" r="8" />
        <line x1="100" y1="120" x2="240" y2="110" />
        <line x1="90" y1="150" x2="260" y2="145" />
      </g>
      
      {/* Red accent stripe */}
      <line 
        x1="80" 
        y1="100" 
        x2="340" 
        y2="65" 
        stroke="#FF3131"
        strokeWidth="14"
        strokeLinecap="round"
      />
      
      {/* Text: KICKS PREMIUM */}
      <text
        x="200"
        y="230"
        textAnchor="middle"
        className="font-display font-bold"
        fontSize="48"
        fill="white"
        letterSpacing="2"
      >
        KICKS
      </text>
      <text
        x="200"
        y="230"
        textAnchor="middle"
        className="font-display font-bold"
        fontSize="48"
        fill="#FF3131"
        letterSpacing="2"
      >
        PREMIUM
      </text>
      
      {/* Underline */}
      <line x1="60" y1="245" x2="340" y2="245" stroke="white" strokeWidth="2" />
    </svg>
  );
}
