import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import * as ort from "onnxruntime-web";
import "./App.css";

const yoloClasses = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];
import { RadarCanvas } from "./RadarCanvas";
import { Map3D } from "./Map3D";
import { VirtualJoystick } from "./VirtualJoystick";

// ── Isolated Input Component ───────────────────────────────────────────────
const CamUrlInput = memo(({ url, onChange }) => {
  const [val, setVal] = useState(url);
  return (
    <div className="cam-url-row" style={{ display: "flex", gap: 8 }}>
      <input 
        className="input-sm" 
        style={{ flex: 1 }}
        value={val} 
        onChange={e => setVal(e.target.value)} 
        onBlur={() => onChange(val)}
        onKeyDown={e => e.key === 'Enter' && onChange(val)}
        placeholder="http://192.168.X.X:81/stream" 
      />
      <button className="btn-sm" onClick={() => onChange(val)}>Set</button>
    </div>
  );
});


// ─── SIM DATA GENERATOR — same shape as real ESP32 JSON ──────────────────
let simYaw = 0;

const simTick = (t, drive, config = {}) => {
  // Simulate servo sweeping back and forth (0° to 180°)
  const sweep = 90 + Math.sin(t / 1000) * 90;
  // Simulate a tunnel: walls are at left (0°) and right (180°), so straight ahead (90°) is far
  const wallDist = 30 / Math.max(0.01, Math.abs(Math.cos(sweep * Math.PI / 180))); 
  const dist = Math.min(200, wallDist + Math.random() * 5); // cap at 200cm, add noise

  // Physics: Turn based on differential tank steering
  if (drive) {
    const turnSpeed = (drive.R - drive.L) * 0.05; 
    simYaw = (simYaw + turnSpeed + 360) % 360;
  }

  const s = config.sensors || {};
  return {
    temperature:   s.temperature !== false ? +(28 + Math.sin(t / 5000) * 3).toFixed(1) : null,
    humidity:      s.humidity !== false    ? +(61 + Math.sin(t / 7000) * 5).toFixed(0) : null,
    tvoc:          s.tvoc !== false        ? +(110 + Math.sin(t / 3000) * 25).toFixed(0) : null,
    thermalTemp:   s.thermalTemp !== false ? +(32 + Math.abs(Math.sin(t / 4000)) * 6).toFixed(1) : null,
    distanceFront: s.distanceFront !== false ? +(38 + Math.abs(Math.sin(t / 2000)) * 30).toFixed(0) : null,
    batteryVoltage:s.battery !== false     ? +(7.6 - (t % 300000) / 3000000).toFixed(2) : null,
    batteryPct:    s.battery !== false     ? 78 : null,
    imuRoll:       s.imu !== false         ? 0 : null,
    imuPitch:      s.imu !== false         ? 0 : null,
    imuYaw:        s.imu !== false         ? +simYaw.toFixed(1) : null,
    lux:           s.lux !== false         ? +(320 + Math.sin(t / 8000) * 100).toFixed(0) : null,
    sweepAngle:    s.radar !== false       ? +sweep.toFixed(1) : null,
    sweepDistance: s.radar !== false       ? +dist.toFixed(0) : null,
  };
};

const defaultSensors = () => ({
  temperature: null, humidity: null, tvoc: null, thermalTemp: null,
  distanceFront: null, batteryVoltage: null, batteryPct: null,
  imuRoll: null, imuPitch: null, imuYaw: null, lux: null,
});

// ─── HELPERS ──────────────────────────────────────────────────────────────
const CONN = { OFF: "off", WAIT: "wait", ON: "on" };

const fmt = (v, digits = 1) => v !== null ? +v : null;

