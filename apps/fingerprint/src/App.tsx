import { BrandMark, Footer, Header } from "@junkyardsh/ui";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type SignalStatus = "scanning" | "ok" | "blocked" | "warn" | "bad" | "good";

interface SignalRow {
  label: string;
  value: string;
  status?: SignalStatus;
}

interface FingerprintSection {
  title: string;
  entropy: string;
  rows: SignalRow[];
}

type VerdictLevel = "human" | "suspicious" | "bot";

interface FingerprintData {
  sections: FingerprintSection[];
  visitorId: string;
  riskScore: number;
  verdict: VerdictLevel;
  verdictLabel: string;
  botFlags: string[];
}

// ── SHA-256 helper ─────────────────────────────────────────────────────────

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Data collection ──────────────────────────────────────────────────────────

async function collectFingerprint(): Promise<FingerprintData> {
  const sections: FingerprintSection[] = [];
  const data: Record<string, string> = {};
  const botFlags: string[] = [];

  // ── navigator / system ──────────────────────────────────────────────────

  {
    const n = navigator;
    data.ua = n.userAgent;
    data.sys = [
      n.platform,
      n.hardwareConcurrency,
      n.deviceMemory,
      n.maxTouchPoints,
      (n.languages || []).join(","),
    ].join("|");

    sections.push({
      title: "Navigator / System",
      entropy: "~10 bits",
      rows: [
        { label: "User agent", value: n.userAgent },
        { label: "Platform", value: n.platform },
        { label: "Languages", value: (n.languages || []).join(", ") },
        { label: "Hardware threads", value: String(n.hardwareConcurrency) },
        {
          label: "Device memory (GB)",
          value: n.deviceMemory != null ? String(n.deviceMemory) : "hidden",
        },
        { label: "Touch points", value: String(n.maxTouchPoints) },
        { label: "Cookies enabled", value: String(n.cookieEnabled) },
      ],
    });
  }

  // ── client hints ────────────────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    if ("userAgentData" in navigator && navigator.userAgentData) {
      const ua = navigator.userAgentData;
      rows.push({
        label: "Mobile",
        value: String(ua.mobile),
      });
      rows.push({
        label: "Brands",
        value: (ua.brands || [])
          .map((b: { brand: string; version: string }) => `${b.brand} ${b.version}`)
          .join(", "),
      });
      try {
        const hi = await ua.getHighEntropyValues([
          "architecture",
          "bitness",
          "model",
          "platformVersion",
          "fullVersionList",
        ]);
        rows.push({
          label: "Architecture",
          value: `${hi.architecture} ${hi.bitness}`,
        });
        rows.push({
          label: "Platform version",
          value: hi.platformVersion,
        });
        rows.push({ label: "Model", value: hi.model || "—" });
        rows.push({
          label: "Full versions",
          value: (hi.fullVersionList || [])
            .map((b: { brand: string; version: string }) => `${b.brand} ${b.version}`)
            .join(", "),
        });
        data.ch = JSON.stringify(hi);
      } catch {
        rows.push({ label: "High-entropy", value: "blocked", status: "blocked" });
        data.ch = "blocked";
      }
    } else {
      rows.push({
        label: "userAgentData",
        value: "not present (Firefox/Safari)",
        status: "warn",
      });
      data.ch = "none";
    }
    sections.push({
      title: "Client Hints (Sec-CH-UA)",
      entropy: "~6 bits",
      rows,
    });
  }

  // ── screen / display ────────────────────────────────────────────────────

  {
    const s = screen;
    data.screen = [
      s.width,
      s.height,
      s.colorDepth,
      window.devicePixelRatio,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");

    sections.push({
      title: "Screen / Display",
      entropy: "~8 bits",
      rows: [
        { label: "Resolution", value: `${s.width} x ${s.height}` },
        { label: "Available", value: `${s.availWidth} x ${s.availHeight}` },
        { label: "Colour depth", value: String(s.colorDepth) },
        {
          label: "Device pixel ratio",
          value: String(window.devicePixelRatio),
        },
        {
          label: "Timezone",
          value: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        {
          label: "Locale",
          value: Intl.DateTimeFormat().resolvedOptions().locale,
        },
      ],
    });
  }

  // ── canvas fingerprint ──────────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    try {
      const c = document.createElement("canvas");
      c.width = 300;
      c.height = 70;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = '16px "Arial"';
        ctx.fillStyle = "#069";
        ctx.fillRect(2, 2, 180, 30);
        ctx.fillStyle = "#ff0066";
        ctx.fillText("GHOSTPRINT 👻 jash@1337", 4, 4);
        ctx.strokeStyle = "rgba(57,255,20,.6)";
        ctx.beginPath();
        ctx.arc(150, 35, 20, 0, 7);
        ctx.stroke();
        const url = c.toDataURL();
        const h = await sha256(url);
        data.canvas = h;
        rows.push({
          label: "Hash",
          value: `${h.slice(0, 32)}…`,
          status: "good",
        });
        rows.push({ label: "Render bytes", value: String(url.length) });
      } else {
        rows.push({ label: "Canvas", value: "no 2d context", status: "warn" });
        data.canvas = "blocked";
      }
    } catch {
      rows.push({ label: "Canvas", value: "blocked / spoofed", status: "bad" });
      data.canvas = "blocked";
    }
    sections.push({ title: "Canvas Fingerprint", entropy: "~15 bits", rows });
  }

  // ── webgl / gpu ─────────────────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    try {
      const c = document.createElement("canvas");
      const gl =
        c.getContext("webgl") || c.getContext("experimental-webgl");
      if (gl) {
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        const vendor = dbg
          ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
          : gl.getParameter(gl.VENDOR);
        const renderer = dbg
          ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
        rows.push({ label: "Vendor", value: vendor });
        rows.push({ label: "Renderer", value: renderer, status: "good" });
        const params = [
          gl.MAX_TEXTURE_SIZE,
          gl.MAX_VIEWPORT_DIMS,
          gl.MAX_RENDERBUFFER_SIZE,
          gl.MAX_VERTEX_ATTRIBS,
        ]
          .map((p) => gl.getParameter(p))
          .join(",");
        const exts = (gl.getSupportedExtensions() || []).join(",");
        data.webgl =
          `${vendor}|${renderer}|${params}|${await sha256(exts)}`;
        rows.push({ label: "Param set", value: params });
        rows.push({
          label: "Extensions",
          value: `${(gl.getSupportedExtensions() || []).length} supported`,
        });
      } else {
        rows.push({
          label: "WebGL",
          value: "unavailable",
          status: "warn",
        });
        data.webgl = "none";
      }
    } catch {
      rows.push({ label: "WebGL", value: "error", status: "bad" });
      data.webgl = "err";
    }
    sections.push({ title: "WebGL / GPU", entropy: "~13 bits", rows });
  }

  // ── webgpu adapter ──────────────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    if (!navigator.gpu) {
      rows.push({
        label: "WebGPU",
        value: "not exposed",
        status: "warn",
      });
      data.gpu = "none";
    } else {
      try {
        const ad = await navigator.gpu.requestAdapter();
        if (!ad) {
          rows.push({
            label: "Adapter",
            value: "null",
            status: "warn",
          });
          data.gpu = "null";
        } else {
          const info = ad.info || {};
          rows.push({
            label: "Vendor",
            value: (info as { vendor?: string }).vendor || "masked",
          });
          rows.push({
            label: "Architecture",
            value: (info as { architecture?: string }).architecture || "masked",
          });
          rows.push({
            label: "Description",
            value: (info as { description?: string }).description || "—",
          });
          data.gpu = JSON.stringify(info);
        }
      } catch {
        rows.push({
          label: "WebGPU",
          value: "error",
          status: "warn",
        });
        data.gpu = "err";
      }
    }
    sections.push({
      title: "WebGPU Adapter",
      entropy: "~9 bits · newest vector",
      rows,
    });
  }

  // ── audio fingerprint ───────────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    try {
      const Ctx =
        (window as unknown as Window &
          typeof globalThis & { OfflineAudioContext?: typeof OfflineAudioContext })
            .OfflineAudioContext ||
        (window as unknown as Window &
          typeof globalThis & { webkitOfflineAudioContext?: typeof OfflineAudioContext })
            .webkitOfflineAudioContext;
      if (Ctx) {
        const ac = new Ctx(1, 5000, 44100);
        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = 10000;
        const comp = ac.createDynamicsCompressor();
        osc.connect(comp);
        comp.connect(ac.destination);
        osc.start(0);
        const buf = await ac.startRendering();
        const ch = buf.getChannelData(0);
        let sum = 0;
        for (let i = 4000; i < 5000; i++) sum += Math.abs(ch[i]);
        const sig = sum.toString();
        data.audio = await sha256(sig);
        rows.push({
          label: "Hash",
          value: `${data.audio.slice(0, 32)}…`,
          status: "good",
        });
        rows.push({ label: "Sum", value: sig.slice(0, 18) });
      } else {
        rows.push({
          label: "Audio",
          value: "OfflineAudioContext not available",
          status: "warn",
        });
        data.audio = "blocked";
      }
    } catch {
      rows.push({
        label: "Audio",
        value: "blocked",
        status: "warn",
      });
      data.audio = "blocked";
    }
    sections.push({ title: "Audio Fingerprint", entropy: "~9 bits", rows });
  }

  // ── installed fonts probe ───────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    try {
      const base = ["monospace", "sans-serif", "serif"];
      const test = [
        "Arial",
        "Helvetica Neue",
        "Times New Roman",
        "Courier New",
        "Georgia",
        "Comic Sans MS",
        "Impact",
        "Tahoma",
        "Verdana",
        "Trebuchet MS",
        "Calibri",
        "Cambria",
        "Consolas",
        "Menlo",
        "SF Pro",
        "Segoe UI",
        "Roboto",
        "Ubuntu",
        "Noto Sans",
        "DejaVu Sans",
        "Liberation Sans",
        "JetBrains Mono",
        "Fira Code",
        "Andale Mono",
      ];
      const span = document.createElement("span");
      span.style.cssText =
        "position:absolute;left:-9999px;font-size:72px;white-space:nowrap";
      span.textContent = "mmmmmmmmmlli 0123";
      document.body.appendChild(span);
      try {
        const baseW: Record<string, { w: number; h: number }> = {};
        base.forEach((b) => {
          span.style.fontFamily = b;
          baseW[b] = { w: span.offsetWidth, h: span.offsetHeight };
        });
        const found: string[] = [];
        test.forEach((f) => {
          for (const b of base) {
            span.style.fontFamily = `"${f}",${b}`;
            if (
              span.offsetWidth !== baseW[b].w ||
              span.offsetHeight !== baseW[b].h
            ) {
              found.push(f);
              break;
            }
          }
        });
        data.fonts = found.join(",");
        rows.push({
          label: "Detected",
          value: `${found.length} / ${test.length}`,
        });
        rows.push({
          label: "List",
          value: found.join(", ") || "none",
        });
      } finally {
        document.body.removeChild(span);
      }
    } catch {
      rows.push({ label: "Font probe", value: "blocked / unavailable", status: "warn" });
      data.fonts = "";
    }
    sections.push({
      title: "Installed Fonts (Probe)",
      entropy: "~12 bits",
      rows,
    });
  }

  // ── automation tells ────────────────────────────────────────────────────

  {
    const rows: SignalRow[] = [];
    let wd: boolean | null | undefined = undefined;
    try { wd = navigator.webdriver; } catch { /* not available */ }
    rows.push({
      label: "navigator.webdriver",
      value: wd != null ? String(wd) : "not supported",
      status: wd ? "bad" : "good",
    });
    if (wd) botFlags.push("webdriver=true");

    const headlessUA = /headless/i.test(navigator.userAgent);
    rows.push({
      label: "Headless in UA",
      value: String(headlessUA),
      status: headlessUA ? "bad" : "good",
    });
    if (headlessUA) botFlags.push("headless UA");

    let chrome = false;
    try { chrome = !!(window as any).chrome; } catch { /* not available */ }
    const isChromeUA =
      /chrome/i.test(navigator.userAgent) &&
      !/edg|opr/i.test(navigator.userAgent);
    if (isChromeUA) {
      rows.push({
        label: "window.chrome present",
        value: String(chrome),
        status: chrome ? "good" : "warn",
      });
      if (!chrome) botFlags.push("chrome obj missing");
    }

    const langs = (navigator.languages || []).length;
    rows.push({
      label: "Languages count",
      value: String(langs),
      status: langs ? "good" : "bad",
    });
    if (!langs) botFlags.push("no languages");

    const plugins = (navigator.plugins || []).length;
    rows.push({
      label: "Plugins",
      value: String(plugins),
    });

    // CDP console probe
    const cdpStack = (() => {
      let leak = false;
      const e = new Error();
      const o: Record<string, string> = {};
      Object.defineProperty(o, "stack", {
        get() {
          leak = true;
          return "";
        },
      });
      console.debug(o);
      return leak;
    })();
    rows.push({
      label: "CDP console probe",
      value: cdpStack ? "tripped" : "clean",
      status: cdpStack ? "bad" : "good",
    });
    if (cdpStack) botFlags.push("CDP attach hint");

    sections.push({
      title: "Automation Tells",
      entropy: "the part that matters",
      rows,
    });
  }

  // ── verdict ────────────────────────────────────────────────────────────

  let risk = botFlags.length * 28;
  if (data.canvas === "blocked") risk += 20;
  if (data.webgl === "none" || data.webgl === "err") risk += 15;
  if ((data.fonts?.split(",").filter(Boolean).length || 0) < 3) risk += 12;
  risk = Math.min(99, risk);

  let verdict: VerdictLevel;
  let verdictLabel: string;
  if (risk < 25) {
    verdict = "human";
    verdictLabel = "LIKELY HUMAN";
  } else if (risk < 60) {
    verdict = "suspicious";
    verdictLabel = "SUSPICIOUS";
  } else {
    verdict = "bot";
    verdictLabel = "LIKELY BOT";
  }

  // Compute visitor ID from all collected signals (deterministic key order)
  const allValues = Object.keys(data).sort().map((k) => data[k]).join("::");
  let visitorId = "";
  try { visitorId = await sha256(allValues); } catch { visitorId = "sha256-fallback-" + Date.now().toString(16); }

  return {
    sections,
    visitorId,
    riskScore: risk,
    verdict,
    verdictLabel,
    botFlags,
  };
}

