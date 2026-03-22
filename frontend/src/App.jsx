import { useState, useEffect, useRef } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT      = "#c4788a";
const ACCENT_SOFT = "#e8b4be";
const BG_MAIN     = "#0f0c0e";
const BG_CARD     = "#1a1418";
const BG_BORDER   = "#2e2228";
const TEXT_PRI    = "#f7f0f2";
const TEXT_SEC    = "#a89298";

const URGENCY_THEMES = {
  low:           { banner: "#0d1f14", badge: "#1a4d2e", badgeText: "#6ee7a0", bar: "#6ee7a0", label: "Comfortable" },
  medium:        { banner: "#1f1a0d", badge: "#4d3a1a", badgeText: "#f5c97a", bar: "#f5c97a", label: "Mild Concern" },
  "medium-high": { banner: "#1f1015", badge: "#4d1a28", badgeText: "#f0829a", bar: "#f0829a", label: "Moderate Concern" },
  high:          { banner: "#1f0d0d", badge: "#4d1a1a", badgeText: "#f87171", bar: "#f87171", label: "Urgent" },
};

const TIER_BADGE_COLOR = {
  comfortable:            "#6ee7a0",
  mild_discomfort:        "#f5c97a",
  moderate_discomfort:    "#f0829a",
  significant_discomfort: "#f87171",
};

const SCORE_COLORS      = { 0: "#6ee7a0", 1: "#f5c97a", 2: "#f87171" };
const CONFIDENCE_COLORS = { high: "#6ee7a0", medium: "#f5c97a", low: "#f87171" };

const DIMENSION_LABELS = {
  ear_position:       "Ears",
  orbital_tightening: "Eyes",
  muzzle_tension:     "Muzzle",
  whisker_position:   "Whiskers",
  head_position:      "Head",
};

// Personalised loading messages — cycle through all 5 FGS dimensions by name
const buildLoadingMessages = (name) => {
  const n = name ? `${name}'s` : "your cat's";
  return [
    `Checking ${n} ear position...`,
    `Analysing ${n} eye tightening...`,
    `Reading ${n} muzzle tension...`,
    `Examining ${n} whisker position...`,
    `Assessing ${n} head carriage...`,
    "Calculating FGS score...",
    "Preparing your results...",
  ];
};

const REJECTION_ICONS = {
  no_cat_detected:            "🐾",
  multiple_cats_detected:     "🐱🐱",
  insufficient_image_quality: "📷",
};

const HOW_IT_WORKS = [
  { icon: "📸", title: "Upload a photo",     desc: "A clear front-facing photo of your cat works best" },
  { icon: "🔍", title: "We analyse the FGS", desc: "AI scores five clinically validated facial indicators" },
  { icon: "💝", title: "You get a result",   desc: "A plain-English assessment with guidance on next steps" },
];

const FGS_TIERS = [
  { score: "0–2", label: "Comfortable", color: "#6ee7a0", bg: "#0d1f14", desc: "Relaxed ears, soft eyes, loose whiskers" },
  { score: "3–4", label: "Mild",        color: "#f5c97a", bg: "#1f1a0d", desc: "Slight ear rotation, partial squint" },
  { score: "5–6", label: "Moderate",    color: "#f0829a", bg: "#1f1015", desc: "Flattened ears, tense muzzle, hunched head" },
  { score: "7+",  label: "Significant", color: "#f87171", bg: "#1f0d0d", desc: "Multiple strong grimace indicators present" },
];

const RELAXED_INDICATORS = [
  { icon: "👂", label: "Ears",     desc: "Forward-facing and upright, not rotated" },
  { icon: "👁️", label: "Eyes",    desc: "Fully open with a soft, relaxed gaze" },
  { icon: "😺", label: "Muzzle",  desc: "Rounded and soft, not drawn or tense" },
  { icon: "〰️", label: "Whiskers",desc: "Fanned naturally to the sides" },
  { icon: "🐱", label: "Head",    desc: "Held comfortably above shoulder level" },
];

const STORAGE_KEY = "ww_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(entries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
}

