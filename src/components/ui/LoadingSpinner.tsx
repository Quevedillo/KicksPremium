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
      <div className="flex flex-col items-center gap-8">
        {/* Animated Logo Container */}
        <div className="relative w-32 h-32 md:w-40 md:h-40">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 border-4 border-transparent border-t-brand-red border-r-brand-red rounded-full animate-spin" />
          
          {/* Logo SVG - Clean and centered */}
          <svg
            viewBox="0 0 200 140"
            className="absolute inset-0 w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Shoe outline - Main body */}
            <path 
              d="M 30 90 Q 50 60 80 45 L 160 35 Q 190 45 200 80 L 195 110 Q 170 125 110 128 L 40 130 Q 28 122 30 105 Z" 
              stroke="white" 
              stroke-width="3" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
            />
            
            {/* Wings */}
            <path 
              d="M 80 35 L 60 15 Q 55 25 60 45" 
              stroke="white" 
              stroke-width="2.5" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
            />
            <path 
              d="M 100 30 L 80 5 Q 75 18 85 40" 
              stroke="white" 
              stroke-width="2.5" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
            />
            
            {/* Red accent stripe - Dynamic */}
            <line 
              x1="35" 
              y1="65" 
              x2="180" 
              y2="40" 
              stroke="#FF3131" 
              stroke-width="4" 
              stroke-linecap="round"
              className="animate-pulse"
            />
          </svg>
        </div>

        {/* Brand Name */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-wider uppercase">
            KICKS<span className="text-brand-red">PREMIUM</span>
          </h2>
        </div>

        {/* Loading message */}
        {message && (
          <div className="text-center">
            <p className="text-white text-base md:text-lg font-semibold">{message}</p>
            <div className="flex gap-2 justify-center mt-4">
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
