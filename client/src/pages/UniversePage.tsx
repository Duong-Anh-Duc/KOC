import {
  ArrowLeftOutlined,
  AuditOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  DragOutlined,
  ExpandAltOutlined,
  GlobalOutlined,
  MailOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SendOutlined,
  ShareAltOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Billboard, Html, OrbitControls, Stars, Text } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Space, Spin, Switch, Tag } from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../components/common';
import React, { Suspense, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { auditApi } from '../api';
import ModulePanelContent from '../components/universe/ModulePanelContent';
import { useDashboardOverview } from '../hooks/useDashboard';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../stores';
import type { AuditLog } from '../types';
import { formatUSD } from '../utils';

interface ModuleNode {
  id: string;
  name: string;
  Icon: React.ComponentType<any>;
  color: string;
  path: string;
  metricLabel: string;
  metric: string | number;
  radius: number;
  angle: number;
  speed: number;
  size: number;
  elev: number;
  inclination: number;
}

// Shared orbit formula — Kepler-like ellipse on a tilted plane.
function orbPosition(
  m: { radius: number; angle: number; speed: number; inclination: number; elev: number },
  time: number,
  target?: THREE.Vector3,
): THREE.Vector3 {
  const t = time * m.speed + m.angle;
  const lx = Math.cos(t) * m.radius;
  const lz = Math.sin(t) * m.radius;
  const c = Math.cos(m.inclination);
  const s = Math.sin(m.inclination);
  const out = target ?? new THREE.Vector3();
  out.set(lx, m.elev + lz * s, lz * c);
  return out;
}

type ModuleMeta = Omit<
  ModuleNode,
  'radius' | 'angle' | 'speed' | 'size' | 'elev' | 'inclination' | 'metric' | 'metricLabel'
>;

const EBE_ORANGE = '#ED8F3A';
const EBE_ORANGE_DEEP = '#b5611f';
const EBE_ORANGE_GLOW = '#ffb778';

// Procedural canvas texture so each orb shows visible surface detail → self-rotation is perceivable.
function makeOrbTexture(hexColor: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, size, size);

  // Strong dark blobs — high contrast so rotation is unmistakable.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 18 + Math.random() * 70;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bright highlights
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 22;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thin streaks → look like atmospheric bands
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 8; i++) {
    const y = Math.random() * size;
    const h = 3 + Math.random() * 10;
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    ctx.fillRect(0, y, size, h);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const STAFF_CONNECTIONS: Array<[string, string]> = [
  ['koc', 'revenue'],
  ['revenue', 'stats'],
  ['koc', 'stats'],
  ['revenue', 'send-email'],
  ['dashboard', 'revenue'],
  ['dashboard', 'koc'],
  ['cron-settings', 'revenue'],
  ['email-settings', 'send-email'],
  ['audit', 'users'],
  ['permissions', 'users'],
];

function CentralCore({ activity, title, pulseLabel, perMinuteLabel }: {
  activity: number;
  title: string;
  pulseLabel: string;
  perMinuteLabel: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const halo2Ref = useRef<THREE.Mesh>(null);
  const coreTexture = useMemo(() => makeOrbTexture(EBE_ORANGE_DEEP), []);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.22;
    if (haloRef.current) haloRef.current.rotation.z += delta * 0.25;
    if (halo2Ref.current) halo2Ref.current.rotation.z -= delta * 0.18;
  });

  return (
    <group>
      {/* Hazy ring halo — FIXED, sits below the orbs. Layered soft torus shells, no hard edge. */}
      <mesh position={[0, -3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[14, 0.2, 18, 200]} />
        <meshBasicMaterial color={EBE_ORANGE_GLOW} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, -3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[14, 0.55, 16, 200]} />
        <meshBasicMaterial color={EBE_ORANGE} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, -3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[14, 1.1, 14, 200]} />
        <meshBasicMaterial color={EBE_ORANGE_DEEP} transparent opacity={0.05} depthWrite={false} />
      </mesh>

      <mesh ref={meshRef}>
        <sphereGeometry args={[2.2, 96, 96]} />
        <meshPhysicalMaterial
          map={coreTexture}
          color={EBE_ORANGE_DEEP}
          emissive={EBE_ORANGE}
          emissiveIntensity={0.7}
          transparent
          opacity={0.92}
          roughness={0.3}
          metalness={0.3}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.9, 0.025, 8, 120]} />
        <meshBasicMaterial color={EBE_ORANGE_GLOW} transparent opacity={0.5} />
      </mesh>
      <mesh ref={halo2Ref} rotation={[Math.PI / 2.3, Math.PI / 6, 0]}>
        <torusGeometry args={[3.4, 0.02, 8, 120]} />
        <meshBasicMaterial color={EBE_ORANGE} transparent opacity={0.35} />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.55, 32, 32]} />
        <meshBasicMaterial color={EBE_ORANGE} transparent opacity={0.08} />
      </mesh>

      <Billboard position={[0, 2.9, 0]}>
        <Text fontSize={0.2} color={EBE_ORANGE_GLOW} anchorX="center" anchorY="bottom" letterSpacing={0.25} outlineWidth={0.015} outlineColor="#000">{pulseLabel}</Text>
      </Billboard>
      <Billboard position={[0, 0, 0]}>
        <Text fontSize={1.6} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#0a0a15">{activity}</Text>
      </Billboard>
      <Billboard position={[0, -1.2, 0]}>
        <Text fontSize={0.26} color="#c0a080" anchorX="center" anchorY="top" outlineWidth={0.015} outlineColor="#000">{perMinuteLabel}</Text>
      </Billboard>
      <Billboard position={[0, -3.3, 0]}>
        <Text fontSize={0.28} color="#e0c4a0" anchorX="center">{title}</Text>
      </Billboard>
    </group>
  );
}