function SCard({ label, value, unit, alert, hist, onClick, active }) {
  const missing = value === null;
  
  // Calculate SVG polyline string if history exists
  let polyline = "";
  if (hist && hist.length > 1) {
    // Filter out nulls
    const valid = hist.filter(v => v != null);
    if (valid.length > 1) {
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const range = max - min || 1;
      const W = 100;
      const H = 40;
      polyline = valid.map((v, i) => `${(i / (valid.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
    }
  }

  return (
    <div 
      className={`sc ${missing ? "sc--off" : ""} ${alert ? "sc--alert" : ""} ${active ? "sc--active" : ""}`} 
      style={{ position: "relative", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      <span className="sc-label">{label}</span>
      <span className="sc-val" style={{ zIndex: 1, position: "relative" }}>
        {missing
          ? <span className="sc-na">—</span>
          : <>{value}<span className="sc-unit"> {unit}</span></>}
      </span>
      {polyline && (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "40%", opacity: alert ? 0.2 : 0.4, pointerEvents: "none" }}>
          <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

function InteractiveChart({ data, label, unit }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data || data.length === 0) return <div className="chart-empty" style={{padding:20, color:"var(--dim)"}}>No data</div>;

  const valid = data.filter(d => d != null);
  if (valid.length < 2) return <div className="chart-empty" style={{padding:20, color:"var(--dim)"}}>Gathering data...</div>;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  
  const padX = 40;
  const padY = 30;
  const w = 800;
  const h = 250;
  
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  // Intelligent downsampling: We only have 800px of width, rendering >800 points is overlapping sub-pixels.
  // This keeps the SVG string construction incredibly fast even if there are 100,000 points in memory.
  const maxPoints = 800;
  const step = Math.ceil(valid.length / maxPoints);
  
  const pts = [];
  for (let i = 0; i < valid.length; i += step) {
    const v = valid[i];
    const x = padX + (i / (valid.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / range) * innerH;
    pts.push({ x, y, v, origIdx: i });
  }
  // Force include the very last tick so the graph perfectly touches the right edge
  if (step > 1 && valid.length > 0 && pts[pts.length - 1].origIdx !== valid.length - 1) {
    const i = valid.length - 1;
    const v = valid[i];
    pts.push({
      x: padX + innerW,
      y: padY + innerH - ((v - min) / range) * innerH,
      v,
      origIdx: i
    });
  }

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const svgX = (mx / rect.width) * w;
    let closest = 0;
    let minDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < minDist) { minDist = d; closest = i; }
    });
    setHoverIdx(closest);
  };

  const formatTime = (secs) => {
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s}s`;
  };

  const totalTime = formatTime(pts.length * 0.1);

  return (
    <div style={{ position: "relative", width: "100%", height: 250, background: "var(--panel-bg)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }} onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        {/* Grid lines */}
        <line x1={padX} y1={padY} x2={w-padX} y2={padY} stroke="var(--border)" strokeDasharray="4 4" />
        <line x1={padX} y1={padY + innerH/2} x2={w-padX} y2={padY + innerH/2} stroke="var(--border)" strokeDasharray="4 4" />
        <line x1={padX} y1={padY + innerH} x2={w-padX} y2={padY + innerH} stroke="var(--border)" />

        {/* Y Axis Labels */}
        <text x={padX - 8} y={padY + 4} fill="var(--dim)" fontSize="10" textAnchor="end">{max.toFixed(1)}</text>
        <text x={padX - 8} y={padY + innerH/2 + 4} fill="var(--dim)" fontSize="10" textAnchor="end">{((max+min)/2).toFixed(1)}</text>
        <text x={padX - 8} y={padY + innerH + 4} fill="var(--dim)" fontSize="10" textAnchor="end">{min.toFixed(1)}</text>

        {/* Data Line */}
        <polyline points={polyline} fill="none" stroke="var(--acc)" strokeWidth="2" />
        
        {/* Hover elements */}
        {hoverIdx !== null && pts[hoverIdx] && (
          <g>
            <line x1={pts[hoverIdx].x} y1={padY} x2={pts[hoverIdx].x} y2={padY + innerH} stroke="var(--dim)" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx={pts[hoverIdx].x} cy={pts[hoverIdx].y} r="4" fill="var(--acc)" stroke="var(--panel-bg)" strokeWidth="2" />
          </g>
        )}
      </svg>
      
      {/* HTML Tooltip */}
      {hoverIdx !== null && pts[hoverIdx] && (
        <div style={{
          position: "absolute",
          left: `calc(${(pts[hoverIdx].x / w) * 100}% + 15px)`,
          top: `calc(${(pts[hoverIdx].y / h) * 100}% - 25px)`,
          background: "var(--bg)", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 4,
          color: "var(--fg)", fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
        }}>
          <b>{pts[hoverIdx].v}</b> <span style={{color: "var(--dim)"}}>{unit}</span>
          <br/>
          <span style={{fontSize: 10, color: "var(--dim)"}}>t - {formatTime((valid.length - 1 - pts[hoverIdx].origIdx) * 0.1)}</span>
        </div>
      )}
      
      {/* Title */}
      <div style={{ position: "absolute", top: 10, left: padX, color: "var(--fg)", fontSize: 13, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>
        {label} <span style={{fontSize: 10, color: "var(--dim)", fontWeight: "normal"}}>(LAST {totalTime.toUpperCase()})</span>
        <div style={{fontSize: 10, color: "var(--acc)", fontWeight: "normal", marginTop: 4, textTransform: "none", letterSpacing: 0}}>
          ↑ Click any sensor card below to graph it
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function App() {
  // Navigation
  const [tab, setTab] = useState("dashboard");

  // Connection
  const [connState, setConnState] = useState(CONN.OFF);
  const [inputIp, setInputIp] = useState("terra-brain.local");
  const [connectedIp, setConnectedIp] = useState("");

  // Data
  const [sensors, setSensors] = useState(defaultSensors());
  const sensorsRef = useRef(defaultSensors());
  const [simMode, setSimMode] = useState(false);
  const [simConfig, setSimConfig] = useState({ autoDrive: false, sensors: {} });
  const [history, setHistory] = useState({}); // { key: number[] } for sparklines
  const [selectedSensor, setSelectedSensor] = useState({ key: "temperature", label: "Temp", unit: "°C" });
  const [mapTheme, setMapTheme] = useState("basic");

  // Alerts
  const [alerts, setAlerts] = useState([]);

  // Mission Recording
  const [recording, setRecording] = useState(false);
  const [missionLog, setMissionLog] = useState([]);
  const [savedMissions, setSavedMissions] = useState([]);

  // Camera
  const [camMode, setCamMode] = useState("ip"); // Default to IP Cam instead of Local
  const [camUrl, setCamUrl] = useState("http://terra-cam.local:81/stream");
  const [camError, setCamError] = useState(null);
  const [ledOn, setLedOn] = useState(false);
  const [camPan, setCamPan] = useState(90); // Servo angle 0-180 (90 is center)
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  // ML
  const [model, setModel] = useState(null);
  const [mlStatus, setMlStatus] = useState("load");
  const [isDetecting, setIsDetecting] = useState(false);

  // Controls
  const [speed, setSpeed] = useState(50);

  // Logs
  const [logs, setLogs] = useState([]);

  // Map path (from IMU yaw+distance)
  const [mapPath, setMapPath] = useState([{ x: 150, y: 160 }]); // start center-bottom of 300x200 viewBox

  // Radar (2D polar obstacle map from ultrasonic sweep)
  const [radarReadings, setRadarReadings] = useState([]); // [{ angle, distance }]
  const [radarRange, setRadarRange] = useState(200);      // zoom range for radar (cm)

  // 3D Map
  const [path3D, setPath3D] = useState([[0, 0, 0]]);      // [x, y, z] in metres
  const [obstacles3D, setObstacles3D] = useState([]);     // [x, y, z] world coords


  // Refs
  const driveRef = useRef({ L: 0, R: 0 }); // To allow simulation physics and dead reckoning without stale closures
  const wsRef = useRef(null);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const logsEndRef = useRef(null);
  const speedRef = useRef(speed);
  const lastWarnRef = useRef(0);
  const path3DRef = useRef([[0, 0, 0]]); // always-current path3D for obstacle projection
  speedRef.current = speed;
  path3DRef.current = path3D; // keep in sync every render


  // ── Log ───────────────────────────────────────────────────────────────
  const addLog = useCallback((msg, type = "info") => {
    const t = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setLogs(p => [...p.slice(-100), { t, msg, type }]);
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ── Process incoming sensor data ──────────────────────────────────────
  const processSensorData = useCallback((d) => {
    setSensors(prev => {
      const next = { ...prev, ...d };
      sensorsRef.current = next;
      return next;
    });

    // Update sparkline history
    setHistory(prev => {
      const next = { ...prev };
      Object.keys(d).forEach(k => {
        if (typeof d[k] === 'number') {
          next[k] = [...(prev[k] || []).slice(-10000), +d[k]]; // Match 3D map history length
        }
      });
      return next;
    });

    // Update map path from IMU yaw — uses 300x200 viewBox space
    if (d.imuYaw != null) {
      const rad = (d.imuYaw * Math.PI) / 180;
      setMapPath(prev => {
        const last = prev[prev.length - 1];
        const step = 3; // pixels per tick
        const nx = Math.max(5, Math.min(295, last.x + Math.sin(rad) * step));
        const ny = Math.max(5, Math.min(195, last.y - Math.cos(rad) * step));
        if (Math.hypot(nx - last.x, ny - last.y) > 1) {
          return [...prev.slice(-10000), { x: nx, y: ny }];
        }
        return prev;
      });
    }

    // Update 3D path from IMU yaw+pitch+roll (Y = integrated pitch-based height)
    if (d.imuYaw != null) {
      const yaw   = (d.imuYaw * Math.PI) / 180;
      const pitch = ((d.imuPitch || 0) * Math.PI) / 180;
      const roll  = d.imuRoll || 0; // degrees — stored for terrain deformation
      
      const pL = driveRef.current.L;
      const pR = driveRef.current.R;
      
      setPath3D(prev => {
        if (pL === 0 && pR === 0) return prev; // Don't move if not driving
        
        // Simple unicycle physics: 
        // Forward speed is average of left and right wheels
        const speedFactor = (pL + pR) / 200; // -1 to 1
        const step = speedFactor * 0.15; // max 0.15m per tick
        
        const last = prev[prev.length - 1];
        const nx = last[0] - Math.sin(yaw) * step * Math.cos(pitch); // -X is Left
        const ny = last[1] + Math.sin(pitch) * step;
        const nz = last[2] - Math.cos(yaw) * step * Math.cos(pitch); // -Z is Forward

        if (Math.hypot(nx - last[0], nz - last[2]) > 0.02) {
          // Store [x, y, z, roll] so Map3D can deform terrain ribbon
          return [...prev.slice(-10000), [nx, Math.max(0, ny), nz, roll]];
        }
        return prev;
      });
    }

    // Update radar readings from ultrasonic sweep
    if (d.sweepAngle != null && d.sweepDistance != null && d.sweepDistance < 200) {
      setRadarReadings(prev => {
        const next = [...prev, { angle: d.sweepAngle, distance: d.sweepDistance }];
        return next.slice(-180);
      });

      // Project obstacle into 3D world space — read from ref to avoid stale closure
      if (d.imuYaw != null) {
        const curr3D  = path3DRef.current;
        const roverPos = curr3D[curr3D.length - 1] || [0, 0, 0];
        const roverY   = roverPos[1] || 0;
        const worldYaw = (d.imuYaw * Math.PI) / 180;
        const sweepRad = ((d.sweepAngle - 90) * Math.PI) / 180;
        const dist = d.sweepDistance / 100; // cm → metres
        const ox = roverPos[0] - Math.sin(worldYaw + sweepRad) * dist;
        const oz = roverPos[2] - Math.cos(worldYaw + sweepRad) * dist;
        setObstacles3D(prev => [...prev.slice(-10000), [ox, roverY, oz]]);
      }
    }


    // Alerts
    const newAlerts = [];
    if (d.distanceFront != null && d.distanceFront < 20) newAlerts.push("⚠ Obstacle < 20 cm!");
    if (d.batteryVoltage != null && d.batteryVoltage < 6.5) newAlerts.push("🔋 Battery critical!");
    if (d.gas != null && d.gas > 200) newAlerts.push("💨 Gas level high!");
    if (d.imuRoll != null && Math.abs(d.imuRoll) > 35) newAlerts.push("⚡ Rover tilting!");
    setAlerts(newAlerts);

    // Recording
    if (recording) {
      const ts = Date.now();
      setMissionLog(prev => [...prev, { ts, ...d }]);
    }
  }, [recording]);

  const simConfigRef = useRef(simConfig);
  simConfigRef.current = simConfig;

  // ── Simulation mode ───────────────────────────────────────────────────
  useEffect(() => {
    if (!simMode) return;
    addLog("[SIM] Simulation mode active — fake ESP32 data", "sim");
    setConnState(CONN.ON);
    setConnectedIp("SIMULATION");

    const iv = setInterval(() => {
      const t = Date.now();
      if (simConfigRef.current.autoDrive) {
        const wave = Math.sin(t / 3000); // graceful sweeping turns
        let L = 50 + wave * 30;
        let R = 50 - wave * 30;
        if (sensorsRef.current.distanceFront !== null && sensorsRef.current.distanceFront < 20) {
          L = 0; R = 0;
        }
        driveRef.current = { L, R };
        simConfigRef.current._wasAuto = true;
      } else if (simConfigRef.current._wasAuto) {
        driveRef.current = { L: 0, R: 0 };
        simConfigRef.current._wasAuto = false;
      }
      processSensorData(simTick(t, driveRef.current, simConfigRef.current));
    }, 100);

    return () => {
      clearInterval(iv);
      if (!wsRef.current) { setConnState(CONN.OFF); setConnectedIp(""); setSensors(defaultSensors()); }
      setCamMode("ip"); // Force back to IP cam when sim stops
      addLog("[SIM] Simulation stopped", "sim");
    };
  }, [simMode, processSensorData, addLog]);

  // ── WebSocket ─────────────────────────────────────────────────────────
  const connectWs = useCallback((ip) => {
    if (simMode) return;
    if (wsRef.current) wsRef.current.close();
    setConnState(CONN.WAIT);
    addLog(`Connecting to ws://${ip}/ws`);

    const ws = new WebSocket(`ws://${ip}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnState(CONN.ON); setConnectedIp(ip);
      addLog(`Connected to ESP32 at ${ip}`, "ok");
    };
    ws.onmessage = (e) => {
      try { processSensorData(JSON.parse(e.data)); } catch (_) {}
    };
    ws.onclose = () => {
      setConnState(CONN.OFF); setSensors(defaultSensors());
      addLog("Disconnected from ESP32", "warn");
    };
    ws.onerror = () => {
      setConnState(CONN.OFF);
      addLog("Connection error — check IP / mDNS", "err");
    };
  }, [simMode, addLog, processSensorData]);

  const disconnectWs = () => {
    wsRef.current?.close(); wsRef.current = null;
    setConnState(CONN.OFF); setSensors(defaultSensors()); setConnectedIp("");
  };

  // ── Reset ─────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setHistory({});
    setPath3D([[0, 0, 0]]);
    setMapPath([{ x: 150, y: 100 }]);
    setObstacles3D([]);
    setAlerts([]);
    setSensors(defaultSensors());
    addLog("Dashboard data reset", "info");
  }, [addLog]);

  // ── Send command ──────────────────────────────────────────────────────
  const sendCmd = useCallback((cmd) => {
    // Collision Override for Keyboard
    if (sensorsRef.current.distanceFront !== null && sensorsRef.current.distanceFront < 20) {
      if (cmd === "F" || cmd === "L" || cmd === "R") {
        addLog("⚠ Collision override: Forward blocked", "warn");
        return;
      }
    }

    if (simMode) { addLog(`[SIM] → ${cmd}`, "sim"); return; }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd, speed: speedRef.current }));
      addLog(`→ ${cmd}`);
    } else {
      const now = Date.now();
      if (now - lastWarnRef.current > 3000) {
        addLog("⚠ Not connected to rover", "warn");
        lastWarnRef.current = now;
      }
    }
  }, [simMode, addLog]);

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = { w: "F", a: "L", s: "B", d: "R", " ": "STOP",
                  W: "F", A: "L", S: "B", D: "R" };
    const down = (e) => {
      if (map[e.key]) { if (e.key === " ") e.preventDefault(); sendCmd(map[e.key]); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [sendCmd]);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const vids = devices.filter(d => d.kind === "videoinput");
        setVideoDevices(vids);
        if (vids.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(vids[0].deviceId);
        }
      });
    }
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Attempt to force mobile devices into landscape mode
    if (window.screen?.orientation?.lock) {
      window.screen.orientation.lock("landscape").catch(() => {});
    }
    
    setCamError(null);
    if (camMode !== "local") {
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError("Camera API not available.\nIf opening from another device, you must use HTTPS or localhost.");
      return;
    }
    
    const constraints = selectedDeviceId 
      ? { video: { deviceId: { exact: selectedDeviceId }, width: 640, height: 480 } }
      : { video: { width: 640, height: 480 } };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch((err) => setCamError(
        "Camera blocked.\n" + err.message + "\n\nWindows: Settings → Privacy → Camera → Enable for desktop apps."
      ));
  }, [camMode, selectedDeviceId]);

  // ── ML ────────────────────────────────────────────────────────────────
  const toggleML = async () => {
    if (isDetecting) {
      setIsDetecting(false);
      cancelAnimationFrame(rafRef.current);
      canvasRef.current?.getContext("2d")?.clearRect(0, 0, 9999, 9999);
      setMlStatus("ready");
      return;
    }
    if (!model) {
      setMlStatus("loading");
      try {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
        const m = await ort.InferenceSession.create('/yolov8n.onnx', { executionProviders: ['webgpu', 'wasm'] });
        setModel(m); setMlStatus("ready");
        addLog("ML model loaded (YOLOv8n ONNX WebGPU)", "ok");
        startDetect(m);
      } catch (err) { 
        console.error(err);
        setMlStatus("error"); 
        addLog("ML failed — Check ONNX file or WebGPU support", "err"); 
      }
    } else { startDetect(model); }
  };

  const startDetect = (m) => {
    setIsDetecting(true);
    
    // Setup offscreen canvas once
    const TARGET_SIZE = 640;
    const offscreen = document.createElement("canvas");
    offscreen.width = TARGET_SIZE; offscreen.height = TARGET_SIZE;
    const offctx = offscreen.getContext("2d", { willReadFrequently: true });
    
    let isProcessing = false;

    const loop = async () => {
      rafRef.current = requestAnimationFrame(loop);
      
      if (!canvasRef.current || isProcessing) return;
      const src = camMode === "local" ? videoRef.current : imgRef.current;
      if (!src) return;
      
      const ready = camMode === "local" ? src.readyState === 4 : src.naturalWidth > 0;
      if (!ready) return;

      isProcessing = true;
      try {
        const w = camMode === "local" ? src.videoWidth : src.width;
        const h = camMode === "local" ? src.videoHeight : src.height;
        if (!w || !h) { isProcessing = false; return; }

        // 1. Preprocess: draw and extract Float32 RGB planar data
        offctx.drawImage(src, 0, 0, TARGET_SIZE, TARGET_SIZE);
        const imgData = offctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE).data;
        
        const floatArr = new Float32Array(1 * 3 * TARGET_SIZE * TARGET_SIZE);
        const area = TARGET_SIZE * TARGET_SIZE;
        for (let i = 0; i < area; i++) {
          floatArr[i]            = imgData[i * 4] / 255.0;     // R
          floatArr[area + i]     = imgData[i * 4 + 1] / 255.0; // G
          floatArr[area * 2 + i] = imgData[i * 4 + 2] / 255.0; // B
        }
        
        // 2. Run inference
        const tensor = new ort.Tensor('float32', floatArr, [1, 3, TARGET_SIZE, TARGET_SIZE]);
        const results = await m.run({ images: tensor });
        const output = results.output0.data; // [1, 84, 8400]

        // 3. Postprocess: parse bounding boxes & NMS
        const numClasses = 80;
        const numAnchors = 8400;
        let boxes = [];
        
        for (let c = 0; c < numAnchors; c++) {
          let maxScore = 0;
          let maxClass = -1;
          for (let cls = 0; cls < numClasses; cls++) {
            const score = output[(4 + cls) * numAnchors + c];
            if (score > maxScore) { maxScore = score; maxClass = cls; }
          }
          if (maxScore > 0.45) {
            const cx = output[0 * numAnchors + c];
            const cy = output[1 * numAnchors + c];
            const bw = output[2 * numAnchors + c];
            const bh = output[3 * numAnchors + c];
            boxes.push({ class: yoloClasses[maxClass], score: maxScore, bbox: [cx - bw/2, cy - bh/2, bw, bh] });
          }
        }
        
        // NMS
        boxes.sort((a, b) => b.score - a.score);
        const selected = [];
        for (const b of boxes) {
          let overlap = false;
          for (const s of selected) {
            const ix = Math.max(b.bbox[0], s.bbox[0]);
            const iy = Math.max(b.bbox[1], s.bbox[1]);
            const iw = Math.min(b.bbox[0]+b.bbox[2], s.bbox[0]+s.bbox[2]) - ix;
            const ih = Math.min(b.bbox[1]+b.bbox[3], s.bbox[1]+s.bbox[3]) - iy;
            if (iw > 0 && ih > 0) {
              const inter = iw * ih;
              const iou = inter / (b.bbox[2]*b.bbox[3] + s.bbox[2]*s.bbox[3] - inter);
              if (iou > 0.45) { overlap = true; break; }
            }
          }
          if (!overlap) selected.push(b);
        }

        // 4. Render
        const ctx = canvasRef.current.getContext("2d");
        ctx.canvas.width = w; ctx.canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.font = "bold 13px monospace";
        
        const scaleX = w / TARGET_SIZE;
        const scaleY = h / TARGET_SIZE;
        
        selected.forEach(p => {
          const rx = p.bbox[0] * scaleX;
          const ry = p.bbox[1] * scaleY;
          const rw = p.bbox[2] * scaleX;
          const rh = p.bbox[3] * scaleY;
          const lbl = `${p.class} ${Math.round(p.score * 100)}%`;
          
          ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh);
          const tw = ctx.measureText(lbl).width + 8;
          ctx.fillStyle = "rgba(0,255,136,0.85)"; ctx.fillRect(rx, ry - 20, tw, 18);
          ctx.fillStyle = "#000"; ctx.fillText(lbl, rx + 4, ry - 6);
        });
      } catch (_) {}
      isProcessing = false;
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  // ── Mission recording ─────────────────────────────────────────────────
  const startRecording = () => {
    setMissionLog([]); setRecording(true);
    addLog("⏺ Mission recording started", "ok");
  };

  // ── Hardware Controls ─────────────────────────────────────────────────
  const lastDriveTime = useRef(0);
  const [drivePower, setDrivePower] = useState({ L: 0, R: 0 });

  const handleAnalogDrive = useCallback((joystick) => {
    if (joystick.x === 0 && joystick.y === 0) {
      sendCmd("STOP"); // Guaranteed to fire on release
      setDrivePower({ L: 0, R: 0 });
      driveRef.current = { L: 0, R: 0 };
      return;
    }
    
    // Throttle to 20Hz (50ms) to prevent flooding the ESP32 buffer
    const now = Date.now();
    if (now - lastDriveTime.current < 50) return;
    lastDriveTime.current = now;

    // Arcade Drive Mixing Algorithm
    const v = -joystick.y; // Y is inverted in browser (negative is UP)
    const w = joystick.x;  // X positive is RIGHT
    
    let left = v + w;
    let right = v - w;
    
    // Normalize so we never exceed 1.0 ratio
    const maxMag = Math.max(Math.abs(left), Math.abs(right));
    if (maxMag > 1.0) {
      left /= maxMag;
      right /= maxMag;
    }

    // Apply global speed slider multiplier
    let L = Math.round(left * speed);
    let R = Math.round(right * speed);

    // Collision Override (Prevent moving FORWARD if distance < 20cm)
    if (sensorsRef.current.distanceFront !== null && sensorsRef.current.distanceFront < 20) {
      if (L > 0) L = 0;
      if (R > 0) R = 0;
    }
    
    setDrivePower({ L, R });
    driveRef.current = { L, R };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd: "DRIVE", L, R }));
    }
  }, [speed]);

  const toggleLed = () => {
    const newState = !ledOn;
    setLedOn(newState);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd: "LED", state: newState ? 1 : 0 }));
    }
    addLog(`💡 Headlight turned ${newState ? 'ON' : 'OFF'}`, 'ok');
  };

  const handleCamPan = (val) => {
    setCamPan(val);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cmd: "CAM_PAN", angle: val }));
    }
  };

  const stopRecording = () => {
    setRecording(false);
    const name = `Mission_${new Date().toISOString().slice(0,16).replace("T","_")}`;
    const blob = new Blob([JSON.stringify({ name, data: missionLog }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.json`; a.click();
    URL.revokeObjectURL(url);
    setSavedMissions(p => [...p, { name, count: missionLog.length }]);
    addLog(`⏹ Recording saved: ${name} (${missionLog.length} samples)`, "ok");
  };

  // ── Camera panel (shared between dashboard + camera tab) ──────────────
  const renderCameraPanel = (full) => (
    <div className={`panel cam-panel ${full ? "cam-panel--full" : ""}`}>
      <div className="panel-hdr">
        <span>LIVE CAMERA {simMode && <span className="sim-tag">SIM</span>}</span>
        <div className="hdr-actions">
          <button className={`btn-sm ${ledOn ? "btn-sm--on" : ""}`} onClick={toggleLed}>
            💡 LED
          </button>
          {simMode && (
            <>
              <button className={`btn-sm ${camMode === "local" ? "btn-sm--on" : ""}`} onClick={() => setCamMode("local")}>Device Cam</button>
              {camMode === "local" && videoDevices.length > 1 && (
                <select 
                  className="input-sm" 
                  style={{ maxWidth: 100 }}
                  value={selectedDeviceId} 
                  onChange={e => setSelectedDeviceId(e.target.value)}
                >
                  {videoDevices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <button className={`btn-sm ${camMode === "ip" ? "btn-sm--on" : ""}`} onClick={() => setCamMode("ip")}>IP Cam</button>
          <button className={`btn-sm ${isDetecting ? "btn-sm--red" : ""}`} onClick={toggleML}>
            ML: {mlStatus === "loading" ? "Loading..." : mlStatus === "error" ? "Error" : isDetecting ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      {camMode === "ip" && (
        <CamUrlInput url={camUrl} onChange={setCamUrl} />
      )}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "var(--dim)", width: 40 }}>PAN</span>
        <input 
          type="range" min="0" max="180" 
          value={camPan} 
          onChange={(e) => handleCamPan(+e.target.value)} 
          style={{ flex: 1, accentColor: "var(--acc)" }} 
        />
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--acc)", width: 30, textAlign: "right" }}>{camPan}°</span>
      </div>
      <div className="vid-box">
        <video ref={videoRef} autoPlay playsInline muted style={{ display: camMode === "local" ? "block" : "none" }} />
        {camMode === "ip" && <img ref={imgRef} src={camUrl} alt="IP Cam" crossOrigin="anonymous" />}
        <canvas ref={canvasRef} className="ml-canvas" />
        {camError && <div className="cam-err"><pre>{camError}</pre></div>}
      </div>
    </div>
  );

  const isOn = connState === CONN.ON;

  return (
    <div className="app">

      {/* ══ TOPBAR ═══════════════════════════════════════════════════════ */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">TERRA-X</span>
          <span className="brand-sub">Rover Dashboard</span>
        </div>

        <div className="conn-bar">
          <span className={`cdot cdot--${connState}`} />
          {!isOn ? (
            <>
              <input
                className="input-sm"
                value={inputIp}
                onChange={e => setInputIp(e.target.value)}
                placeholder="terra-brain.local"
                onKeyDown={e => e.key === "Enter" && !simMode && connectWs(inputIp)}
                style={{ width: 180 }}
              />
              <button className="btn-primary" onClick={() => connectWs(inputIp)} disabled={connState === CONN.WAIT || simMode}>
                {connState === CONN.WAIT ? "Connecting..." : "Connect"}
              </button>
            </>
          ) : (
            <>
              <span className="conn-ip">{connectedIp}</span>
              {!simMode && <button className="btn-ghost" onClick={disconnectWs}>Disconnect</button>}
            </>
          )}

          {/* SIM MODE TOGGLE */}
          <button
            className={`btn-sim ${simMode ? "btn-sim--on" : ""}`}
            onClick={() => { if (simMode) { setSimMode(false); } else { disconnectWs(); setSimMode(true); } }}
          >
            {simMode ? "⏹ Stop Sim" : "▶ Simulate"}
          </button>
        </div>

        <div className="topbar-right">
          {/* Recording */}
          {!recording
            ? <button className="btn-rec" onClick={startRecording} disabled={!isOn && !simMode}>⏺ Record</button>
            : <button className="btn-rec btn-rec--on" onClick={stopRecording}>⏹ Stop · Save</button>
          }
          <button className="btn-estop" onPointerDown={() => sendCmd("ESTOP")}>⛔ STOP</button>
        </div>
      </header>

      {/* ══ ALERTS ═══════════════════════════════════════════════════════ */}
      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((a, i) => <span key={i} className="alert-pill">{a}</span>)}
        </div>
      )}

      {/* ══ TABS ═════════════════════════════════════════════════════════ */}
      <nav className="tabbar">
        {[["dashboard","Dashboard"],["camera","Camera"],["sensors","Sensors"],["map","Map"],["missions","Missions"],["settings","Settings"]].map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? "tab--on" : ""}`} onClick={() => setTab(id)}>
            {label}{id === "missions" && savedMissions.length > 0 && <span className="badge">{savedMissions.length}</span>}
          </button>
        ))}
        <span className={`conn-pill conn-pill--${connState}`}>
          {simMode ? "● SIMULATION" : isOn ? `● ${connectedIp}` : "○ Not Connected"}
        </span>
      </nav>

      {/* ══ CONTENT ══════════════════════════════════════════════════════ */}
      <div className="content">

        {/* ── DASHBOARD ─────────────────────────────────────────────── */}
        {tab === "dashboard" && <>
          <div className="dash-grid">

            {/* Camera */}
            {renderCameraPanel(false)}

            {/* Sensors */}
            <div className="panel sensor-panel">
              <div className="panel-hdr">
                SENSORS
                <span className={`live-dot ${isOn ? "live-dot--on" : ""}`}>{isOn ? "● LIVE" : "○ —"}</span>
              </div>
              <div className="sensor-grid">
                <SCard label="Temp"           value={sensors.temperature}   unit="°C"  alert={sensors.temperature > 50} hist={history.temperature} />
                <SCard label="Humidity"       value={sensors.humidity}      unit="%" hist={history.humidity} />
                <SCard label="Front Radar"    value={sensors.distanceFront} unit="cm"  alert={sensors.distanceFront < 20} hist={history.distanceFront} />
                <SCard label="Battery"        value={sensors.batteryVoltage !== null ? `${sensors.batteryVoltage}V` : null} unit={sensors.batteryPct ? `${sensors.batteryPct}%` : ""} alert={sensors.batteryVoltage < 6.5} hist={history.batteryVoltage} />
                
                {/* Active Payload Data */}
                <SCard label="Thermal"        value={sensors.thermalTemp}   unit="°C"  alert={sensors.thermalTemp > 36} hist={history.thermalTemp} />
                <SCard label="Gas"            value={sensors.tvoc}          unit="ppb" alert={sensors.tvoc > 400} hist={history.tvoc} />
                <SCard label="Light"          value={sensors.lux}           unit="lux" hist={history.lux} />
                
                {/* Position from IMU dead-reckoning */}
                <SCard label="X"     value={path3D.length > 0 ? +path3D[path3D.length-1][0].toFixed(2) : null} unit="m" />
                <SCard label="Z"     value={path3D.length > 0 ? +path3D[path3D.length-1][2].toFixed(2) : null} unit="m" />
                <SCard label="Y"    value={path3D.length > 0 ? +path3D[path3D.length-1][1].toFixed(2) : null} unit="m" />
                <SCard label="Dist"    value={path3D.length > 0 ? +(Math.hypot(path3D[path3D.length-1][0], path3D[path3D.length-1][2])).toFixed(2) : null} unit="m" />
              </div>
            </div>

            <div className="panel mini-map-panel">
              <div className="panel-hdr">
                <span>3D MAP <span style={{fontSize:9,color:"var(--dim)"}}>IMU path</span></span>
                <button className="map-clear" onClick={() => { setPath3D([[0,0,0]]); setObstacles3D([]); }}>Reset</button>
              </div>
              <div className="mini-map-box" style={{ padding: 0 }}>
                {!isOn
                  ? <p className="map-empty">Connect to build map.</p>
                  : <Map3D path3D={path3D} obstacles3D={obstacles3D} roverYaw={sensors.imuYaw || 0} />
                }
              </div>
            </div>


          </div>

          {/* ── BOTTOM BAR — Control + Logs ─────────────────────────── */}
          <div className="bottom-bar">

            {/* D-PAD */}
            <div className="panel ctrl-panel">
              <div className="panel-hdr">CONTROL <span className="ctrl-hint">WASD / Space</span></div>
              <div className="ctrl-body">
                <div className="speed-col">
                  <span>Speed</span>
                  <input type="range" min="0" max="100" value={speed} onChange={e => setSpeed(+e.target.value)} />
                  <span className="speed-val">{speed}%</span>
                </div>
                <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <VirtualJoystick onDirectionChange={handleAnalogDrive} size={window.innerHeight < 600 ? 100 : 160} />
                  <div style={{ display: "flex", gap: 20, fontSize: 12, fontFamily: "monospace", color: "var(--muted)" }}>
                    <span>L: <span style={{ color: drivePower.L !== 0 ? "var(--acc)" : "" }}>{drivePower.L}%</span></span>
                    <span>R: <span style={{ color: drivePower.R !== 0 ? "var(--acc)" : "" }}>{drivePower.R}%</span></span>
                  </div>
                </div>
              </div>

            </div>

            {/* LOGS */}
            <div className="panel log-panel">
              <div className="panel-hdr">
                EVENT LOG
                <button className="btn-sm" onClick={() => setLogs([])}>Clear</button>
              </div>
              <div className="log-scroll">
                {logs.length === 0 && <span className="log-empty">No events. Connect or start simulation.</span>}
                {logs.map((l, i) => (
                  <div key={i} className={`log-line log-line--${l.type || "info"}`}>
                    <span className="log-t">[{l.t}]</span> {l.msg}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>
        </>}

        {/* ── CAMERA TAB ────────────────────────────────────────────── */}
        {tab === "camera" && renderCameraPanel(true)}

        {/* ── SENSORS TAB ───────────────────────────────────────────── */}
        {tab === "sensors" && (
          <div className="panel" style={{flex:1, display: "flex", flexDirection: "column", overflow: "hidden"}}>
            <div className="panel-hdr">
              ALL SENSORS
              <span className={`live-dot ${isOn ? "live-dot--on" : ""}`}>{isOn ? "● LIVE" : "○ Not connected"}</span>
            </div>
            
            {/* Master-Detail Layout */}
            <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Top Graph */}
              <div style={{ height: 250, flexShrink: 0 }}>
                <InteractiveChart 
                  data={history[selectedSensor.key]} 
                  label={selectedSensor.label} 
                  unit={selectedSensor.unit} 
                />
              </div>

              {/* Bottom Grid */}
              <div className="sensor-grid sensor-grid--lg">
                {[
                  ["Ambient Temp", "temperature", "°C", sensors.temperature > 50],
                  ["Humidity", "humidity", "%", false],
                  ["Radar Distance", "distanceFront", "cm", sensors.distanceFront < 20],
                  ["Battery Voltage", "batteryVoltage", "V", sensors.batteryVoltage < 6.5],
                  ["Battery %", "batteryPct", "%", false],
                  ["IMU Roll", "imuRoll", "°", Math.abs(sensors.imuRoll) > 35],
                  ["IMU Pitch", "imuPitch", "°", Math.abs(sensors.imuPitch) > 35],
                  ["IMU Yaw", "imuYaw", "°", false],
                  ["Thermal (IR)", "thermalTemp", "°C", sensors.thermalTemp > 36],
                  ["Gas (TVOC)", "tvoc", "ppb", sensors.tvoc > 400],
                  ["Light (lux)", "lux", "lux", false],
                ].map(([label, key, unit, alert]) => (
                  <SCard
                    key={key}
                    label={label}
                    value={sensors[key]}
                    unit={unit}
                    alert={alert}
                    hist={history[key]}
                    active={selectedSensor.key === key}
                    onClick={() => setSelectedSensor({ key, label, unit })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MAP TAB ───────────────────────────────────────────────── */}
        {tab === "map" && (
          <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="panel-hdr">
              3D ENVIRONMENT MAP
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <select 
                  className="input-sm" 
                  style={{ width: 100, background: "var(--bg)", color: "var(--fg)" }}
                  value={mapTheme}
                  onChange={e => setMapTheme(e.target.value)}
                >
                  <option value="basic">Basic Theme</option>
                  <option value="pipeline">Pipeline Theme</option>
                  <option value="cave">Cave Theme</option>
                </select>
                <span style={{ fontSize:10, color:"var(--muted)", borderLeft: "1px solid var(--border)", paddingLeft: 12 }}>IMU · Ultrasonic · Terrain</span>
                <button className="btn-sm" onClick={() => { setPath3D([[0,0,0]]); setObstacles3D([]); }}>Reset</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              {!isOn
                ? <p className="map-empty">Connect to ESP32 or start Simulation to build the 3D map.</p>
                : <Map3D
                    path3D={path3D}
                    obstacles3D={obstacles3D}
                    roverYaw={sensors.imuYaw || 0}
                    sweepAngle={sensors.sweepAngle}
                    sweepDistance={sensors.sweepDistance || 200}
                    theme={mapTheme}
                  />
              }
            </div>
          </div>
        )}

        {/* ── MISSIONS TAB ──────────────────────────────────────────── */}
        {tab === "missions" && (
          <div className="panel" style={{flex:1, overflow:"auto"}}>
            <div className="panel-hdr">
              SAVED MISSIONS
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {!recording
                  ? <button className="btn-sm" onClick={startRecording} disabled={!isOn && !simMode}>⏺ Start Recording</button>
                  : <button className="btn-sm btn-sm--red" onClick={stopRecording}>⏹ Stop & Save</button>
                }
              </div>
            </div>
            {savedMissions.length === 0
              ? <p style={{padding:20,color:"var(--dim)"}}>No saved missions yet. Start recording during a session.</p>
              : <div style={{padding:12,display:"flex",flexDirection:"column",gap:8}}>
                  {savedMissions.map((m, i) => (
                    <div key={i} className="mission-row">
                      <span className="mission-name">{m.name}</span>
                      <span className="mission-meta">{m.count} samples</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ── SETTINGS TAB ────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div className="panel" style={{flex:1, overflow:"auto"}}>
            <div className="panel-hdr">SYSTEM SETTINGS</div>
            <div style={{padding: 20, display: "flex", flexDirection: "column", gap: 24}}>
              
              <div style={{background: "var(--bg-card)", padding: 16, borderRadius: 6, border: "1px solid var(--border)"}}>
                <h3 style={{fontSize: 14, color: "var(--acc)", marginBottom: 12}}>📡 Rover WiFi Configuration</h3>
                <p style={{fontSize: 12, color: "var(--dim)", marginBottom: 16}}>
                  Save your home WiFi credentials directly to the rover's physical memory. The rover will reboot and attempt to connect to it. If it fails, it will fall back to its standalone Field Mode AP.
                </p>
                <div style={{display: "flex", gap: 12}}>
                  <input id="wifi-ssid" className="input-sm" placeholder="Home WiFi Name (SSID)" style={{flex: 1}} />
                  <input id="wifi-pass" type="password" className="input-sm" placeholder="Password" style={{flex: 1}} />
                  <button className="btn-sm" onClick={() => {
                    const ssid = document.getElementById("wifi-ssid").value;
                    const pass = document.getElementById("wifi-pass").value;
                    if (ssid) {
                      sendCmd({ cmd: "SET_WIFI", ssid, pass });
                      addLog(`Sent new WiFi credentials (${ssid}) to Rover. Expect reboot...`, "system");
                    }
                  }}>💾 Save & Reboot</button>
                </div>
              </div>

              <div style={{background: "var(--bg-card)", padding: 16, borderRadius: 6, border: "1px solid var(--border)"}}>
                <h3 style={{fontSize: 14, color: "var(--acc)", marginBottom: 12}}>⚙️ Power & Diagnostic</h3>
                <div style={{display: "flex", gap: 12}}>
                  <button className="btn-sm" onClick={() => sendCmd({ cmd: "RESTART" })}>🔄 Restart Rover Brain</button>
                  <button className="btn-sm" onClick={() => sendCmd({ cmd: "SET_MOCK", enabled: true })}>🧪 Enable Hardware Mock Data</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── SIMULATION SETTINGS OVERLAY ─────────────────────────────────── */}
      {simMode && (
        <div style={{
          position: "absolute", bottom: 20, right: 20, width: 280,
          background: "rgba(10, 15, 20, 0.95)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 100, backdropFilter: "blur(10px)"
        }}>
          <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--acc)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
            <span>⚙️ Simulation Config</span>
            <button className="btn-sm" onClick={resetAll} style={{ padding: "2px 8px", fontSize: 10 }}>Reset All</button>
          </div>
          
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12, cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={simConfig.autoDrive}
              onChange={e => setSimConfig(p => ({ ...p, autoDrive: e.target.checked }))}
            />
            Auto-Drive Mode
          </label>

          <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
            TOGGLE SENSORS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["temperature", "humidity", "tvoc", "thermalTemp", "distanceFront", "battery", "lux"].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={simConfig.sensors[s] !== false}
                  onChange={e => setSimConfig(p => ({
                    ...p, 
                    sensors: { ...p.sensors, [s]: e.target.checked }
                  }))}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
