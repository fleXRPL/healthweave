interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center`}>
      {/* Simplified version of the HealthWeave logo - interwoven strands */}
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Five interwoven strands */}
        <path
          d="M 10,20 Q 30,15 50,50 T 90,50"
          fill="none"
          stroke="#29628B"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 10,35 Q 30,30 50,50 T 90,55"
          fill="none"
          stroke="#4693C3"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 10,50 Q 30,45 50,50 T 90,45"
          fill="none"
          stroke="#29628B"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 10,65 Q 30,60 50,50 T 90,40"
          fill="none"
          stroke="#4693C3"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 10,80 Q 30,75 50,50 T 90,35"
          fill="none"
          stroke="#29628B"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Center convergence point */}
        <circle cx="50" cy="50" r="8" fill="#29628B" />
      </svg>
    </div>
  );
}