// ── Brand glyph ─────────────────────────────────────────────────────────────

function FingerprintBrandGlyph() {
  return (
    <>
      <circle cx="16" cy="14" r="8" fill="none" stroke="#2f9d8d" strokeWidth="2.2" />
      <path
        d="M8 6 C8 2 24 2 24 6 L24 26 C24 30 8 30 8 26 Z"
        fill="none"
        stroke="#e8b04b"
        strokeWidth="1.8"
      />
      <line x1="10" y1="12" x2="22" y2="12" stroke="#2f9d8d" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="18" x2="18" y2="18" stroke="#d9594c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="14" r="2" fill="#fafafa" />
    </>
  );
}

// ── Section card component ──────────────────────────────────────────────────

function SectionCard({
  section,
  index,
}: {
  section: FingerprintSection;
  index: number;
}) {
  const [open, setOpen] = useState(index < 3); // first 3 open by default
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="fp-section">
      <button
        type="button"
        className="fp-section-header"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="fp-section-title">{section.title}</span>
        <span className="fp-section-entropy">{section.entropy}</span>
        <span className="fp-section-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="fp-section-body">
          {section.rows.map((row, ri) => (
            <div className="fp-row" key={ri}>
              <span className="fp-row-label">{row.label}</span>
              <span className={`fp-row-value${row.status ? ` fp-${row.status}` : ""}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────

export function App() {
  const [data, setData] = useState<FingerprintData | null>(null);
  const [scanning, setScanning] = useState(true);
  const [copied, setCopied] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    collectFingerprint()
      .then((result) => {
        setData(result);
        setScanning(false);
      })
      .catch((e) => {
        console.error("Fingerprint collection failed:", e);
        setData(null);
        setScanning(false);
      });
  }, []);

  const handleRescan = useCallback(() => {
    hasRun.current = false;
    setScanning(true);
    setData(null);
    collectFingerprint()
      .then((result) => {
        setData(result);
        setScanning(false);
      })
      .catch((e) => {
        console.error("Fingerprint collection failed:", e);
        setData(null);
        setScanning(false);
      });
  }, []);

  const handleCopyId = useCallback(async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.visitorId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [data]);

  const verdictColor =
    data?.verdict === "human"
      ? "var(--accent)"
      : data?.verdict === "suspicious"
        ? "#ffb000"
        : "#d9594c";

  return (
    <div className="app-root">
      <Header
        title="Browser Fingerprint"
        subtitle="what the anti-bot stack reads off your browser"
        brandMark={
          <BrandMark label="Fingerprint Scanner">
            <FingerprintBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* Verdict card */}
        <div className="card fp-verdict">
          {scanning ? (
            <div className="fp-verdict-scanning">Scanning browser signals…</div>
          ) : data ? (
            <>
              <div className="fp-verdict-header">
                <span className="fp-verdict-label">DETECTOR VERDICT</span>
                <span
                  className="fp-verdict-score"
                  style={{ color: verdictColor }}
                >
                  {data.riskScore}% bot · {data.verdictLabel}
                </span>
              </div>
              <div className="fp-verdict-bar">
                <div
                  className="fp-verdict-bar-fill"
                  style={{ width: `${Math.max(6, data.riskScore)}%` }}
                />
              </div>
              <div className="fp-verdict-flags">
                {data.botFlags.length > 0
                  ? `Tripped: ${data.botFlags.join(" · ")}`
                  : "No automation tells fired — you read as a real browser"}
              </div>
              <div className="fp-verdict-id">
                <span className="fp-verdict-id-label">Visitor ID</span>
                <code className="fp-verdict-id-value">
                  {data.visitorId.slice(0, 40)}…
                </code>
                <button
                  type="button"
                  className="fp-verdict-id-copy"
                  onClick={handleCopyId}
                  title={copied ? "Copied!" : "Copy visitor ID"}
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
            </>
          ) : (
            <div className="fp-verdict-scanning">Error collecting signals</div>
          )}
        </div>

        {/* Rescan button */}
        <div className="fp-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleRescan}
            disabled={scanning}
          >
            {scanning ? "Scanning…" : "Rescan"}
          </button>
        </div>

        {/* Fingerprint sections */}
        {data ? (
          data.sections.map((section, i) => (
            <SectionCard key={i} section={section} index={i} />
          ))
        ) : scanning ? (
          <div className="card">
            <div className="fp-scanning-detail">
              Collecting canvas fingerprint…
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="fp-scanning-detail">
              Failed to collect fingerprint data.
            </div>
          </div>
        )}

        {/* Privacy note */}
        <p className="fp-privacy-note">
          All fingerprinting runs locally in your browser. Nothing is sent
          anywhere. No upload, no tracking, no account needed.
        </p>
      </main>

      <Footer blurb="Browser fingerprint scanner · client-side only · ported from ghostprint" />
    </div>
  );
}
