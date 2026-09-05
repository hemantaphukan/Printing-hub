import React from 'react';

interface BarcodeProps {
  value: string;
  className?: string;
  height?: number;
  showText?: boolean;
}

/**
 * Renders a crisp vector barcode using deterministic pseudo-Code128 patterns.
 * Ensures crisp rendering for thermal printers and laser/inkjet printouts.
 */
export const BarcodeRenderer: React.FC<BarcodeProps> = ({
  value,
  className = '',
  height = 48,
  showText = true,
}) => {
  // Generate deterministic bar widths based on character codes
  const bars = React.useMemo(() => {
    const clean = (value || '00000000').toUpperCase();
    const pattern: number[] = [2, 1, 1, 2]; // Start sentinel

    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      // Map to 4 alternating bar/space widths
      pattern.push(
        (code % 3) + 1,
        ((code >> 1) % 3) + 1,
        ((code >> 2) % 3) + 1,
        ((code >> 3) % 2) + 1
      );
    }
    pattern.push(2, 3, 1, 2); // Stop sentinel

    return pattern;
  }, [value]);

  const totalUnits = bars.reduce((acc, w) => acc + w, 0);

  let currentX = 0;
  const rects: { x: number; width: number }[] = [];

  bars.forEach((width, index) => {
    // Even indices are dark bars, odd indices are light spaces
    if (index % 2 === 0) {
      rects.push({ x: currentX, width });
    }
    currentX += width;
  });

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalUnits} ${height}`}
        className="w-full max-w-[340px] h-auto overflow-visible"
        style={{ maxHeight: `${height}px` }}
        preserveAspectRatio="none"
        aria-label={`Barcode: ${value}`}
      >
        {rects.map((r, idx) => (
          <rect
            key={idx}
            x={r.x}
            y={0}
            width={r.width}
            height={height}
            fill="#000000"
          />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-[11px] tracking-widest text-slate-800 mt-1 uppercase">
          {value}
        </span>
      )}
    </div>
  );
};
