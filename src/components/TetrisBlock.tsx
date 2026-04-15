import React from 'react';

interface TetrisBlockProps {
  color: string;
  size?: number;
  style?: React.CSSProperties;
  animated?: boolean;
  delay?: number;
}

const TetrisBlock: React.FC<TetrisBlockProps> = ({ color, size = 20, style, animated = false, delay = 0 }) => (
  <div
    style={{
      width: size,
      height: size,
      background: color,
      boxShadow: `inset -${size/6}px -${size/6}px 0 rgba(0,0,0,0.5), inset ${size/6}px ${size/6}px 0 rgba(255,255,255,0.3), 0 0 ${size/2}px ${color}88`,
      border: '1px solid rgba(0,0,0,0.4)',
      imageRendering: 'pixelated' as any,
      animation: animated ? `float ${3 + delay}s ease-in-out infinite` : undefined,
      animationDelay: `${delay}s`,
      flexShrink: 0,
      ...style,
    }}
  />
);

export default TetrisBlock;