function personalise(text, name) {
  if (!name) return text;
  return text
    .replace(/your cat is/gi,     `${name} is`)
    .replace(/your cat appears/gi, `${name} appears`)
    .replace(/your cat may/gi,    `${name} may`)
    .replace(/your cat needs/gi,  `${name} needs`)
    .replace(/your cat/gi,        name);
}

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function buildShareText(result, catName, breed, timestamp) {
  const date = timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const lines = [
    "🐾 WhiskerWatch — Feline Grimace Scale Assessment",
    "─────────────────────────────────",
    catName ? `Cat: ${catName}${breed ? ` (${breed})` : ""}` : null,
    `Date: ${date}`,
    `Score: ${result.score_summary}`,
    `Status: ${result.tier?.replace(/_/g, " ")}`,
    "",
    result.headline,
    "",
    result.message,
    "",
    result.vet_advice ? `📋 Vet guidance: ${result.vet_advice}` : null,
    "",
    "─────────────────────────────────",
    "WhiskerWatch is not a substitute for veterinary care.",
  ];
  return lines.filter(l => l !== null).join("\n");
}

// ── Paw icon ──────────────────────────────────────────────────────────────────
function PawIcon({ size = 48, color = ACCENT }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="44" rx="16" ry="12" fill={color} opacity="0.9"/>
      <ellipse cx="14" cy="32" rx="7"  ry="9"  fill={color} opacity="0.75"/>
      <ellipse cx="50" cy="32" rx="7"  ry="9"  fill={color} opacity="0.75"/>
      <ellipse cx="22" cy="20" rx="6"  ry="8"  fill={color} opacity="0.75"/>
      <ellipse cx="42" cy="20" rx="6"  ry="8"  fill={color} opacity="0.75"/>
    </svg>
  );
}

