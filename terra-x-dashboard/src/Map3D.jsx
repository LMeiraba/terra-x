import React, { useRef, useEffect, useMemo, useState, Component } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, Grid, Line, Text } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary — catches 3D crashes so the whole app doesn't go blank
// ─────────────────────────────────────────────────────────────────────────────
class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "#0a0f14", color: "#ff6b6b",
          fontFamily: "monospace", fontSize: 12, flexDirection: "column", gap: 8,
        }}>
          <span>⚠ 3D map render error</span>
          <span style={{ color: "#6e7681", fontSize: 10 }}>{String(this.state.error)}</span>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 8, padding: "4px 12px", background: "#1f6feb22", border: "1px solid #1f6feb", borderRadius: 4, color: "#58a6ff", cursor: "pointer" }}
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rover Model
// ─────────────────────────────────────────────────────────────────────────────
function Rover({ position, rotation, theme = "basic" }) {
  const groupRef = useRef();
  const vec = useMemo(() => new THREE.Vector3(), []);
  const targetObj = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0, 0, -10); // Point forward
    return t;
  }, []);
  
  useFrame(() => {
    if (groupRef.current) {
      vec.set(position[0], position[1], position[2]);
      groupRef.current.position.lerp(vec, 0.2); 
      groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
  });

  const bodyColor = theme === "cave" ? "#445566" : theme === "pipeline" ? "#d17c38" : "#cfd6e0";
  const accentColor = theme === "cave" ? "#00ff88" : theme === "pipeline" ? "#ff4400" : "#1f6feb";

  return (
    <group ref={groupRef}>
      {/* Main Body - Cyberpunk / Sci-fi style */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.26, 0.12, 0.44]} />
        <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Top Equipment Deck */}
      <mesh position={[0, 0.12, -0.05]}>
        <boxGeometry args={[0.2, 0.04, 0.25]} />
        <meshStandardMaterial color="#222" metalness={0.9} roughness={0.5} />
      </mesh>

      {/* 6 Wheels for better off-road look */}
      {[
        [-0.16, -0.02, 0.16], [0.16, -0.02, 0.16],
        [-0.16, -0.02, 0.0],  [0.16, -0.02, 0.0],
        [-0.16, -0.02, -0.16],[0.16, -0.02, -0.16]
      ].map((pos, i) => (
        <mesh key={i} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
          {/* Hubcaps */}
          <mesh position={[0, pos[0] > 0 ? 0.031 : -0.031, 0]}>
             <cylinderGeometry args={[0.04, 0.04, 0.01, 8]} />
             <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
          </mesh>
        </mesh>
      ))}

      {/* Sensor Eye / Headlight */}
      <mesh position={[0, 0.08, 0.22]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2} />
      </mesh>
      
      {/* Antenna */}
      <mesh position={[-0.08, 0.2, -0.15]}>
        <cylinderGeometry args={[0.005, 0.005, 0.2, 8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[-0.08, 0.3, -0.15]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2} />
      </mesh>
      
      {theme === "cave" && (
        <>
          <primitive object={targetObj} />
          <spotLight position={[0, 0.2, 0.2]} target={targetObj} angle={0.6} penumbra={0.4} intensity={40} distance={40} color="#00ff88" />
          <pointLight position={[0, 0.2, 0]} intensity={3} distance={5} color="#00ff88" />
        </>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live 3D Radar Sweep Arm — rotates with the servo angle
// ─────────────────────────────────────────────────────────────────────────────
function SweepArm({ roverPos, roverYaw, sweepAngle, sweepDistance }) {
  if (sweepAngle == null) return null;

  const RAD = Math.PI / 180;
  const worldYaw  = roverYaw * RAD;                 // rover heading in world
  const sweepRad  = (sweepAngle - 90) * RAD;          // servo angle relative to forward
  const totalAngle = worldYaw + sweepRad;
  const dist = Math.min(sweepDistance || 200, 200) / 100; // cm → m, capped 2m

  const ex = roverPos[0] - Math.sin(totalAngle) * dist; // -X is Left
  const ey = roverPos[1];
  const ez = roverPos[2] - Math.cos(totalAngle) * dist; // -Z is forward

  const start = [roverPos[0], roverPos[1] + 0.1, roverPos[2]];
  const end   = [ex, ey + 0.1, ez];

  return (
    <group>
      {/* Sweep line */}
      <Line
        points={[start, end]}
        color="#00ff88"
        lineWidth={2}
        transparent
        opacity={0.7}
      />
      {/* Endpoint dot */}
      <mesh position={end}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Terrain Ribbon — safe, no NaN
// ─────────────────────────────────────────────────────────────────────────────
function TerrainRibbon({ points }) {
  const geo = useMemo(() => {
    const MIN_STEP = 0.015; // skip points < 1.5cm apart
    const valid = [];
    for (let i = 0; i < points.length; i++) {
      if (valid.length === 0) { valid.push(points[i]); continue; }
      const prev = valid[valid.length - 1];
      const dx = points[i][0] - prev[0];
      const dz = points[i][2] - prev[2];
      if (Math.hypot(dx, dz) >= MIN_STEP) valid.push(points[i]);
    }
    if (valid.length < 2) return null;

    const W = 0.65;
    const positions = [], colors = [], indices = [];

    for (let i = 0; i < valid.length; i++) {
      const curr = valid[i];
      const next = valid[Math.min(i + 1, valid.length - 1)];
      const prev = valid[Math.max(i - 1, 0)];

      const fx = next[0] - prev[0];
      const fz = next[2] - prev[2];
      const flen = Math.hypot(fx, fz);
      if (flen < 1e-5) continue;

      const rx =  fz / flen;
      const rz = -fx / flen;

      const roll = curr[3] || 0;
      const rollRad = roll * Math.PI / 180;
      const bank = Math.sin(rollRad) * W * 0.4;

      positions.push(
        curr[0] - rx * W, curr[1] + bank,  curr[2] - rz * W,
        curr[0] + rx * W, curr[1] - bank,  curr[2] + rz * W,
      );

      const t = Math.min(1, Math.max(0, curr[1]));
      colors.push(0.1, 0.4 + t * 0.3, 0.85, 0.1, 0.4 + t * 0.3, 0.85);

      if (i < valid.length - 1) {
        const b = i * 2;
        indices.push(b, b+1, b+3,  b, b+3, b+2);
      }
    }

    if (positions.length < 6) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [points]);

  if (!geo) return null;
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.5} roughness={0.8} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Path line
// ─────────────────────────────────────────────────────────────────────────────
function PathLine({ points }) {
  if (points.length < 2) return null;
  const pts = points.map(p => [p[0], p[1], p[2]]);
  return <Line points={pts} color="#58a6ff" lineWidth={3} transparent opacity={0.85} frustumCulled={false} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voxel Occupancy Grid (OctoMap-style)
// Each radar ping snaps to nearest VOXEL_SIZE cell.
// Multiple pings in same cell → one solid cube, brighter as confidence grows.
// ─────────────────────────────────────────────────────────────────────────────
const VOXEL = 0.15; // 15 cm per voxel cell
const snapToGrid = v => Math.round(v / VOXEL);

function VoxelMap({ points, theme = "basic" }) {
  const meshRef = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  // Build occupancy map: key "gx,gy,gz" → { wx, wy, wz, count }
  const voxels = useMemo(() => {
    const map = new Map();
    for (const p of points) {
      const gx = snapToGrid(p[0]);
      const gy = snapToGrid(p[1]);
      const gz = snapToGrid(p[2]);
      const key = `${gx},${gy},${gz}`;
      if (!map.has(key)) {
        map.set(key, { wx: gx * VOXEL, wy: gy * VOXEL, wz: gz * VOXEL, count: 0, gx, gy, gz });
      }
      map.get(key).count++;
    }
    return Array.from(map.values());
  }, [points]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || voxels.length === 0) return;

    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(80000 * 3), 3);
    }

    voxels.forEach((v, i) => {
      dummy.position.set(v.wx, v.wy + VOXEL/2, v.wz); // lowered position
      
      if (theme === "cave") {
        // Jagged rocks based on position pseudo-random
        const rand = (Math.sin(v.gx * 12.9898 + v.gz * 78.233) * 43758.5453) % 1;
        // Make rocks much smaller so they don't swallow the rover
        dummy.scale.set(0.6 + rand*0.6, 0.5 + rand*0.8, 0.6 + rand*0.6);
        dummy.rotation.set(rand * 0.5, rand * Math.PI, rand * 0.5);
      } else if (theme === "pipeline") {
        // Sci-fi modular crates/blocks
        dummy.scale.set(0.8, 0.8, 0.8);
        dummy.rotation.set(0, 0, 0);
      } else {
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
      }
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      
      // Color logic
      const conf = Math.min(1, v.count / 5);
      let col;
      if (theme === "cave") {
        col = new THREE.Color(0.25 + conf*0.15, 0.2 + conf*0.1, 0.18 + conf*0.1);
      } else if (theme === "pipeline") {
        col = new THREE.Color(0.7 + conf*0.3, 0.3 + conf*0.2, 0.1); // Metallic orange crates
      } else {
        col = new THREE.Color(0, 0.35 + conf * 0.65, 0.15 + conf * 0.35); // Tech blue/green
      }
      mesh.setColorAt(i, col);
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = voxels.length;
  }, [voxels, dummy, theme]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, 80000]} frustumCulled={false}>
      {theme === "cave" ? (
        <dodecahedronGeometry args={[VOXEL * 0.8]} />
      ) : (
        <boxGeometry args={[VOXEL * 0.92, VOXEL * 0.92, VOXEL * 0.92]} />
      )}
      <meshStandardMaterial
        vertexColors
        transparent={theme === "basic"}
        opacity={theme === "basic" ? 0.78 : 1}
        roughness={theme === "pipeline" ? 0.4 : 0.9}
        metalness={theme === "pipeline" ? 0.6 : 0.1}
      />
    </instancedMesh>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Camera follow — only lerps when follow=true
// ─────────────────────────────────────────────────────────────────────────────
function CameraFollow({ target, follow }) {
  const vec = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, controls }) => {
    if (!controls || !follow) return;
    vec.set(target[0], target[1], target[2]);
    
    // Calculate the distance to the target
    const dx = vec.x - controls.target.x;
    const dy = vec.y - controls.target.y;
    const dz = vec.z - controls.target.z;

    // Use a small lerp factor to absorb the 10Hz update stutter (smoothing it to 60fps)
    const smooth = 0.05;

    // Pan both the camera and the controls target by the exact same amount
    // This keeps the user's zoom/orbit angle perfectly locked while following
    controls.target.x += dx * smooth;
    controls.target.y += dy * smooth;
    controls.target.z += dz * smooth;

    camera.position.x += dx * smooth;
    camera.position.y += dy * smooth;
    camera.position.z += dz * smooth;

    controls.update();
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner scene (wrapped by error boundary below)
// ─────────────────────────────────────────────────────────────────────────────
function Map3DScene({ path3D = [], obstacles3D = [], roverYaw = 0, sweepAngle = null, sweepDistance = 200, theme = "basic" }) {
  const roverPos   = path3D.length > 0 ? path3D[path3D.length - 1] : [0, 0, 0];
  const roverRot   = [0, (roverYaw * Math.PI) / 180, 0];
  const controlsRef = useRef();
  const [followMode, setFollowMode] = useState(true); // default: following rover

  const x    = (roverPos[0] || 0).toFixed(2);
  const z    = (roverPos[2] || 0).toFixed(2);
  const h    = (roverPos[1] || 0).toFixed(2);
  const dist = Math.hypot(roverPos[0] || 0, roverPos[2] || 0).toFixed(2);

  const btnStyle = (active) => ({
    background: active ? "#1f6feb" : "rgba(10,15,20,0.85)",
    border: `1px solid ${active ? "#58a6ff" : "#1f6feb55"}`,
    borderRadius: 5, color: active ? "#fff" : "#58a6ff",
    fontFamily: "monospace", fontSize: 12, padding: "4px 10px",
    cursor: "pointer", userSelect: "none",
  });

  const zoomIn  = () => { if (!controlsRef.current) return; controlsRef.current.dollyOut(1.4); controlsRef.current.update(); };
  const zoomOut = () => { if (!controlsRef.current) return; controlsRef.current.dollyIn(1.4);  controlsRef.current.update(); };
  const focus   = () => {
    if (!controlsRef.current) return;
    const t = new THREE.Vector3(roverPos[0], roverPos[1], roverPos[2]);
    controlsRef.current.target.copy(t);
    // Move camera to a nice zoomed-in bird's-eye position relative to rover
    controlsRef.current.object.position.set(t.x, t.y + 6, t.z + 3);
    controlsRef.current.update();
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0f14" }}>

      {/* ── Coordinate HUD — top left ── */}
      <div style={{
        position: "absolute", top: 8, left: 8, zIndex: 10,
        background: "rgba(10,15,20,0.82)", border: "1px solid #1f6feb44",
        borderRadius: 6, padding: "6px 10px",
        fontFamily: "monospace", fontSize: 11, color: "#58a6ff",
        pointerEvents: "none", lineHeight: 1.6,
      }}>
        X: <b>{x}</b>m &nbsp; Z: <b>{z}</b>m &nbsp; H: <b>{h}</b>m<br />
        <span style={{ color: "#6e7681" }}>↔ {dist}m from start</span><br />
        <span style={{ color: "#484f58", fontSize: 9 }}>L-drag: pan · R-drag: rotate · scroll: zoom</span>
      </div>

      {/* ── Camera Controls — bottom right ── */}
      <div style={{
        position: "absolute", bottom: 12, right: 12, zIndex: 10,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <button style={btnStyle(false)} onClick={zoomIn}  title="Zoom In">＋</button>
        <button style={btnStyle(false)} onClick={zoomOut} title="Zoom Out">－</button>
        <button style={btnStyle(false)} onClick={focus}   title="Focus on Rover">◎</button>
        <button
          style={btnStyle(followMode)}
          onClick={() => setFollowMode(f => !f)}
          title={followMode ? "Unfollow" : "Follow Rover"}
        >{followMode ? "🔒" : "🔓"}</button>
      </div>

      <Canvas
        camera={{ position: [0, 12, 4], fov: 50, near: 0.01, far: 5000 }}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
      >
        {theme === "cave" ? (
          <>
            <ambientLight intensity={0.05} />
            <fog attach="fog" args={["#0a0f14", 5, 40]} />
          </>
        ) : theme === "pipeline" ? (
          <>
            <ambientLight intensity={0.4} color="#ffeedd" />
            <pointLight position={[5, 8, 5]} intensity={1.5} color="#ff9900" />
            <pointLight position={[-5, 3, -5]} intensity={1.0} color="#ffaa55" />
            <hemisphereLight groundColor="#0a0f14" color="#ffaa55" intensity={0.3} />
            <fog attach="fog" args={["#0f141e", 10, 80]} />
          </>
        ) : (
          <>
            <ambientLight intensity={0.5} />
            <pointLight position={[5, 8, 5]} intensity={1.0} color="#58a6ff" />
            <pointLight position={[-5, 3, -5]} intensity={0.5} color="#00ff88" />
            <hemisphereLight groundColor="#0a0f14" color="#1f6feb" intensity={0.4} />
          </>
        )}

        {theme !== "cave" && theme !== "pipeline" && (
          <Grid
            args={[500, 500]}
            cellSize={1} cellThickness={0.6} cellColor="#1a2f5e"
            sectionSize={5} sectionThickness={1} sectionColor="#1f6feb"
            fadeDistance={100} fadeStrength={1.5} infiniteGrid
            position={[0, -0.01, 0]}
          />
        )}

        <TerrainRibbon points={path3D} />
        <PathLine points={path3D.length > 1 ? path3D : [[0,0,0],[0,0,0.001]]} />
        <VoxelMap points={obstacles3D} theme={theme} />

        <SweepArm
          roverPos={[roverPos[0], roverPos[1], roverPos[2]]}
          roverYaw={roverYaw}
          sweepAngle={sweepAngle}
          sweepDistance={sweepDistance}
        />

        <Rover position={[roverPos[0], roverPos[1], roverPos[2]]} rotation={roverRot} theme={theme} />

        {/* ── STARTING ORIGIN MARKER ── */}
        <group position={[0, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[0.2, 0.3, 32]} />
            <meshBasicMaterial color="#ff7b72" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.15, 0.4, 8]} />
            <meshStandardMaterial color="#ff7b72" />
          </mesh>
          <Text 
            position={[0, 0.02, -0.5]} 
            rotation={[-Math.PI / 2, 0, 0]} 
            color="#ff7b72" 
            fontSize={0.4} 
            anchorX="center" 
            anchorY="middle"
          >
            START
          </Text>
        </group>

        <CameraFollow target={roverPos} follow={followMode} />

        {/* MapControls: Left=Pan, Right=Rotate, Scroll=Zoom — much more natural for map navigation */}
        <MapControls
          ref={controlsRef}
          makeDefault
          enablePan
          enableZoom
          enableRotate
          zoomSpeed={1.5}
          panSpeed={1.2}
          rotateSpeed={0.5}
          minDistance={0.5}
          maxDistance={500}
          maxPolarAngle={Math.PI / 2.05}  // prevent going underground
          screenSpacePanning={true}       // pan follows screen, not world axis
        />
      </Canvas>
    </div>
  );
}

// Wrap with error boundary so 3D crashes don't blank the whole app
export function Map3D(props) {
  return (
    <MapErrorBoundary>
      <Map3DScene {...props} />
    </MapErrorBoundary>
  );
}
