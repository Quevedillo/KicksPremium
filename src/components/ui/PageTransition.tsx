// Page transition wrapper - Añade animaciones de entrada a páginas
export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageTransition({ 
  children, 
  className = '' 
}: PageTransitionProps) {
  return (
    <div className={`animate-fade-in-up ${className}`}>
      {children}
    </div>
  );
}
