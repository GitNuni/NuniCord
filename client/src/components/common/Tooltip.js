import React, { useState, useRef } from 'react';

export default function Tooltip({ content, children, side = 'right', delay = 400 }) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);

  function show() {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }

  function hide() {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  const positionClasses = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={`nc-tooltip ${positionClasses[side]} whitespace-nowrap z-[9999] pointer-events-none animate-fade-in`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
