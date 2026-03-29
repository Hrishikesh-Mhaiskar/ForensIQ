import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

const CAT_META = {
  VICTIM:      { icon: "◉", color: "#ff2d55", label: "Victim/Suspect" },
  BIOLOGICAL:  { icon: "⬡", color: "#ff3b30", label: "Biological" },
  ENTRY:       { icon: "▷", color: "#ff9f0a", label: "Entry/Exit" },
  WEAPON:      { icon: "◆", color: "#ff2d55", label: "Weapon" },
  DISTURBANCE: { icon: "△", color: "#30d158", label: "Disturbance" },
  DOCUMENT:    { icon: "▭", color: "#0a84ff", label: "Document" },
  CONTAINER:   { icon: "○", color: "#bf5af2", label: "Container" },
  PERSONAL:    { icon: "◇", color: "#ff9f0a", label: "Personal Effect" },
  TRACE:       { icon: "⬤", color: "#5ac8fa", label: "Trace Evidence" },
  DIGITAL:     { icon: "▣", color: "#64d2ff", label: "Digital Evidence" },
  SUBTLE:      { icon: "·", color: "#555",    label: "Other" },
};

const PRI = {
  HIGH: { color: "#ff2d55", bg: "rgba(255,45,85,0.15)",  border: "rgba(255,45,85,0.4)" },
  MED:  { color: "#ff9f0a", bg: "rgba(255,159,10,0.15)", border: "rgba(255,159,10,0.4)" },
  LOW:  { color: "#30d158", bg: "rgba(48,209,88,0.12)",  border: "rgba(48,209,88,0.3)" },
};

function normalise(d) {
  return {
    cat: d.category || "SUBTLE",
    pri: d.priority || "LOW",
    conf: d.conf ?? Math.round((d.confidence || 0) * 100),
    obj: d.prompt || d.object || "unknown",
    reason: d.reason || "",
  };
}

/* ── Scan overlay ── */
function ScanOverlay({ active }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", overflow: "hidden" }}>
      <style>{`
        @keyframes scanBeam{0%{top:-4px}100%{top:100vh}}
        .sb{position:absolute;left:0;right:0;height:3px;
          background:linear-gradient(90deg,transparent,#00ff88 40%,#00ffcc 50%,#00ff88 60%,transparent);
          box-shadow:0 0 18px 4px #00ff8880;animation:scanBeam 1.4s linear infinite}
        .sv{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,136,0.015) 3px,rgba(0,255,136,0.015) 4px)}
      `}</style>
      <div className="sv" /><div className="sb" />
    </div>
  );
}

/* ── Glitch title ── */
function GlitchText({ text, style = {} }) {
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <style>{`
        @keyframes g1{0%,94%{clip-path:inset(0 0 100% 0)}95%{clip-path:inset(30% 0 50% 0);transform:translate(-3px,0)}96%{clip-path:inset(60% 0 20% 0);transform:translate(2px,0)}97%,100%{clip-path:inset(0 0 100% 0)}}
        @keyframes g2{0%,96%{clip-path:inset(0 0 100% 0)}97%{clip-path:inset(50% 0 30% 0);transform:translate(3px,0)}98%{clip-path:inset(20% 0 60% 0);transform:translate(-2px,0)}99%,100%{clip-path:inset(0 0 100% 0)}}
      `}</style>
      {text}
      <span aria-hidden style={{ position:"absolute",left:0,top:0,color:"#ff2d55",animation:"g1 4s infinite" }}>{text}</span>
      <span aria-hidden style={{ position:"absolute",left:0,top:0,color:"#0a84ff",animation:"g2 4s infinite 0.5s" }}>{text}</span>
    </span>
  );
}

