
import React, { memo, useMemo } from 'react';

interface ArrangerGridProps {
    pixelsPerTick: number;
    pixelsPerBar: number;
    height: number;
    width: number;
    zoom: number;
}

const ArrangerGrid: React.FC<ArrangerGridProps> = memo(({ pixelsPerTick, pixelsPerBar, height, width }) => {
    const { backgroundImage, backgroundSize } = useMemo(() => {
      const showTicks = pixelsPerTick > 20;
      const showSubdivisions = pixelsPerTick > 80;
      
      // Logic Pro X Dark Grey Theme
      // Bar lines: Solid lighter grey
      // Beat lines: Faint grey
      // Subdivisions: Very faint
      
      const barLineColor = 'rgba(255, 255, 255, 0.15)';
      const beatLineColor = 'rgba(255, 255, 255, 0.05)';
      const subLineColor = 'rgba(255, 255, 255, 0.02)';

      // 1. Bar Lines (Brightest)
      let bgImage = `linear-gradient(to right, ${barLineColor} 1px, transparent 1px)`; 
      let bgSize = `${pixelsPerBar}px 100%`;
      
      // 2. Beat Lines
      if (showTicks) {
          bgImage += `, linear-gradient(to right, ${beatLineColor} 1px, transparent 1px)`; 
          bgSize += `, ${pixelsPerTick}px 100%`;
      }
      
      // 3. Subdivision Lines
      if (showSubdivisions) {
          bgImage += `, linear-gradient(to right, ${subLineColor} 1px, transparent 1px)`; 
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
                height,
                backgroundColor: '#191919' // Logic Pro workspace background
            }} 
        />
    );
});

export default ArrangerGrid;
