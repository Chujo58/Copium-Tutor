import React from 'react';

const CardsInHand = ({ 
  color = 'currentColor', 
  fillColor = 'white', 
  size = 24, 
  strokeWidth = 2, 
  ...props 
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Back Card - Height increased to 15, slightly more vertical to occupy space */}
      <rect x="2.5" y="5" width="10" height="15" rx="2" transform="rotate(-12 7.5 12.5)" />
      
      {/* Middle Card - Increased width and height */}
      <rect x="7" y="4" width="10" height="15" rx="2" fill={fillColor} />
      <rect x="7" y="4" width="10" height="15" rx="2" />
      
      {/* Front Card - Increased width and height */}
      <rect x="11.5" y="5" width="10" height="15" rx="2" transform="rotate(12 16.5 12.5)" fill={fillColor} />
      <rect x="11.5" y="5" width="10" height="15" rx="2" transform="rotate(12 16.5 12.5)" />
    </svg>
  );
};

export default CardsInHand;