/* ── Evidence tape ── */
function EvidenceTape() {
  const text = "CRIME SCENE — DO NOT CROSS";
  return (
    <div style={{
      background: "#f5c900", color: "#1a1200", fontSize: 10,
      fontFamily: "'Courier New',monospace", fontWeight: 900, letterSpacing: 2,
      padding: "5px 0", overflow: "hidden", whiteSpace: "nowrap",
      transform: "rotate(-0.8deg)", margin: "0 -40px",
      boxShadow: "0 2px 12px rgba(245,201,0,0.2)",
    }}>
      {Array(10).fill(text).map((t, i) => <span key={i} style={{ marginRight: 20 }}>⬛ {t}</span>)}
    </div>
  );
}

/* ── Confidence bar ── */
function ConfBar({ val, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(val), 60); return () => clearTimeout(t); }, [val]);
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 2, width: `${w}%`,
        background: `linear-gradient(90deg,${color}88,${color})`,
        transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: `0 0 5px ${color}70`,
      }} />
    </div>
  );
}

/* ── Single evidence row ── */
function EvidenceRow({ item, idx }) {
  const cat = CAT_META[item.cat] || CAT_META.SUBTLE;
  const pri = PRI[item.pri] || PRI.LOW;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "18px 1fr auto",
      gap: 8, alignItems: "center",
      padding: "8px 12px", borderRadius: 6,
      borderLeft: `2px solid ${cat.color}45`,
      background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
    }}>
      <span style={{ fontSize: 11, color: cat.color, textAlign: "center" }}>{cat.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#e0e0e0", fontFamily: "'Courier New',monospace", textTransform: "capitalize" }}>{item.obj}</span>
          <span style={{ fontSize: 8, letterSpacing: 1, padding: "1px 5px", borderRadius: 3, background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}25` }}>{item.cat}</span>
        </div>
        <div style={{ fontSize: 9, color: "#555", marginTop: 1, fontStyle: "italic" }}>{item.reason}</div>
        <ConfBar val={item.conf} color={cat.color} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: 1.5, padding: "2px 7px", borderRadius: 4,
          background: pri.bg, color: pri.color, border: `1px solid ${pri.border}`,
          animation: item.pri === "HIGH" ? "hPulse 2s infinite" : "none",
          fontFamily: "monospace",
        }}>{item.pri}</span>
        <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>{item.conf}%</span>
      </div>
    </div>
  );
}

/* ── Stat pill ── */
function StatPill({ label, value, color }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 14px", background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, minWidth: 54 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Courier New',monospace", lineHeight: 1, boxShadow: value > 0 ? `0 0 16px ${color}40` : "none" }}>{value}</div>
      <div style={{ fontSize: 8, color: `${color}88`, letterSpacing: 2, marginTop: 3, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</div>
    </div>
  );
}

/* ── Threat bar ── */
function ThreatBar({ high }) {
  const level = high >= 3 ? 3 : high >= 1 ? 2 : 1;
  const labels = ["","STANDARD","ELEVATED","CRITICAL"];
  const colors = ["","#30d158","#ff9f0a","#ff2d55"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[1,2,3,4,5].map(b => (
          <div key={b} style={{ width: 18, height: 5, borderRadius: 2, background: b <= level + 1 ? colors[level] : "rgba(255,255,255,0.07)", boxShadow: b <= level + 1 ? `0 0 6px ${colors[level]}60` : "none" }} />
        ))}
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: colors[level], fontFamily: "'Courier New',monospace", letterSpacing: 1.5 }}>{labels[level]}</span>
    </div>
  );
}

/* ── Upload zone (idle state) ── */
function UploadZone({ onFile, drag, setDrag }) {
  return (
    <div
      className={`upload-zone${drag ? " drag" : ""}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      style={{ position: "relative" }}
    >
      <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) onFile(f); }}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      <div style={{ pointerEvents: "none" }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 10 }}>
          <rect x="4" y="4" width="28" height="28" rx="5" stroke="rgba(0,255,136,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M18 26V12M18 12L12 18M18 12L24 18" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ fontSize: 14, color: "#999", marginBottom: 4 }}>
          Drop a crime scene image <span style={{ color: "#ccc" }}>or click to browse</span>
        </div>
        <div style={{ fontSize: 11, color: "#555" }}>JPG · PNG · WEBP — sent to YOLOE backend</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [result, setResult]       = useState(null);   // analysis result
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const [drag, setDrag]           = useState(false);
  const [serverOk, setServerOk]   = useState(null);
  const [caseId]                  = useState(`#CSI-${Math.floor(Math.random() * 9000 + 1000)}`);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.ok ? setServerOk(true) : setServerOk(false))
      .catch(() => setServerOk(false));
  }, []);

  const handleFile = useCallback(async (file) => {
    setUploading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: "Server error" })); throw new Error(e.error); }
      const data = await res.json();
      setResult({ ...data, filename: file.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const evidence   = result ? result.detections.map(normalise) : [];
  const highE      = evidence.filter(e => e.pri === "HIGH");
  const medE       = evidence.filter(e => e.pri === "MED");
  const lowE       = evidence.filter(e => e.pri === "LOW");

  return (
    <div style={{ minHeight: "100vh", background: "#060810", color: "#e0e0e0", fontFamily: "'Helvetica Neue',Arial,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1a2a1a;border-radius:2px}
        @keyframes hPulse{0%,100%{box-shadow:0 0 8px rgba(255,45,85,0.5)}50%{box-shadow:0 0 20px rgba(255,45,85,0.9)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes ledPulse{0%,100%{box-shadow:0 0 8px #ff2d55}50%{box-shadow:0 0 2px #ff2d55}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
          background-image:linear-gradient(rgba(0,255,136,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.02) 1px,transparent 1px);
          background-size:48px 48px}
        .upload-zone{border:2px dashed rgba(255,255,255,0.1);border-radius:12px;
          padding:36px 24px;text-align:center;cursor:pointer;
          background:rgba(255,255,255,0.01);transition:all 0.25s}
        .upload-zone:hover,.upload-zone.drag{border-color:#00ff88!important;
          background:rgba(0,255,136,0.04)!important;box-shadow:0 0 24px rgba(0,255,136,0.15)}
        .reset-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
          color:#888;font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;
          padding:6px 14px;border-radius:6px;cursor:pointer;transition:all 0.2s;text-transform:uppercase}
        .reset-btn:hover{border-color:rgba(0,255,136,0.3);color:#00ff88;background:rgba(0,255,136,0.06)}
        .result-panel{animation:fadeIn 0.5s ease}
        .ev-scroll{overflow-y:auto;max-height:calc(100vh - 280px)}
        .ev-scroll::-webkit-scrollbar{width:3px}
        .ev-scroll::-webkit-scrollbar-thumb{background:#1a2a1a;border-radius:2px}
      `}</style>

      <div className="grid-bg" />
      <ScanOverlay active={uploading} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 40px", position: "relative", zIndex: 2 }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "28px 0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Live dot */}
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff2d55", animation: "ledPulse 1.5s infinite" }} />
            <div>
              <h1 style={{ fontFamily: "'Orbitron',monospace", fontSize: "clamp(18px,3vw,28px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1, margin: 0 }}>
                <GlitchText text="CRIME SCENE" style={{ color: "#fff" }} />
                <span style={{ color: "#00ff88", marginLeft: 10, fontSize: "0.65em", letterSpacing: 2 }}>YOLOE</span>
              </h1>
              <div style={{ fontSize: 10, color: "#444", fontFamily: "monospace", letterSpacing: 2, marginTop: 3 }}>
                FORENSIC ANALYSIS SYSTEM · BCSE301L · VIT VELLORE
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#444", fontFamily: "monospace" }}>{caseId}</span>
            <span style={{
              fontSize: 9, padding: "3px 10px", borderRadius: 4, fontFamily: "monospace", letterSpacing: 1.5,
              background: serverOk === true ? "rgba(48,209,88,0.08)" : serverOk === false ? "rgba(255,45,85,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${serverOk === true ? "rgba(48,209,88,0.25)" : serverOk === false ? "rgba(255,45,85,0.25)" : "rgba(255,255,255,0.08)"}`,
              color: serverOk === true ? "#30d158" : serverOk === false ? "#ff2d55" : "#555",
            }}>
              {serverOk === true ? "● ONLINE" : serverOk === false ? "● OFFLINE" : "● —"}
            </span>
            {result && (
              <button className="reset-btn" onClick={() => { setResult(null); setError(null); }}>↩ NEW SCAN</button>
            )}
          </div>
        </div>

        {/* ── TAPE ── */}
        <div style={{ marginBottom: 20 }}><EvidenceTape /></div>

        {/* ── SERVER OFFLINE BANNER ── */}
        {serverOk === false && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(255,45,85,0.07)", border: "1px solid rgba(255,45,85,0.25)", borderRadius: 10, fontSize: 11, color: "#ff6b6b", fontFamily: "monospace" }}>
            ⚠ Backend offline — run <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>python server.py</code> then refresh.
          </div>
        )}

        {/* ══ IDLE STATE ══ */}
        {!result && !uploading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

            {/* LEFT — upload + pipeline */}
            <div>
              {/* big tagline */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.8, maxWidth: 520, margin: "0 0 14px" }}>
                  Upload any crime scene photograph — the YOLOE model scans for
                  <span style={{ color: "#ff2d55" }}> victims</span>,
                  <span style={{ color: "#ff9f0a" }}> weapons</span>,
                  <span style={{ color: "#30d158" }}> disturbances</span>, and
                  <span style={{ color: "#0a84ff" }}> evidence</span> in a single pass,
                  then returns a priority-ranked annotated report.
                </p>
                {/* pipeline steps */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", marginBottom: 4 }}>
                  {[
                    { n: "01", label: "Upload Image",       color: "#00ff88" },
                    { n: "02", label: "YOLOE Detection",    color: "#0a84ff" },
                    { n: "03", label: "Priority Ranking",   color: "#ff9f0a" },
                    { n: "04", label: "Annotated Report",   color: "#ff2d55" },
                  ].map((step, i, arr) => (
                    <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", background: `${step.color}0d`, border: `1px solid ${step.color}25`, borderRadius: 7 }}>
                        <span style={{ fontSize: 8, color: step.color, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}>{step.n}</span>
                        <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>{step.label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <span style={{ fontSize: 11, color: "#2a2a2a", margin: "0 4px" }}>→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* upload zone */}
              <UploadZone onFile={handleFile} drag={drag} setDrag={setDrag} />

              {/* capability cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                {[
                  { icon: "◈", color: "#00ff88", title: "Single-pass detection",  body: "Processes the full image in one forward pass — fast and scalable." },
                  { icon: "◎", color: "#0a84ff", title: "Prompt-guided focus",    body: "65 forensic prompts steer detection to relevant evidence types." },
                  { icon: "◉", color: "#ff9f0a", title: "Priority ranking",       body: "Evidence auto-ranked HIGH / MED / LOW by forensic importance." },
                  { icon: "⬟", color: "#bf5af2", title: "Annotated output",       body: "Returns bounding-box image + structured evidence report." },
                ].map(c => (
                  <div key={c.title} style={{ padding: "12px 14px", background: `${c.color}06`, border: `1px solid ${c.color}18`, borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, color: c.color, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", fontFamily: "'Courier New',monospace", marginBottom: 3 }}>{c.title}</div>
                      <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* team meta row */}
              <div style={{ marginTop: 16, display: "flex", gap: 24, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap" }}>
                {[["Team","23BCE0455 · 23BCE0652 · 23BCE0451"],["Model","YOLOE-v8L-seg"],["Course","BCSE301L — Software Engineering"],["Prompts","65 forensic detection targets"]].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 8, color: "#333", fontFamily: "monospace", letterSpacing: 2 }}>{k}</div>
                    <div style={{ fontSize: 10, color: "#666", fontFamily: "monospace", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — fingerprint + category legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Fingerprint card */}
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px", position: "relative", overflow: "hidden" }}>
                {/* faint fingerprint SVG watermark */}
                <svg viewBox="0 0 220 220" style={{ position: "absolute", right: -20, top: -20, width: 180, height: 180, opacity: 0.055, pointerEvents: "none" }}>
                  {Array.from({ length: 16 }, (_, i) => (
                    <ellipse key={i} cx="110" cy="115" rx={10 + i * 7} ry={7 + i * 6}
                      fill="none" stroke="#00ff88" strokeWidth="1.1" />
                  ))}
                  <line x1="110" y1="25" x2="110" y2="8" stroke="#00ff88" strokeWidth="1" />
                </svg>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", letterSpacing: 2.5, marginBottom: 14 }}>DETECTION CATEGORIES</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(CAT_META).filter(([k]) => k !== "SUBTLE").map(([k, v]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", borderRadius: 6, background: `${v.color}07`, border: `1px solid ${v.color}15` }}>
                        <span style={{ fontSize: 13, color: v.color, width: 20, textAlign: "center", flexShrink: 0 }}>{v.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 10, color: "#999", fontFamily: "'Courier New',monospace" }}>{v.label}</span>
                        </div>
                        <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `${v.color}18`, color: v.color, fontFamily: "monospace", letterSpacing: 1, flexShrink: 0 }}>{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* priority key */}
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", letterSpacing: 2.5, marginBottom: 12 }}>PRIORITY KEY</div>
                {[
                  { pri: "HIGH", color: "#ff2d55", desc: "Weapons, victims, blood, forced entry" },
                  { pri: "MED",  color: "#ff9f0a", desc: "Disturbed furniture, documents, bags" },
                  { pri: "LOW",  color: "#30d158", desc: "Lamps, sofas — scene context only" },
                ].map(p => (
                  <div key={p.pri} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{
                      fontSize: 8, fontWeight: 800, letterSpacing: 1.5, padding: "2px 8px", borderRadius: 4,
                      background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}35`,
                      flexShrink: 0, marginTop: 1, fontFamily: "monospace",
                    }}>{p.pri}</span>
                    <span style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>{p.desc}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* ══ UPLOADING STATE ══ */}
        {uploading && (
          <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #00ff8830", borderTop: "3px solid #00ff88", borderRadius: "50%", margin: "0 auto 20px", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 13, color: "#00ff88", fontFamily: "'Courier New',monospace", letterSpacing: 2, marginBottom: 6 }}>RUNNING YOLOE DETECTION</div>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>Communicating with backend server…</div>
          </div>
        )}

        {/* ══ ERROR STATE ══ */}
        {error && !uploading && (
          <div style={{ maxWidth: 480, margin: "40px auto", padding: "20px 24px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.25)", borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: "#ff2d55", fontFamily: "monospace", marginBottom: 8 }}>✗ ANALYSIS FAILED</div>
            <div style={{ fontSize: 11, color: "#aa4444", marginBottom: 16 }}>{error}</div>
            <button className="reset-btn" onClick={() => setError(null)}>↩ TRY AGAIN</button>
          </div>
        )}

        {/* ══ RESULT STATE ══ */}
        {result && !uploading && (
          <div className="result-panel">

            {/* stat bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <StatPill label="HIGH" value={result.high} color="#ff2d55" />
              <StatPill label="MED"  value={result.med}  color="#ff9f0a" />
              <StatPill label="LOW"  value={result.low}  color="#30d158" />
              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.07)" }} />
              <div>
                <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>THREAT LEVEL</div>
                <ThreatBar high={result.high} />
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", letterSpacing: 2 }}>FILE</div>
                <div style={{ fontSize: 10, color: "#777", fontFamily: "monospace", marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.filename}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", letterSpacing: 2 }}>TOTAL</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e0e0e0", fontFamily: "'Courier New',monospace", lineHeight: 1 }}>{result.totalDetections}</div>
              </div>
            </div>

            {/* image + detections side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>

              {/* Annotated image */}
              <div style={{ background: "#000", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "rgba(0,255,136,0.05)", borderBottom: "1px solid rgba(0,255,136,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#00ff88", fontFamily: "monospace", letterSpacing: 2 }}>✓ ANNOTATED OUTPUT</span>
                  <a href={result.annotatedImage} download={result.filename?.replace(/\.\w+$/, "") + "_annotated.jpg"}
                    style={{ fontSize: 9, color: "#00aa66", fontFamily: "monospace", letterSpacing: 1, textDecoration: "none", border: "1px solid #00aa6635", padding: "2px 9px", borderRadius: 4 }}>
                    ↓ SAVE
                  </a>
                </div>
                <img
                  src={result.annotatedImage}
                  alt="Annotated crime scene"
                  style={{ width: "100%", display: "block", maxHeight: "calc(100vh - 260px)", objectFit: "contain" }}
                />
              </div>

              {/* Detection list */}
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* list header */}
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#e0e0e0", fontFamily: "'Orbitron',monospace", letterSpacing: 1 }}>EVIDENCE REPORT</span>
                  <span style={{ fontSize: 8, color: "#555", fontFamily: "monospace", letterSpacing: 1 }}>{result.totalDetections} DETECTIONS</span>
                </div>

                {/* col labels */}
                <div style={{ display: "grid", gridTemplateColumns: "18px 1fr auto", gap: 8, padding: "5px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
                  {["","OBJECT / REASON","PRI"].map(h => (
                    <span key={h} style={{ fontSize: 7, color: "#333", fontFamily: "monospace", letterSpacing: 2 }}>{h}</span>
                  ))}
                </div>

                {/* scrollable rows */}
                <div className="ev-scroll" style={{ flex: 1, padding: "4px 0" }}>
                  {highE.length > 0 && (<>
                    <div style={{ fontSize: 8, color: "#ff2d5560", fontFamily: "monospace", letterSpacing: 3, padding: "6px 12px 2px" }}>── HIGH ──────────────────────</div>
                    {highE.map((e, i) => <EvidenceRow key={i} item={e} idx={i} />)}
                  </>)}
                  {medE.length > 0 && (<>
                    <div style={{ fontSize: 8, color: "#ff9f0a60", fontFamily: "monospace", letterSpacing: 3, padding: "8px 12px 2px" }}>── MEDIUM ────────────────────</div>
                    {medE.map((e, i) => <EvidenceRow key={i} item={e} idx={highE.length + i} />)}
                  </>)}
                  {lowE.length > 0 && (<>
                    <div style={{ fontSize: 8, color: "#30d15860", fontFamily: "monospace", letterSpacing: 3, padding: "8px 12px 2px" }}>── LOW ───────────────────────</div>
                    {lowE.map((e, i) => <EvidenceRow key={i} item={e} idx={highE.length + medE.length + i} />)}
                  </>)}
                  {evidence.length === 0 && (
                    <div style={{ padding: "30px", textAlign: "center", color: "#444", fontSize: 11, fontFamily: "monospace" }}>No detections</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700, color: "#252525", letterSpacing: 2 }}>YOLOE · CSI</span>
          <span style={{ fontSize: 9, color: "#2a2a2a", fontFamily: "monospace" }}>Hrishikesh Mhaiskar · Anupriya Singh · Hrithik Sharma — VIT Vellore 2026</span>
        </div>

      </div>
    </div>
  );
}