function ModuleOrb({ m, onClick, onHover, showLabel, highlighted }: {
  m: ModuleNode;
  onClick: () => void;
  onHover: (hover: boolean) => void;
  showLabel: boolean;
  highlighted: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const active = hovered || highlighted;
  const texture = useMemo(() => makeOrbTexture(m.color), [m.color]);
  // Deterministic per-orb spin speed + tilt so each one feels like a unique planet.
  const spinSpeed = useMemo(() => 0.7 + (Math.sin(m.angle * 3.7) + 1) * 0.35, [m.angle]);
  const tilt = useMemo(() => ({
    x: Math.sin(m.angle * 1.7) * 0.35,
    z: Math.cos(m.angle * 2.3) * 0.35,
  }), [m.angle]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    orbPosition(m, clock.getElapsedTime(), groupRef.current.position);
    if (sphereRef.current) sphereRef.current.rotation.y += delta * spinSpeed;
    if (glowRef.current) {
      const base = active ? 1.5 : 1;
      const scale = base + Math.sin(clock.getElapsedTime() * 2 + m.angle) * 0.04;
      glowRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[m.size * 1.25, 32, 32]} />
        <meshBasicMaterial color={m.color} transparent opacity={active ? 0.28 : 0.12} />
      </mesh>

      <group ref={tiltRef} rotation={[tilt.x, 0, tilt.z]}>
        <mesh
          ref={sphereRef}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHovered(false); onHover(false); document.body.style.cursor = 'default'; }}
        >
          <sphereGeometry args={[m.size, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            emissive={m.color}
            emissiveIntensity={active ? 0.35 : 0.12}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>
      </group>

      {/* Icon tag floats above the orb, not on it — so the spinning surface is unobstructed */}
      <Html position={[0, m.size + 0.7, 0]} center distanceFactor={10} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `${m.color}`,
          color: 'rgba(20,20,30,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
          boxShadow: `0 0 12px ${m.color}aa, inset 0 -2px 4px rgba(0,0,0,0.25)`,
          border: '1px solid rgba(255,255,255,0.35)',
        }}>
          <m.Icon />
        </div>
      </Html>

      {showLabel && (
        <Billboard position={[0, -(m.size + 0.55), 0]}>
          <Text fontSize={0.24} color="#fff" anchorX="center" anchorY="top" outlineWidth={0.012} outlineColor="#000">{m.name}</Text>
          <Text fontSize={0.15} color={m.color} anchorX="center" anchorY="top" position={[0, -0.35, 0]}>
            {m.metricLabel ? `${m.metricLabel}: ${m.metric}` : `${m.metric}`}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

const CENTRAL_SEGMENTS = 64;

function CentralConnectionBeam({ module, index }: { module: ModuleNode; index: number }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<any>(null);
  const offset = useMemo(() => Math.random(), []);
  // Alternate sweep direction per beam so arcs fan symmetrically
  const sweepSign = useMemo(() => (index % 2 === 0 ? 1 : -1), [index]);
  const vertSign = useMemo(() => (Math.floor(index / 2) % 2 === 0 ? 1 : -1), [index]);
  const initialArr = useMemo(() => new Float32Array((CENTRAL_SEGMENTS + 1) * 3), []);

  useFrame(({ clock }) => {
    const c = clock.getElapsedTime();
    const endV = orbPosition(module, c);
    const startV = endV.clone().normalize().multiplyScalar(2.3);
    const axisLen = endV.distanceTo(startV);

    // Tangent in horizontal plane → sweeps sideways like an orbital trajectory
    const tangent = new THREE.Vector3(-endV.z, 0, endV.x).normalize();

    // Two control points for a Cubic Bezier → graceful S-like arc
    const c1 = startV.clone().lerp(endV, 0.33);
    c1.addScaledVector(tangent, axisLen * 0.42 * sweepSign);
    c1.y += axisLen * 0.08 * vertSign;

    const c2 = startV.clone().lerp(endV, 0.66);
    c2.addScaledVector(tangent, axisLen * 0.42 * sweepSign);
    c2.y -= axisLen * 0.04 * vertSign;

    const curve = new THREE.CubicBezierCurve3(startV, c1, c2, endV);

    if (lineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i <= CENTRAL_SEGMENTS; i++) {
        const p = curve.getPoint(i / CENTRAL_SEGMENTS);
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
    if (particleRef.current) {
      const tNorm = (c * 0.28 + offset) % 1;
      particleRef.current.position.copy(curve.getPoint(tNorm));
    }
  });

  return (
    <>
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={CENTRAL_SEGMENTS + 1} array={initialArr} itemSize={3} args={[initialArr, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={module.color} transparent opacity={0.7} linewidth={1} />
      </line>
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={module.color} />
      </mesh>
    </>
  );
}

function ModuleConnectionBeam({ from, to, color }: { from: ModuleNode; to: ModuleNode; color: string }) {
  const lineRef = useRef<any>(null);
  const initialArr = useMemo(() => new Float32Array(41 * 3), []);

  const getPos = (m: ModuleNode, time: number): THREE.Vector3 => orbPosition(m, time);

  useFrame(({ clock }) => {
    const c = clock.getElapsedTime();
    const start = getPos(from, c);
    const end = getPos(to, c);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 1 + Math.sin(c) * 0.3;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const pts = curve.getPoints(40);

    if (lineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pts.length; i++) {
        positions[i * 3] = pts[i].x;
        positions[i * 3 + 1] = pts[i].y;
        positions[i * 3 + 2] = pts[i].z;
      }
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={41} array={initialArr} itemSize={3} args={[initialArr, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.15} />
    </line>
  );
}

function GroundRipples() {
  const RING_COUNT = 3;
  const ringsRef = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(({ clock }) => {
    const c = clock.getElapsedTime();
    // Each ring fires sequentially: ring 0 expands, fades, then ring 1 starts, etc.
    const ringDuration = 4.5; // seconds — how long one ripple expands
    const totalCycle = ringDuration * RING_COUNT;
    for (let i = 0; i < RING_COUNT; i++) {
      const mesh = ringsRef.current[i];
      if (!mesh) continue;
      const t = c % totalCycle;
      const windowStart = i * ringDuration;
      const localPhase = (t - windowStart) / ringDuration; // 0..1 during this ring's turn
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (localPhase < 0 || localPhase > 1) {
        mat.opacity = 0;
        continue;
      }
      const scale = 1 + localPhase * 13.5;
      mesh.scale.set(scale, scale, 1);
      const fadeIn = Math.min(1, localPhase * 5);
      const fadeOut = 1 - localPhase;
      mat.opacity = fadeIn * fadeOut * 0.1;
    }
  });

  return (
    <group position={[0, -2.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <mesh key={i} ref={(el) => { ringsRef.current[i] = el; }}>
          <ringGeometry args={[0.985, 1, 160]} />
          <meshBasicMaterial color={EBE_ORANGE_GLOW} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* Central bright pulse — smaller, faster ripple for an inner heartbeat */}
      <GroundInnerPulse />
    </group>
  );
}

function GroundInnerPulse() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const c = clock.getElapsedTime();
    if (!ref.current) return;
    const phase = (c / 4.5) % 1;
    const scale = 0.6 + phase * 3.2;
    ref.current.scale.set(scale, scale, 1);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (1 - phase) * 0.1;
  });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[0.94, 1, 96]} />
      <meshBasicMaterial color={EBE_ORANGE} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// Faint ring that traces the shared orbital path — makes the "orbit" instantly obvious.
function OrbitTrail({ radius, inclination = 0 }: { radius: number; inclination?: number }) {
  const points = useMemo(() => {
    const SEG = 256;
    const arr = new Float32Array((SEG + 1) * 3);
    const c = Math.cos(inclination);
    const s = Math.sin(inclination);
    for (let i = 0; i <= SEG; i++) {
      const t = (i / SEG) * Math.PI * 2;
      const lx = Math.cos(t) * radius;
      const lz = Math.sin(t) * radius;
      arr[i * 3] = lx;
      arr[i * 3 + 1] = lz * s;
      arr[i * 3 + 2] = lz * c;
    }
    return arr;
  }, [radius, inclination]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length / 3} array={points} itemSize={3} args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={EBE_ORANGE_GLOW} transparent opacity={0.25} />
    </line>
  );
}

function Scene({
  modules, activity, showLabels, onSelect, onHoverModule, hoveredId, connections, title, pulseLabel, perMinuteLabel,
}: {
  modules: ModuleNode[];
  activity: number;
  showLabels: boolean;
  onSelect: (m: ModuleNode) => void;
  onHoverModule: (m: ModuleNode | null) => void;
  hoveredId: string | null;
  connections: Array<[string, string]>;
  title: string;
  pulseLabel: string;
  perMinuteLabel: string;
}) {
  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const interConnections = useMemo(() =>
    connections
      .filter(([a, b]) => moduleMap.has(a) && moduleMap.has(b))
      .map(([a, b]) => ({ from: moduleMap.get(a)!, to: moduleMap.get(b)!, color: moduleMap.get(a)!.color })),
  [moduleMap, connections]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color={EBE_ORANGE} distance={25} />
      <pointLight position={[10, 10, 10]} intensity={0.6} color="#ffffff" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#f9a8d4" />
      <Stars radius={150} depth={70} count={7000} factor={4.5} saturation={0} fade speed={0.7} />

      <GroundRipples />
      <OrbitTrail radius={14} />
      <CentralCore activity={activity} title={title} pulseLabel={pulseLabel} perMinuteLabel={perMinuteLabel} />
      {modules.map((m, i) => <CentralConnectionBeam key={`cc-${m.id}`} module={m} index={i} />)}
      {interConnections.map((c, i) => <ModuleConnectionBeam key={`mc-${i}`} from={c.from} to={c.to} color={c.color} />)}
      {modules.map((m) => (
        <ModuleOrb
          key={m.id}
          m={m}
          onClick={() => onSelect(m)}
          onHover={(h) => onHoverModule(h ? m : null)}
          showLabel={showLabels}
          highlighted={hoveredId === m.id}
        />
      ))}
    </>
  );
}

const UniversePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { hasPermission } = usePermissions();
  const [showLabels, setShowLabels] = useState(true);
  const [realtime, setRealtime] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [hoveredModule, setHoveredModule] = useState<ModuleNode | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleNode | null>(null);

  const isKOC = user?.role === 'KOC';
  const isAdmin = user?.role === 'ADMIN';

  const { data: overview, isLoading } = useDashboardOverview();

  const { data: auditLogs } = useQuery({
    queryKey: ['universe', 'audit-recent'],
    queryFn: () => auditApi.getLogs({ limit: 50 }).then((r) => r.data.data as AuditLog[]),
    enabled: isAdmin,
    refetchInterval: realtime ? 10_000 : false,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!realtime) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [realtime]);

  const staffModules: ModuleMeta[] = useMemo(() => [
    { id: 'dashboard',    name: t('universe.modules.dashboard'), Icon: DashboardOutlined,  color: '#93c5fd', path: '/' },
    { id: 'koc',          name: t('universe.modules.koc'),       Icon: TeamOutlined,       color: '#ffb78a', path: '/koc' },
    { id: 'revenue',      name: t('universe.modules.revenue'),   Icon: DollarOutlined,     color: '#86efac', path: '/revenue' },
    { id: 'stats',        name: t('universe.modules.stats'),     Icon: BarChartOutlined,   color: '#a5b4fc', path: '/stats' },
    { id: 'send-email',   name: t('universe.modules.sendEmail'), Icon: SendOutlined,       color: '#fde68a', path: '/send-revenue-email' },
    { id: 'audit',        name: t('universe.modules.audit'),     Icon: AuditOutlined,      color: '#d1d5db', path: '/audit' },
  ], [t]);

  const adminExtra: ModuleMeta[] = useMemo(() => [
    { id: 'users',         name: t('universe.modules.users'),       Icon: UserSwitchOutlined, color: '#f9a8d4', path: '/users' },
    { id: 'cron-settings', name: t('universe.modules.cron'),        Icon: ShareAltOutlined,   color: '#99f6e4', path: '/cron-settings' },
    { id: 'email-settings',name: t('universe.modules.email'),       Icon: MailOutlined,       color: '#c4b5fd', path: '/email-settings' },
    { id: 'permissions',   name: t('universe.modules.permissions'), Icon: SafetyOutlined,     color: '#fdba74', path: '/permissions' },
  ], [t]);

  const kocModules: ModuleMeta[] = useMemo(() => [
    { id: 'my-revenue', name: t('universe.modules.myRevenue'), Icon: WalletOutlined,      color: '#ffb78a', path: '/my-revenue' },
    { id: 'clock',      name: t('universe.modules.clock'),     Icon: ClockCircleOutlined, color: '#a5b4fc', path: '/my-revenue' },
    { id: 'growth',     name: t('universe.modules.growth'),    Icon: BarChartOutlined,    color: '#86efac', path: '/my-revenue' },
  ], [t]);

  const metaList: ModuleMeta[] = useMemo(() => {
    if (isKOC) return kocModules;
    const items = staffModules.filter((m) => {
      if (isAdmin) return true;
      if (m.id === 'dashboard') return hasPermission('view_info') || hasPermission('view_revenue');
      if (m.id === 'koc') return hasPermission('view_info') || hasPermission('edit_info');
      if (m.id === 'revenue') return hasPermission('view_revenue') || hasPermission('edit_revenue');
      if (m.id === 'stats') return hasPermission('view_stats');
      if (m.id === 'send-email') return hasPermission('send_email');
      if (m.id === 'audit') return false;
      return false;
    });
    return isAdmin ? [...items, ...adminExtra] : items;
  }, [isKOC, isAdmin, hasPermission, staffModules, adminExtra, kocModules]);

  const connections = useMemo<Array<[string, string]>>(() => {
    if (isKOC) return [['my-revenue', 'growth'], ['my-revenue', 'clock']];
    return STAFF_CONNECTIONS;
  }, [isKOC]);

  const modules = useMemo<ModuleNode[]>(() => {
    const o = overview;
    const totalKOCs = o?.totalKOCs ?? 0;
    const activeKOCs = o?.activeKOCs ?? 0;
    const totalCycles = o?.totalCycles ?? 0;
    const netRevenue = o?.latestCycleSummary?.totalNetRevenue ?? 0;
    const kocPayUsd = o?.latestCycleSummary?.totalKocReceiveUsd ?? 0;
    const companyShare = o?.latestCycleSummary?.totalCompanyShare ?? 0;
    const growthCount = (o?.growthSummary || []).length;
    const recentCount = (o?.recentRecords || []).length;
    const latestMonth = o?.latestCycleSummary?.cycle?.month ?? t('universe.metrics.empty');

    const metrics: Record<string, { label: string; value: string | number }> = {
      dashboard:       { label: t('universe.metrics.cycles'), value: totalCycles },
      koc:             { label: t('universe.metrics.active'), value: `${activeKOCs}/${totalKOCs}` },
      revenue:         { label: t('universe.metrics.net'),    value: formatUSD(netRevenue) },
      stats:           { label: t('universe.metrics.growth'), value: growthCount },
      'send-email':    { label: t('universe.metrics.sent'),   value: recentCount },
      audit:           { label: '', value: t('universe.metrics.log') },
      users:           { label: '', value: t('universe.metrics.manage') },
      'cron-settings': { label: '', value: t('universe.metrics.cron') },
      'email-settings':{ label: '', value: t('universe.metrics.gmail') },
      permissions:     { label: '', value: t('universe.metrics.roles') },
      'my-revenue':    { label: t('universe.metrics.received'), value: formatUSD(kocPayUsd) },
      clock:           { label: t('universe.metrics.period'),   value: latestMonth },
    };
    if (isKOC) metrics.growth = { label: t('universe.metrics.company'), value: formatUSD(companyShare) };

    const n = metaList.length;
    // All orbs share ONE orbital ring around the core — evenly spaced, same plane.
    return metaList.map((d, i) => ({
      ...d,
      metricLabel: metrics[d.id]?.label ?? '',
      metric: metrics[d.id]?.value ?? '',
      radius: 14,
      angle: (i / Math.max(n, 1)) * Math.PI * 2,
      speed: 0.25,
      size: 1.2,
      elev: 0,
      inclination: 0,
    }));
  }, [overview, metaList, isKOC, t]);

  // Real activity = count of audit events in the last 60 seconds.
  const activity = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return 0;
    const cutoff = now - 60_000;
    return auditLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).length;
  }, [auditLogs, now]);

  const formatAgo = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 5) return t('universe.timeAgo.justNow');
    if (s < 60) return t('universe.timeAgo.seconds', { n: s });
    const m = Math.floor(s / 60);
    if (m < 60) return t('universe.timeAgo.minutes', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('universe.timeAgo.hours', { n: h });
    const d = Math.floor(h / 24);
    return t('universe.timeAgo.days', { n: d });
  };

  // Real status pill = latest audit event translated + human time ago.
  const statusPill = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return null;
    const latest = auditLogs[0];
    const action = t(`audit.actions.${latest.action}`, { defaultValue: latest.action });
    const entity = t(`audit.entities.${latest.entity}`, { defaultValue: latest.entity });
    const ago = formatAgo(now - new Date(latest.timestamp).getTime());
    return { module: `${action} · ${entity}`, ago };
  }, [auditLogs, now, t]);

  const handleSelect = (m: ModuleNode) => { setSelectedModule(m); };

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const overlayBtn: React.CSSProperties = {
    background: 'rgba(20,20,25,0.7)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '8px 12px', color: '#ccc', backdropFilter: 'blur(8px)',
  };
  const statCard: React.CSSProperties = {
    background: 'rgba(20,20,25,0.6)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: isMobile ? '6px 10px' : '10px 14px',
    minWidth: isMobile ? 70 : 100, backdropFilter: 'blur(8px)',
  };

  const totalKOCs = overview?.totalKOCs ?? 0;
  const activeKOCs = overview?.activeKOCs ?? 0;
  const totalCycles = overview?.totalCycles ?? 0;

  const coreTitle = isKOC ? t('universe.corePortal') : t('universe.coreStaff');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#05050a', overflow: 'hidden', zIndex: 100,
    }}>
      <Button
        icon={<ArrowLeftOutlined />}
        type="text"
        onClick={() => navigate(isKOC ? '/my-revenue' : '/')}
        style={{
          position: 'absolute', top: 16, left: 16, zIndex: 10,
          color: '#fff', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
        }}
      >
        {isKOC ? t('kocPortal.title') : t('menu.dashboard')}
      </Button>

      {!isMobile && (
        <div style={{ position: 'absolute', top: 16, left: 160, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(237,143,58,0.18)', border: `1px solid ${EBE_ORANGE}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: EBE_ORANGE_GLOW,
          }}>
            <GlobalOutlined style={{ fontSize: 20 }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('universe.title')}</div>
            <div style={{ color: '#4ade80', fontSize: 10, letterSpacing: 1.2 }}>● {t('universe.subtitle')}</div>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: isMobile ? '60vw' : 'none',
      }}>
        <div style={statCard}>
          <div style={{ color: '#fff', fontSize: isMobile ? 15 : 18, fontWeight: 700 }}>{modules.length}</div>
          <div style={{ color: '#888', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{t('universe.stats.features')}</div>
        </div>
        {!isKOC && (
          <div style={statCard}>
            <div style={{ color: '#fff', fontSize: isMobile ? 15 : 18, fontWeight: 700 }}>{activeKOCs}/{totalKOCs}</div>
            <div style={{ color: '#888', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{t('universe.stats.activeKocs')}</div>
          </div>
        )}
        {!isMobile && !isKOC && (
          <div style={statCard}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{totalCycles}</div>
            <div style={{ color: '#888', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{t('universe.stats.cycles')}</div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <AppSpin size="large" />
        </div>
      ) : (
        <Canvas
          key={resetKey}
          camera={{ position: [0, 2, 28], fov: 55 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: 'radial-gradient(ellipse at center, #140a05 0%, #07050a 60%, #000 100%)' }}
        >
          <Suspense fallback={null}>
            <Scene
              modules={modules}
              activity={activity}
              showLabels={showLabels}
              onSelect={handleSelect}
              onHoverModule={setHoveredModule}
              hoveredId={hoveredModule?.id ?? null}
              connections={connections}
              title={coreTitle}
              pulseLabel={t('universe.systemPulse')}
              perMinuteLabel={t('universe.perMinute')}
            />
            <EffectComposer>
              <Bloom intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
            </EffectComposer>
            <OrbitControls
              enablePan={false}
              minDistance={14}
              maxDistance={50}
              autoRotate={realtime}
              autoRotateSpeed={0.3}
            />
          </Suspense>
        </Canvas>
      )}

      {statusPill && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          background: 'rgba(20,20,30,0.75)', border: '1px solid rgba(237,143,58,0.35)',
          borderRadius: 20, padding: '8px 18px', color: '#e0c4a0', fontSize: 12, letterSpacing: 1,
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: EBE_ORANGE, boxShadow: `0 0 8px ${EBE_ORANGE}` }} />
          <span>{statusPill.module}</span>
          <span style={{ color: '#666' }}>·</span>
          <span>{statusPill.ago}</span>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        {!isMobile && (
          <Space size={16} style={{ color: '#888', fontSize: 12 }}>
            <span><DragOutlined /> {t('universe.hints.drag')}</span>
            <span><ExpandAltOutlined /> {t('universe.hints.zoom')}</span>
            <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 4 }}>{t('universe.hints.click')}</span>
            <span>{t('universe.hints.openFeature')}</span>
          </Space>
        )}
        <Space size={12}>
          <span style={overlayBtn}>
            <Switch checked={realtime} onChange={setRealtime} size="small" />
            <span style={{ marginLeft: 6 }}>{t('universe.controls.realtime')}</span>
          </span>
          <span style={overlayBtn}>
            <Switch checked={showLabels} onChange={setShowLabels} size="small" />
            <span style={{ marginLeft: 6 }}>{t('universe.controls.labels')}</span>
          </span>
          <Button icon={<ReloadOutlined />} onClick={() => setResetKey((k) => k + 1)} style={overlayBtn as any}>
            {t('universe.controls.reset')}
          </Button>
        </Space>
      </div>

      {/* Hover tooltip — anchored bottom-center */}
      {hoveredModule && !selectedModule && (
        <div style={{
          position: 'absolute', bottom: 150, left: '50%', transform: 'translateX(-50%)', zIndex: 11,
          background: 'rgba(15,15,22,0.88)', border: `1px solid ${hoveredModule.color}55`,
          borderRadius: 14, padding: '12px 18px', color: '#fff', backdropFilter: 'blur(12px)',
          minWidth: 220, textAlign: 'center', pointerEvents: 'none',
          boxShadow: `0 8px 32px ${hoveredModule.color}22`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${hoveredModule.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: hoveredModule.color, fontSize: 14,
            }}>
              <hoveredModule.Icon />
            </span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{hoveredModule.name}</span>
          </div>
          <div style={{ color: hoveredModule.color, fontSize: 13, marginBottom: 6 }}>
            {hoveredModule.metricLabel ? `${hoveredModule.metricLabel}: ` : ''}{hoveredModule.metric}
          </div>
          <div style={{ color: '#888', fontSize: 11, letterSpacing: 0.5 }}>
            {t('universe.drawer.hoverHint')}
          </div>
        </div>
      )}

      {/* Right-side slide panel */}
      <Drawer
        title={selectedModule ? (
          <Space>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: `${selectedModule.color}33`, color: selectedModule.color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              <selectedModule.Icon />
            </span>
            <span>{selectedModule.name}</span>
            {selectedModule.metric ? (
              <AppTag color={selectedModule.color} style={{ marginLeft: 4, borderColor: 'transparent' }}>
                {selectedModule.metricLabel ? `${selectedModule.metricLabel}: ` : ''}{selectedModule.metric}
              </AppTag>
            ) : null}
          </Space>
        ) : null}
        placement="right"
        width={isMobile ? '90vw' : 440}
        open={!!selectedModule}
        onClose={() => setSelectedModule(null)}
        destroyOnClose
        styles={{
          body: { background: '#0a0a12', color: '#e0e0e0' },
          header: { background: '#0a0a12', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#fff' },
          content: { background: '#0a0a12' },
        }}
        closeIcon={<span style={{ color: '#aaa' }}>✕</span>}
      >
        {selectedModule && (
          <ModulePanelContent
            moduleId={selectedModule.id}
            overview={overview}
            auditLogs={auditLogs}
            onOpen={() => { const p = selectedModule.path; setSelectedModule(null); navigate(p); }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default UniversePage;
