import React from 'react';

interface PDFDocIconProps {
  size?: number | string;
  className?: string;
  alt?: string;
}

/**
 * Reusable high-resolution PDF document icon component.
 * Uses the bundled multi-resolution `pdf-icon.ico` (contains 16, 24, 32, 48, 64, 128, 256px layers)
 * ensuring crisp pixel-perfect rendering across standard and high-DPI displays.
 */
export const PDFDocIcon: React.FC<PDFDocIconProps> = ({
  size = 16,
  className = '',
  alt = 'PDF Document'
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

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
      onError={(e) => {
        // Fallback styling if .ico fails to load
        (e.target as HTMLElement).style.display = 'none';
      }}
    />
  );
};