// ── Score arc ─────────────────────────────────────────────────────────────────
function ScoreArc({ score, max, color }) {
  const r = 54, cx = 70, cy = 70, startAngle = -200, sweepAngle = 220;
  const toRad = d => (d * Math.PI) / 180;
  const arcPath = (a0, sw) => {
    const a1 = toRad(a0), a2 = toRad(a0 + sw);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${sw > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  return (
    <svg width="140" height="100" viewBox="0 0 140 100">
      <path d={arcPath(startAngle, sweepAngle)} stroke="#2e2228" strokeWidth="8" fill="none" strokeLinecap="round"/>
      <path d={arcPath(startAngle, sweepAngle * (score / max))} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}/>
      <text x="70" y="68" textAnchor="middle" fill={TEXT_PRI} fontSize="22" fontWeight="700" fontFamily="'Playfair Display', serif">{score}</text>
      <text x="70" y="84" textAnchor="middle" fill={TEXT_SEC} fontSize="10" fontFamily="'DM Sans', sans-serif">out of {max}</text>
    </svg>
  );
}

// ── Unified clickable dimension panel ─────────────────────────────────────────
// Replaces both DimensionBreakdown and ObservationCard — gauges expand on tap
function DimensionPanel({ fgsResult }) {
  const [active, setActive] = useState(null);
  if (!fgsResult?.dimension_scores) return null;

  const dims  = fgsResult.dimension_scores;
  const justs = fgsResult.justifications || {};
  const size  = 52, gx = 26, gy = 26, r = 20, startA = -210, sweepA = 240;
  const toRad = d => (d * Math.PI) / 180;
  const arcPath = (a0, sw) => {
    const a1 = toRad(a0), a2 = toRad(a0 + sw);
    const x1 = gx + r * Math.cos(a1), y1 = gy + r * Math.sin(a1);
    const x2 = gx + r * Math.cos(a2), y2 = gy + r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${sw > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  return (
    <div style={{ marginBottom: "22px" }}>
      <SectionLabel>FGS dimension breakdown — tap to explore</SectionLabel>
      <div style={{ background: BG_CARD, border: `1px solid ${BG_BORDER}`, borderRadius: "14px", overflow: "hidden" }}>

        {/* Gauge row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0", padding: "20px 12px 0" }}>
          {Object.entries(DIMENSION_LABELS).map(([key, label], i) => {
            const d           = dims[key] || {};
            const score       = d.score ?? 0;
            const confidence  = d.confidence ?? (d.uncertain ? "low" : "high");
            const uncertain   = d.uncertain;
            const scoreColor  = SCORE_COLORS[score]          ?? "#888";
            const confColor   = CONFIDENCE_COLORS[confidence] ?? "#888";
            const isActive    = active === key;
            const isElevated  = score >= 1;

            return (
              <div
                key={key}
                onClick={() => setActive(isActive ? null : key)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  cursor: "pointer", padding: "8px 4px 12px",
                  borderRadius: "10px",
                  background: isActive ? `${scoreColor}12` : "transparent",
                  border: isActive ? `1px solid ${scoreColor}44` : "1px solid transparent",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
              >
                {/* Elevated dot indicator */}
                {isElevated && !isActive && (
                  <div style={{ position: "absolute", top: "6px", right: "8px", width: "6px", height: "6px", borderRadius: "50%", background: scoreColor, boxShadow: `0 0 4px ${scoreColor}` }}/>
                )}
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  <path d={arcPath(startA, sweepA)} stroke="#2e2228" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  <path d={arcPath(startA, (score / 2) * sweepA)} stroke={scoreColor} strokeWidth="5" fill="none" strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 ${isActive ? "5px" : "3px"} ${scoreColor}88)` }}/>
                  <text x={gx} y={gy + 4} textAnchor="middle" fill={scoreColor} fontSize="13" fontWeight="700" fontFamily="'DM Sans', sans-serif">{score}</text>
                </svg>
                <span style={{ fontFamily: "'DM Sans', sans-serif", color: isActive ? TEXT_PRI : TEXT_SEC, fontSize: "10px", textAlign: "center", fontWeight: isActive ? 600 : 400, transition: "color 0.2s ease" }}>{label}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "9px", color: confColor, background: `${confColor}18`, border: `1px solid ${confColor}33`, borderRadius: "20px", padding: "1px 6px" }}>
                  {uncertain ? "uncertain" : confidence}
                </span>
              </div>
            );
          })}
        </div>

        {/* Expanded detail — slides in below gauges */}
        {active && (() => {
          const d     = dims[active] || {};
          const score = d.score ?? 0;
          const color = SCORE_COLORS[score] ?? "#888";
          const just  = justs[active] || "No observation recorded.";
          const confColor = CONFIDENCE_COLORS[d.confidence ?? "high"] ?? "#888";
          return (
            <div style={{ margin: "0 12px 16px", background: "#100d12", border: `1px solid ${color}33`, borderRadius: "10px", padding: "14px 16px", animation: "fadeSlideIn 0.2s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_PRI, fontSize: "13px", fontWeight: 600 }}>{DIMENSION_LABELS[active]}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "10px", color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: "20px", padding: "1px 8px" }}>
                  score {score}/2
                </span>
                {d.adjusted && <span style={{ fontSize: "10px", color: "#f5c97a", background: "#2a1e10", borderRadius: "4px", padding: "1px 6px", fontFamily: "'DM Sans', sans-serif" }}>adjusted</span>}
                {d.uncertain && <span style={{ fontSize: "10px", color: "#888", background: "#1e1620", borderRadius: "4px", padding: "1px 6px", fontFamily: "'DM Sans', sans-serif" }}>uncertain</span>}
                <span style={{ marginLeft: "auto", fontFamily: "'DM Sans', sans-serif", fontSize: "10px", color: confColor }}>
                  {d.confidence ?? "high"} confidence · choice {d.choice ?? "—"}
                </span>
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "13px", fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                "{just}"
              </p>
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", borderTop: `1px solid ${BG_BORDER}`, padding: "10px 16px 14px" }}>
          {[{ color: "#6ee7a0", label: "0 — relaxed" }, { color: "#f5c97a", label: "1 — mild" }, { color: "#f87171", label: "2 — elevated" }].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: item.color }}/>
              <span style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "10px" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Raw analysis panel ────────────────────────────────────────────────────────
function RawAnalysisPanel({ fgsResult }) {
  const [open, setOpen] = useState(false);
  if (!fgsResult?.dimension_scores) return null;
  const dims  = fgsResult.dimension_scores;
  const justs = fgsResult.justifications || {};
  return (
    <div style={{ marginBottom: "22px" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: `1px solid ${BG_BORDER}`, borderRadius: "8px", padding: "9px 14px", color: TEXT_SEC, fontFamily: "'DM Sans', sans-serif", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "border-color 0.2s ease", width: "100%" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT + "66"}
        onMouseLeave={e => e.currentTarget.style.borderColor = BG_BORDER}
      >
        <span style={{ fontSize: "13px" }}>🔬</span>
        <span>View raw analysis</span>
        <span style={{ marginLeft: "auto", transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "none", fontSize: "11px" }}>▾</span>
      </button>

      {open && (
        <div style={{ background: "#100d12", border: `1px solid ${BG_BORDER}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "16px", animation: "fadeSlideIn 0.2s ease both" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "10px", letterSpacing: "0.5px", marginBottom: "12px", textTransform: "uppercase" }}>
            Layer 1 — Vision model observations
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
              const d     = dims[key]  || {};
              const just  = justs[key] || "No observation recorded.";
              const score = d.score ?? 0;
              const conf  = d.confidence ?? (d.uncertain ? "low" : "high");
              const scoreColor = SCORE_COLORS[score] ?? "#888";
              const confColor  = CONFIDENCE_COLORS[conf] ?? "#888";
              return (
                <div key={key} style={{ background: BG_CARD, border: `1px solid ${BG_BORDER}`, borderRadius: "8px", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_PRI, fontSize: "12px", fontWeight: 600 }}>{label}</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "10px", color: scoreColor, background: `${scoreColor}18`, border: `1px solid ${scoreColor}33`, borderRadius: "20px", padding: "1px 7px" }}>
                      score {score}/2
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "10px", color: confColor, background: `${confColor}18`, border: `1px solid ${confColor}33`, borderRadius: "20px", padding: "1px 7px" }}>
                      {d.uncertain ? "uncertain" : conf} confidence
                    </span>
                    {d.adjusted && (
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "10px", color: "#f5c97a", background: "#2a1e10", borderRadius: "4px", padding: "1px 6px" }}>adjusted</span>
                    )}
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "12px", fontStyle: "italic", lineHeight: 1.55, margin: 0 }}>
                    "{just}"
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "10px", marginTop: "6px" }}>
                    Choice: {d.choice || "—"} · Layer 2 mapped to {score}
                  </p>
                </div>
              );
            })}
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "10px", marginTop: "12px", lineHeight: 1.5 }}>
            Layer 2 total: {fgsResult.total_score}/{fgsResult.max_possible} ·
            Status: {fgsResult.status} ·
            Flags: {fgsResult.flags?.length ? fgsResult.flags.join(", ") : "none"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Share button ──────────────────────────────────────────────────────────────
function ShareButton({ result, catName, breed, timestamp }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildShareText(result, catName, breed, timestamp);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el);
      el.select(); document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? `${ACCENT}22` : "transparent",
        border: `1.5px solid ${copied ? ACCENT : BG_BORDER}`,
        color: copied ? ACCENT_SOFT : TEXT_SEC,
        fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "13px",
        padding: "10px 22px", borderRadius: "40px", cursor: "pointer",
        letterSpacing: "0.3px", transition: "all 0.2s ease",
        display: "flex", alignItems: "center", gap: "7px",
      }}
    >
      <span style={{ fontSize: "14px" }}>{copied ? "✓" : "⎘"}</span>
      {copied ? "Copied to clipboard" : "Copy summary"}
    </button>
  );
}

