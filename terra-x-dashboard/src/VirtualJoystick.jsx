import { useState, useRef, useEffect, useCallback } from 'react';

export const VirtualJoystick = ({ onDirectionChange, size = 160 }) => {
  const containerRef = useRef(null);
  const lastDirRef = useRef("STOP");
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // relative to center, -1 to 1

  const maxRadius = size / 2 - 25; // 25 is knob radius

  const handlePointerDown = (e) => {
    setActive(true);
    e.target.setPointerCapture(e.pointerId);
    updatePos(e);
  };

  const handlePointerMove = (e) => {
    if (!active) return;
    updatePos(e);
  };

  const handlePointerUp = (e) => {
    setActive(false);
    setPos({ x: 0, y: 0 });
    try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
    onDirectionChange({ x: 0, y: 0 });
  };

  const updatePos = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    
    const distance = Math.hypot(dx, dy);
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    // Normalize to -1 to 1
    const nx = dx / maxRadius;
    const ny = dy / maxRadius; // Note: negative is UP (Forward)
    setPos({ x: dx, y: dy });

    // Send continuous analog values
    if (distance > maxRadius * 0.1) { // 10% deadzone
      onDirectionChange({ x: nx, y: ny });
    } else {
      onDirectionChange({ x: 0, y: 0 }); // STOP
    }
  }, [maxRadius, onDirectionChange]);

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: size, height: size,
        background: 'rgba(10, 15, 20, 0.5)',
        border: '2px solid var(--border)',
        borderRadius: '50%',
        position: 'relative',
        touchAction: 'none',
        cursor: 'grab'
      }}
    >
      <div 
        style={{
          width: 50, height: 50,
          background: active ? 'var(--acc)' : 'var(--muted)',
          borderRadius: '50%',
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          transition: active ? 'none' : 'transform 0.2s ease-out'
        }}
      />
    </div>
  );
};
