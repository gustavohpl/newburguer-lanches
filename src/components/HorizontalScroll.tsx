import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function HorizontalScroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div className="relative group">
      {/* Botão esquerda (desktop hover) */}
      <button 
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -ml-2"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      
      {/* Container scroll */}
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <style>{`
          .horizontal-scroll-hide::-webkit-scrollbar { display: none; }
        `}</style>
        {children}
      </div>

      {/* Botão direita (desktop hover) */}
      <button 
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
