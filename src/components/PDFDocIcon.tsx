import React, { useState } from 'react';

interface PDFDocIconProps {
  size?: number | string;
  className?: string;
  alt?: string;
}

/**
 * Reusable high-resolution PDF document icon component.
 * Uses the bundled multi-resolution `pdf-icon.ico` (contains 16, 24, 32, 48, 64, 128, 256px layers)
 * with an inline SVG fallback ensuring crisp pixel-perfect rendering across all environments.
 */
export const PDFDocIcon: React.FC<PDFDocIconProps> = ({
  size = 16,
  className = '',
  alt = 'PDF Document'
}) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const pixelSize = typeof size === 'number' ? `${size}px` : size;
  const numSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 16;

  if (loadFailed) {
    return (
      <svg
        width={numSize}
        height={numSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 select-none ${className}`}
        style={{ width: pixelSize, height: pixelSize }}
        aria-label={alt}
      >
        <path
          d="M6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4C4 2.89543 4.89543 2 6 2Z"
          fill="#DC2626"
        />
        <path
          d="M14 2V8H20"
          fill="#EF4444"
        />
        <path
          d="M14 2L20 8H14V2Z"
          fill="#B91C1C"
        />
        <rect x="5" y="11" width="14" height="6.5" rx="1.2" fill="#FFFFFF" />
        <text
          x="12"
          y="15.8"
          textAnchor="middle"
          fontSize="5"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#DC2626"
        >
          PDF
        </text>
      </svg>
    );
  }

  return (
    <img
      src="/pdf-icon.ico"
      alt={alt}
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      style={{
        width: pixelSize,
        height: pixelSize,
        objectFit: 'contain',
        imageRendering: 'auto'
      }}
      className={`shrink-0 select-none ${className}`}
      loading="eager"
      draggable={false}
      onError={() => {
        setLoadFailed(true);
      }}
    />
  );
};

