
import React, { memo, useMemo } from 'react';

interface ArrangerGridProps {
    pixelsPerTick: number;
    pixelsPerBar: number;
    height: number;
    width: number;
}

const ArrangerGrid: React.FC<ArrangerGridProps> = memo(({ pixelsPerTick, pixelsPerBar, height, width }) => {
    const { backgroundImage, backgroundSize } = useMemo(() => {
      const showTicks = pixelsPerTick > 20;
      let bgImage = `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px)`;
      let bgSize = `${pixelsPerBar}px 100%`;
      if (showTicks) {
          bgImage += `, linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)`;
          bgSize += `, ${pixelsPerTick}px 100%`;
      }
      if (pixelsPerTick > 80) {
          bgImage += `, linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px)`;
          bgSize += `, ${pixelsPerTick / 4}px 100%`;
      }
      return { backgroundImage: bgImage, backgroundSize: bgSize };
    }, [pixelsPerTick, pixelsPerBar]);

    return (
        <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
                backgroundImage, 
                backgroundSize,
                width,
                height
            }} 
        />
    );
});

export default ArrangerGrid;