// ── Observation card ──────────────────────────────────────────────────────────
function ObservationCard({ obs, idx }) {
  const color = SCORE_COLORS[obs.score] || "#888";
  return (
    <div style={{ background: BG_CARD, border: `1px solid ${BG_BORDER}`, borderLeft: `3px solid ${color}`, borderRadius: "10px", padding: "14px 16px", animation: "fadeSlideIn 0.4s ease both", animationDelay: `${idx * 0.08}s` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
        <span style={{ color: TEXT_PRI, fontWeight: 600, fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>{obs.dimension}</span>
        {obs.adjusted && <span style={{ fontSize: "10px", background: "#2a1e10", color: "#f5c97a", border: "1px solid #6b4a0044", borderRadius: "4px", padding: "1px 6px" }}>adjusted</span>}
        {obs.uncertain && <span style={{ fontSize: "10px", background: "#1e1620", color: "#888", border: `1px solid ${BG_BORDER}`, borderRadius: "4px", padding: "1px 6px" }}>uncertain</span>}
        <span style={{ marginLeft: "auto", fontSize: "11px", color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: "20px", padding: "2px 10px", fontFamily: "'DM Sans', sans-serif" }}>{obs.descriptor}</span>
      </div>
      <p style={{ margin: 0, color: TEXT_SEC, fontSize: "13px", fontStyle: "italic", lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif" }}>"{obs.justification}"</p>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <h3 style={{ fontFamily: "'DM Sans', sans-serif", color: "#6b5058", fontSize: "10px", fontWeight: 600, letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "14px" }}>
      {children}
    </h3>
  );
}

// ── Disclaimer ────────────────────────────────────────────────────────────────
function Disclaimer() {
  return (
    <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "11px", textAlign: "center", lineHeight: 1.6, padding: "32px 16px 0", maxWidth: "420px", margin: "0 auto" }}>
      WhiskerWatch is not a substitute for veterinary care.
      Always consult a professional if you're concerned about your cat's health.
    </p>
  );
}

// ── Results body ──────────────────────────────────────────────────────────────
function ResultsBody({ result, fgsResult, catName, breed, onReset, timestamp }) {
  const isRejection  = result && ["no_cat_detected","multiple_cats_detected","insufficient_image_quality"].includes(result.status);
  const theme        = result?.urgency ? URGENCY_THEMES[result.urgency] || URGENCY_THEMES["medium-high"] : null;
  const isComfortable= result?.tier === "comfortable";

  if (isRejection) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: "48px", marginBottom: "18px" }}>{REJECTION_ICONS[result.status] || "❌"}</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", color: TEXT_PRI, fontSize: "24px", marginBottom: "12px" }}>{result.headline}</h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "14px", lineHeight: 1.65, maxWidth: "360px", margin: "0 auto 32px" }}>{result.message}</p>
      {onReset && <button onClick={onReset} style={btnStyle(ACCENT)}>Try another photo</button>}
      <Disclaimer/>
    </div>
  );

  if (!theme) return null;

  return (
    <>
      {catName && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: ACCENT_SOFT, fontSize: "16px" }}>
            Assessment for {catName}
            {breed && <span style={{ color: TEXT_SEC, fontSize: "13px", fontStyle: "normal" }}> · {breed}</span>}
          </span>
        </div>
      )}

      {/* Banner */}
      <div style={{ background: theme.banner, border: `1px solid ${theme.bar}22`, borderRadius: "16px", padding: "28px 24px", marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: TEXT_PRI, fontSize: "clamp(18px,4vw,24px)", fontWeight: 600, textAlign: "center" }}>
            {personalise(result.headline, catName)}
          </h2>
          <span style={{ background: theme.badge, color: theme.badgeText, fontSize: "11px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: "4px 12px", borderRadius: "20px", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
            {theme.label}
          </span>
        </div>
        <ScoreArc score={parseInt(result.score_summary)} max={parseInt(result.score_summary.split("of")[1]) || 10} color={theme.bar}/>
      </div>

      {/* Message */}
      <div style={{ marginBottom: "22px", padding: "0 2px" }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#c4b4b8", fontSize: "14px", lineHeight: 1.75 }}>
          {personalise(result.message, catName)}
        </p>
      </div>

      {/* Unified dimension panel — gauges expand on tap to show justification */}
      {fgsResult && <DimensionPanel fgsResult={fgsResult}/>}

      {/* Comfortable — relaxed indicators */}
      {isComfortable && (
        <div style={{ marginBottom: "22px" }}>
          <SectionLabel>Signs {catName || "your cat"} is relaxed</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>
            {RELAXED_INDICATORS.map((item, i) => (
              <div key={i} style={{ background: BG_CARD, border: `1px solid ${BG_BORDER}`, borderLeft: `3px solid ${ACCENT}66`, borderRadius: "10px", padding: "12px 14px", animation: `fadeSlideIn 0.4s ease both`, animationDelay: `${i * 0.07}s` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{item.icon}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: ACCENT_SOFT, fontSize: "12px", fontWeight: 600 }}>{item.label}</span>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "11px", lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flag messages */}
      {result.flag_messages?.length > 0 && (
        <div style={{ marginBottom: "22px" }}>
          {result.flag_messages.map((msg, i) => (
            <div key={i} style={{ background: "#1f1800", border: "1px solid #6b4a0033", borderLeft: "3px solid #f5c97a", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px" }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#c9a84c", fontSize: "13px", lineHeight: 1.6 }}>⚠ {msg}</p>
            </div>
          ))}
        </div>
      )}

      {/* Vet advice */}
      {result.vet_advice && (
        <div style={{ background: "#1a1018", border: `1px solid ${ACCENT}22`, borderLeft: `3px solid ${ACCENT}`, borderRadius: "10px", padding: "16px 18px", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "18px", flexShrink: 0 }}>🩺</span>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: ACCENT_SOFT, fontSize: "13px", lineHeight: 1.65 }}>
            {personalise(result.vet_advice, catName)}
          </p>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
        <ShareButton result={result} catName={catName} breed={breed} timestamp={timestamp}/>
        {onReset && <button onClick={onReset} style={btnStyle(ACCENT)}>Assess another cat</button>}
      </div>

      <Disclaimer/>
    </>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClear }) {
  const [expanded, setExpanded] = useState(null);
  if (!history.length) return null;
  return (
    <div style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <SectionLabel>Recent assessments</SectionLabel>
        <button onClick={() => { onClear(); setExpanded(null); }} style={{ background: "none", border: "none", color: "#3d2830", fontSize: "11px", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
          Clear history
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {history.slice().reverse().map((entry, i) => {
          const tierColor = TIER_BADGE_COLOR[entry.tier] || ACCENT;
          const isOpen    = expanded === i;
          return (
            <div key={i} style={{ animation: `fadeSlideIn 0.4s ease both`, animationDelay: `${i * 0.05}s` }}>
              <div
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{ background: isOpen ? "#211820" : BG_CARD, border: `1px solid ${isOpen ? ACCENT + "44" : BG_BORDER}`, borderRadius: isOpen ? "12px 12px 0 0" : "12px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", transition: "all 0.2s ease" }}
              >
                {entry.thumbnail && <img src={entry.thumbnail} alt="" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0, border: `1px solid ${BG_BORDER}` }}/>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    {entry.catName && <span style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_PRI, fontSize: "13px", fontWeight: 600 }}>{entry.catName}</span>}
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: tierColor, fontSize: "10px", background: `${tierColor}18`, border: `1px solid ${tierColor}33`, borderRadius: "20px", padding: "1px 8px" }}>
                      {entry.tier?.replace(/_/g, " ")}
                    </span>
                    <span style={{ marginLeft: "auto", fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "10px", flexShrink: 0 }}>
                      {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "11px", margin: 0 }}>
                    Score {entry.score} · {entry.headline}
                  </p>
                </div>
                <span style={{ color: "#3d2830", fontSize: "12px", flexShrink: 0, transition: "transform 0.2s ease", transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
              </div>
              {isOpen && entry.ownerResponse && (
                <div style={{ background: "#16111a", border: `1px solid ${ACCENT}33`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "20px 16px", animation: "fadeSlideIn 0.25s ease both" }}>
                  <ResultsBody result={entry.ownerResponse} fgsResult={entry.fgsResult} catName={entry.catName} breed={entry.breed} onReset={null} timestamp={entry.timestamp}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cat profile form ──────────────────────────────────────────────────────────
function CatProfileForm({ profile, onChange }) {
  const inputStyle = { width: "100%", background: BG_CARD, border: `1px solid ${BG_BORDER}`, borderRadius: "10px", padding: "10px 14px", color: TEXT_PRI, fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none", transition: "border-color 0.2s ease" };
  return (
    <div style={{ marginBottom: "32px" }}>
      <SectionLabel>Your cat (optional)</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <input style={inputStyle} placeholder="Cat's name" value={profile.name} onChange={e => onChange({ ...profile, name: e.target.value })} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = BG_BORDER}/>
        <input style={inputStyle} placeholder="Breed (optional)" value={profile.breed} onChange={e => onChange({ ...profile, breed: e.target.value })} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = BG_BORDER}/>
      </div>
    </div>
  );
}

// ── Wrapper ───────────────────────────────────────────────────────────────────
function Wrapper({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG_MAIN, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px 40px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: "-15%", left: "50%", transform: "translateX(-50%)", width: "500px", height: "350px", background: `radial-gradient(ellipse, ${ACCENT}0e 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }}/>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "560px" }}>{children}</div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]         = useState("upload");
  const [dragOver, setDragOver]     = useState(false);
  const [preview, setPreview]       = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult]         = useState(null);
  const [fgsResult, setFgsResult]   = useState(null);
  const [error, setError]           = useState(null);
  const [history, setHistory]       = useState(loadHistory);
  const [catProfile, setCatProfile] = useState({ name: "", breed: "" });
  const fileInputRef                = useRef();
  const loadingInterval             = useRef();
  const loadingMessages             = useRef([]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${BG_MAIN}; min-height: 100vh; }
      @keyframes fadeSlideIn { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
      @keyframes breathe { 0%,100%{transform:scale(1);opacity:0.9;}50%{transform:scale(1.08);opacity:1;} }
      @keyframes fadeMsg { 0%,100%{opacity:0;transform:translateY(6px);}20%,80%{opacity:1;transform:translateY(0);} }
      @keyframes shimmer { 0%{background-position:-200% 0;}100%{background-position:200% 0;} }
      @keyframes floatUp { 0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);} }
      .how-card:hover { border-color: ${ACCENT}55 !important; background: #221820 !important; }
      .tier-chip:hover { transform: translateY(-2px); }
      input::placeholder { color: #3d2830; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: ${BG_MAIN}; }
      ::-webkit-scrollbar-thumb { background: ${BG_BORDER}; border-radius: 2px; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (screen === "loading") {
      loadingMessages.current = buildLoadingMessages(catProfile.name);
      setLoadingMsg(0);
      loadingInterval.current = setInterval(() => {
        setLoadingMsg(m => {
          const next = m + 1;
          return next < loadingMessages.current.length ? next : m;
        });
      }, 1600);
    }
    return () => clearInterval(loadingInterval.current);
  }, [screen, catProfile.name]);

  const handleFile = (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    submitFile(file);
  };

  const submitFile = async (file) => {
    setScreen("loading"); setError(null); setResult(null); setFgsResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch("https://whisker-watch-production.up.railway.app/hackathon", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      const r   = data.owner_response;
      const fgs = data.fgs_result;
      setResult(r);
      setFgsResult(fgs);
      setScreen("results");
      if (r.status === "assessed") {
        const entry = {
          timestamp: Date.now(), catName: catProfile.name || null,
          breed: catProfile.breed || null, tier: r.tier,
          score: r.score_summary, headline: r.headline,
          thumbnail: URL.createObjectURL(file),
          ownerResponse: r, fgsResult: fgs,
        };
        const updated = [...loadHistory(), entry];
        saveHistory(updated); setHistory(updated);
      }
    } catch (e) {
      setError(e.message); setScreen("results");
    }
  };

  const reset = () => {
    setScreen("upload"); setPreview(null); setResult(null);
    setFgsResult(null); setError(null); setLoadingMsg(0);
  };

  const clearHistory = () => { saveHistory([]); setHistory([]); };
  const catName      = catProfile.name;
  const msgs         = loadingMessages.current.length
    ? loadingMessages.current
    : buildLoadingMessages(catName);

  // ── Upload ────────────────────────────────────────────────────────────────
  if (screen === "upload") return (
    <Wrapper>
      <div style={{ animation: "fadeSlideIn 0.6s ease both" }}>
        <div style={{ textAlign: "center", paddingTop: "64px", marginBottom: "36px" }}>
          <div style={{ animation: "floatUp 4s ease-in-out infinite", display: "inline-block", marginBottom: "18px" }}>
            <PawIcon size={52}/>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(30px,6vw,42px)", fontWeight: 700, color: TEXT_PRI, letterSpacing: "-0.5px", marginBottom: "10px" }}>
            WhiskerWatch
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "14px", lineHeight: 1.65, maxWidth: "360px", margin: "0 auto" }}>
            Assess your cat's comfort level using the clinically validated{" "}
            <span style={{ color: ACCENT_SOFT }}>Feline Grimace Scale</span>
          </p>
        </div>

        <CatProfileForm profile={catProfile} onChange={setCatProfile}/>

        <div
          onClick={() => fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ border: `2px dashed ${dragOver ? ACCENT : BG_BORDER}`, borderRadius: "18px", padding: "44px 32px", cursor: "pointer", background: dragOver ? `${ACCENT}08` : "transparent", transition: "all 0.25s ease", position: "relative", overflow: "hidden", marginBottom: "40px", textAlign: "center" }}
        >
          {dragOver && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg,transparent,${ACCENT}0a,transparent)`, backgroundSize: "200%", animation: "shimmer 1.2s ease infinite" }}/>}
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📸</div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_PRI, fontWeight: 500, fontSize: "15px", marginBottom: "5px" }}>
            {catName ? `Drop a photo of ${catName}` : "Drop your photo here"}
          </p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#6b5058", fontSize: "13px", marginBottom: "14px" }}>or click to browse</p>
          <span style={{ fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "11px", letterSpacing: "0.5px" }}>JPEG · PNG · WEBP · max 10MB</span>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])}/>

        <HistoryPanel history={history} onClear={clearHistory}/>

        <div style={{ marginBottom: "32px" }}>
          <SectionLabel>How it works</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="how-card" style={{ background: BG_CARD, border: `1px solid ${BG_BORDER}`, borderRadius: "14px", padding: "18px 14px", textAlign: "center", transition: "all 0.2s ease", animation: `fadeSlideIn 0.5s ease both`, animationDelay: `${0.1 + i * 0.1}s` }}>
                <div style={{ fontSize: "22px", marginBottom: "10px" }}>{step.icon}</div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_PRI, fontSize: "12px", fontWeight: 600, marginBottom: "5px" }}>{step.title}</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "11px", lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "8px" }}>
          <SectionLabel>FGS score reference</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>
            {FGS_TIERS.map((tier, i) => (
              <div key={i} className="tier-chip" style={{ background: tier.bg, border: `1px solid ${tier.color}22`, borderLeft: `3px solid ${tier.color}`, borderRadius: "10px", padding: "12px 14px", transition: "transform 0.2s ease", animation: `fadeSlideIn 0.5s ease both`, animationDelay: `${0.3 + i * 0.08}s` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: tier.color, fontSize: "12px", fontWeight: 600 }}>{tier.label}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "'DM Sans', sans-serif", color: tier.color, fontSize: "10px", background: `${tier.color}18`, padding: "1px 8px", borderRadius: "20px" }}>{tier.score}</span>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "11px", lineHeight: 1.45 }}>{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <Disclaimer/>
      </div>
    </Wrapper>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (screen === "loading") return (
    <Wrapper>
      <div style={{ textAlign: "center", paddingTop: "120px" }}>
        {preview && (
          <div style={{ width: "88px", height: "88px", borderRadius: "50%", overflow: "hidden", margin: "0 auto 28px", border: `2px solid ${ACCENT}44`, animation: "breathe 2s ease-in-out infinite" }}>
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
        )}
        <div style={{ marginBottom: "28px", animation: "floatUp 3s ease-in-out infinite" }}><PawIcon size={38}/></div>
        <p key={loadingMsg} style={{ fontFamily: "'DM Sans', sans-serif", color: ACCENT_SOFT, fontSize: "14px", fontWeight: 500, animation: "fadeMsg 1.6s ease both", minHeight: "24px" }}>
          {msgs[loadingMsg] ?? msgs[msgs.length - 1]}
        </p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: "#3d2830", fontSize: "11px", marginTop: "10px", letterSpacing: "0.5px" }}>
          Powered by Feline Grimace Scale · FGS
        </p>
      </div>
    </Wrapper>
  );

  // ── Results ───────────────────────────────────────────────────────────────
  if (screen === "results") return (
    <Wrapper>
      <div style={{ paddingTop: "40px", animation: "fadeSlideIn 0.5s ease both" }}>
        {error ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: TEXT_PRI, fontSize: "22px", marginBottom: "10px" }}>Something went wrong</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_SEC, fontSize: "14px", marginBottom: "28px" }}>{error}</p>
            <button onClick={reset} style={btnStyle(ACCENT)}>Try again</button>
          </div>
        ) : (
          <ResultsBody result={result} fgsResult={fgsResult} catName={catName} breed={catProfile.breed} onReset={reset} timestamp={Date.now()}/>
        )}
      </div>
    </Wrapper>
  );
}

function btnStyle(color) {
  return { background: "transparent", border: `1.5px solid ${color}`, color, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "14px", padding: "12px 32px", borderRadius: "40px", cursor: "pointer", letterSpacing: "0.3px", transition: "all 0.2s ease" };
}