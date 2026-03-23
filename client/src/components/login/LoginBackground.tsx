import React from 'react';

interface Props {
  mousePos: { x: number; y: number };
}

const PARTICLE_SIZES = [3,5,2,4,3,6,2,4,3,5,2,4,3,5,4,3,5,2,6,3];
const PARTICLE_TOPS  = [8,20,45,70,85,15,60,35,90,50,25,75,55,30,42,68,12,78,38,62];
const PARTICLE_LEFTS = [5,25,80,15,60,70,40,90,30,55,45,85,10,65,72,18,52,88,22,48];
const PARTICLE_DURATIONS = [3,4,5,3,4,5,3,4,3,5,3,4,3,5,4,3,5,3,6,3];

const LoginBackground: React.FC<Props> = ({ mousePos }) => (
  <>
    {/* EBE Media brand watermark */}
    <div className="lp-brand-bg" />

    {/* Mouse-follow glow */}
    <div className="lp-mouse-glow" style={{ left: mousePos.x, top: mousePos.y }} />

    {/* Animated mesh grid */}
    <div className="lp-grid" />

    {/* Glowing orbs */}
    <div className="lp-orb lp-orb-1" />
    <div className="lp-orb lp-orb-2" />
    <div className="lp-orb lp-orb-3" />

    {/* Shooting stars */}
    <div className="lp-shooting lp-shooting-1" />
    <div className="lp-shooting lp-shooting-2" />
    <div className="lp-shooting lp-shooting-3" />

    {/* Floating particles */}
    {PARTICLE_SIZES.map((size, i) => (
      <div
        key={i}
        className={`lp-particle lp-particle-${(i % 3) + 1}`}
        style={{
          width: size,
          height: size,
          top: `${PARTICLE_TOPS[i]}%`,
          left: `${PARTICLE_LEFTS[i]}%`,
          animationDelay: `${i * 0.3}s`,
          animationDuration: `${PARTICLE_DURATIONS[i]}s`,
        }}
      />
    ))}
  </>
);

export default LoginBackground;
