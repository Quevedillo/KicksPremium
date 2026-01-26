export interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  message = 'Cargando...', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  return (
    <div 
      className={`flex items-center justify-center ${
        fullScreen 
          ? 'fixed inset-0 bg-brand-black/95 backdrop-blur-sm z-50' 
          : 'py-12'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo Container */}
        <div className="relative w-24 h-24 md:w-32 md:h-32">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 border-4 border-transparent border-t-brand-red border-r-brand-red rounded-full animate-spin" />
          
          {/* Inner pulsing ring */}
          <div className="absolute inset-2 border-2 border-brand-red/30 rounded-full animate-pulse" />
          
          {/* Logo SVG content */}
          <svg
            viewBox="0 0 400 300"
            className="absolute inset-0 w-full h-full text-brand-red animate-bounce-slow"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Shoe outline */}
            <g stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
              {/* Main shoe body */}
              <path d="M 80 180 Q 100 140 140 120 L 240 100 Q 280 110 300 160 L 290 200 Q 260 220 200 225 L 100 230 Q 85 220 80 200 Z" />
              
              {/* Wings */}
              <path d="M 140 100 Q 120 80 110 60 Q 100 70 100 90" />
              <path d="M 160 100 Q 150 70 140 40 Q 130 60 130 90" />
              <path d="M 180 95 Q 175 65 170 35 Q 165 60 165 90" />
              
              {/* Accent lines */}
              <line x1="120" y1="150" x2="240" y2="140" />
              <line x1="110" y1="180" x2="250" y2="175" />
            </g>
            
            {/* Red accent stripe */}
            <line 
              x1="100" 
              y1="130" 
              x2="320" 
              y2="100" 
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              className="text-brand-red"
            />
          </svg>
        </div>

        {/* Loading message */}
        {message && (
          <div className="text-center">
            <p className="text-white text-lg font-semibold">{message}</p>
            <div className="flex gap-2 justify-center mt-3">
              <span className="w-2 h-2 bg-brand-red rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-brand-red rounded-full animate-pulse animation-delay-200" />
              <span className="w-2 h-2 bg-brand-red rounded-full animate-pulse animation-delay-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
