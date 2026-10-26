import React, { useEffect, useState, memo } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  SlidersHorizontal,
  Settings as SettingsIcon,
  Swords,
  Radio,
  Copy,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  catalog,
  defaultLineup,
  lineupSchema,
  remaining,
  type Row,
  type Settings,
} from "@rift/shared";
import { useRift, makeCommand, now, init } from "./store";
import "./style.css";
const asset = (kind: string, id: string) => `./assets/${kind}/${id}.png`;
const roles = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];
const Spell = memo(function Spell({ row, slot }: { row: Row; slot: 0 | 1 }) {
  const timer = useRift((s) => s.state.timers[`${row.id}:${slot}`]),
    settings = useRift((s) => s.settings),
    command = useRift((s) => s.command),
    blocked = useRift((s) => s.blocked);
  const [tick, setTick] = useState(now()),
    [menu, setMenu] = useState(false),
    [adjust, setAdjust] = useState(-10);
  useEffect(() => {
    setTick(now());
    if (!timer || timer.endsAt <= now()) return;
    const t = setInterval(() => {
      setTick(now());
      if (timer.endsAt <= now()) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [timer]);
  const spell = catalog.spells.find((s) => s.id === row.spells[slot])!,
    ms = remaining(timer, tick),
    seconds = Math.ceil(ms / 1000),
    active = ms > 0 && !blocked;
  return (
    <div className="spell-wrap">
      <button
        disabled={blocked}
        className={`spell ${active ? "cooling" : ""}`}
        style={
          {
            width: settings.spellSize,
            height: settings.spellSize,
            "--progress": `${active ? (ms / timer!.duration) * 100 : 0}%`,
            "--timer-color": settings.color,
          } as React.CSSProperties
        }
        title={`${spell.name} · ${spell.seconds}s base${spell.complex ? " · variable mechanic estimate" : ""}. Right-click for actions.`}
        aria-label={`${row.champion} ${spell.name}`}
        onClick={() => command(makeCommand("start", row.id, slot))}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(!menu);
        }}
      >
        <img src={asset("spell", spell.id)} alt={spell.name} />
        {active ? (
          <>
            <span className="shade" />
            <strong style={{ fontSize: settings.fontSize }}>
              {timer.estimate ? "~" : ""}
              {seconds >= 60
                ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
                : seconds}
            </strong>
            <i />
          </>
        ) : (
          <span className="ready-dot" />
        )}
      </button>
      {menu && (
        <div className="context" role="menu">
          <b>{spell.name}</b>
          {(["reset", "ready", "undo"] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => {
                command(makeCommand(kind, row.id, slot));
                setMenu(false);
              }}
            >
              {kind === "reset"
                ? "Reset cooldown"
                : kind === "ready"
                  ? "Mark ready"
                  : "Undo previous action"}
            </button>
          ))}
          <label>
            Adjust seconds
            <input
              type="number"
              min="-3600"
              max="3600"
              value={adjust}
              onChange={(e) => setAdjust(Number(e.target.value))}
            />
          </label>
          <button
            onClick={() => {
              command(makeCommand("adjust", row.id, slot, adjust));
              setMenu(false);
            }}
          >
            Apply adjustment
          </button>
          <button onClick={() => setMenu(false)}>Close</button>
        </div>
      )}
    </div>
  );
});
function Overlay({ preview = false }: { preview?: boolean }) {
  const rows = useRift((s) => s.state.lineup),
    s = useRift((s) => s.settings),
    blocked = useRift((s) => s.blocked);
  return (
    <div
      className={`overlay ${s.background ? "" : "no-bg"}`}
      style={{
        zoom: s.scale,
        padding: 12,
        rowGap: s.spacing,
        opacity: preview ? s.opacity : 1,
      }}
    >
      <header className={s.locked ? "" : "drag"}>
        <span className="brand-gem">◇</span>
        <b>
          RIFT<span>TIMERS</span>
        </b>
        <small>SIM</small>
      </header>
      {blocked ? (
        <p className="warning">Simulation paused</p>
      ) : (
        rows.map((row, i) => (
          <div className="overlay-row" key={row.id}>
            <div className="portrait">
              <img
                style={{ width: s.portraitSize, height: s.portraitSize }}
                src={asset("champion", row.champion)}
                alt={row.champion}
              />
              <small>{roles[i]}</small>
            </div>
            <Spell row={row} slot={0} />
            <Spell row={row} slot={1} />
          </div>
        ))
      )}
      <footer>STANDALONE SIMULATION</footer>
    </div>
  );
}
function Lineup() {
  const { state, command } = useRift(),
    [preset, setPreset] = useState(""),
    [presets, setPresets] = useState<Record<string, Row[]>>(() => {
      try {
        return JSON.parse(localStorage.getItem("rift-presets") ?? "{}");
      } catch {
        return {};
      }
    });
  const update = (lineup: Row[]) =>
    command({
      kind: "lineup",
      id: crypto.randomUUID(),
      revision: state.revision,
      lineup,
    });
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Champion setup</h2>
          <p>
            Build your five-champion simulation. Lineup changes clear active
            timers.
          </p>
        </div>
        <button onClick={() => update(defaultLineup())}>
          <RotateCcw size={15} />
          Reset lineup
        </button>
      </div>
      <datalist id="champions">
        {catalog.champions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </datalist>
      {state.lineup.map((row, i) => (
        <div className="setup-row panel" key={row.id}>
          <span className="role">{roles[i]}</span>
          <img src={asset("champion", row.champion)} alt="" />
          <label>
            Champion
            <input
              key={row.champion}
              list="champions"
              defaultValue={row.champion}
              onBlur={(e) => {
                const c = catalog.champions.find(
                  (c) =>
                    c.id.toLowerCase() === e.target.value.toLowerCase() ||
                    c.name.toLowerCase() === e.target.value.toLowerCase(),
                );
                if (c && c.id !== row.champion)
                  update(
                    state.lineup.map((r) =>
                      r.id === row.id ? { ...r, champion: c.id } : r,
                    ),
                  );
                else e.target.value = row.champion;
              }}
            />
          </label>
          {([0, 1] as const).map((slot) => (
            <label key={slot}>
              Spell {slot + 1}
              <select
                value={row.spells[slot]}
                onChange={(e) =>
                  update(
                    state.lineup.map((r) => {
                      if (r.id !== row.id) return r;
                      const spells: [string, string] = [...r.spells];
                      spells[slot] = e.target.value;
                      return { ...r, spells };
                    }),
                  )
                }
              >
                {catalog.spells.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="haste">
            Spell haste
            <input
              type="number"
              min="0"
              max="500"
              placeholder="Unknown"
              value={row.haste ?? ""}
              onChange={(e) =>
                update(
                  state.lineup.map((r) =>
                    r.id === row.id
                      ? {
                          ...r,
                          haste:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }
                      : r,
                  ),
                )
              }
            />
          </label>
          <div className="reorder">
            {[-1, 1].map((d) => (
              <button
                key={d}
                aria-label={`Move ${row.champion} ${d < 0 ? "up" : "down"}`}
                disabled={i + d < 0 || i + d > 4}
                onClick={() => {
                  const rows = [...state.lineup];
                  [rows[i], rows[i + d]] = [rows[i + d], rows[i]];
                  update(rows);
                }}
              >
                {d < 0 ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="panel preset">
        <h3>Lineup presets</h3>
        <input
          placeholder="Preset name"
          maxLength={32}
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        />
        <button
          disabled={!preset.trim()}
          onClick={() => {
            const next = { ...presets, [preset.trim()]: state.lineup };
            setPresets(next);
            localStorage.setItem("rift-presets", JSON.stringify(next));
            setPreset("");
          }}
        >
          Save preset
        </button>
        {Object.entries(presets).map(([name, rows]) => (
          <button
            key={name}
            onClick={() => {
              const p = lineupSchema.safeParse(rows);
              if (p.success) update(p.data);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="note">
        Leave haste blank when unknown. Smite charge recharge and Teleport
        upgrades are estimates; adjust manually for your scenario.
      </p>
    </>
  );
}
function Multiplayer() {
  const { code, status, members, enter, leave } = useRift(),
    [name, setName] = useState("Player"),
    [join, setJoin] = useState(""),
    [copied, setCopied] = useState(false);
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Better, together.</h2>
          <p>One simulation. Every timer in sync.</p>
        </div>
        <span className="badge">
          <Radio size={13} />
          {status}
        </span>
      </div>
      <div className="two-cols">
        <section className="panel">
          <div className="section-icon">
            <Users />
          </div>
          <h3>Your private room</h3>
          <p>
            Invite friends to a standalone test session. No League match
            required.
          </p>
          {code ? (
            <>
              <div className="room-code">{code}</div>
              <button
                className="primary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(code)
                    .then(() => setCopied(true))
                    .catch(() =>
                      useRift
                        .getState()
                        .setError(
                          "Clipboard unavailable. Copy the displayed code manually.",
                        ),
                    )
                }
              >
                <Copy size={16} />
                {copied ? "Copied" : "Copy room code"}
              </button>
              <button onClick={leave}>Leave room</button>
            </>
          ) : (
            <>
              <label>
                Display name
                <input
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={!name.trim()}
                onClick={() => enter(name)}
              >
                Create simulation room
              </button>
              <div className="divider">OR JOIN FRIENDS</div>
              <label>
                Six-character invite code
                <input
                  className="code-input"
                  placeholder="ABC234"
                  maxLength={6}
                  value={join}
                  onChange={(e) => setJoin(e.target.value.toUpperCase())}
                />
              </label>
              <button
                disabled={!/^[A-Z2-9]{6}$/.test(join) || !name.trim()}
                onClick={() => enter(name, join)}
              >
                Join room
              </button>
            </>
          )}
        </section>
        <section className="panel">
          <h3>
            Participants <span className="count">{members.length}</span>
          </h3>
          {members.length ? (
            members.map((m) => (
              <div className="member" key={m.id}>
                <div className="avatar">{m.name.slice(0, 1).toUpperCase()}</div>
                <b>{m.name}</b>
                <span className={m.online ? "green" : "muted"}>
                  {m.online ? "Connected" : "Reconnecting"}
                </span>
              </div>
            ))
          ) : (
            <div className="empty">
              <Users size={34} />
              <p>Your party starts here.</p>
              <small>Create or join a room to connect.</small>
            </div>
          )}
          <p className="note">
            Room codes are private invitations. Up to 10 participants. Rooms
            expire after 2 hours without changes.
          </p>
        </section>
      </div>
    </>
  );
}
function OverlaySettings() {
  const { settings: s, save } = useRift();
  const ranges: [keyof Settings, string, number, number, number][] = [
    ["scale", "Overlay scale", 0.65, 1.6, 0.05],
    ["opacity", "Window opacity", 0.3, 1, 0.05],
    ["portraitSize", "Portrait size", 24, 64, 2],
    ["spellSize", "Spell size", 28, 64, 2],
    ["spacing", "Row spacing", 2, 24, 1],
    ["fontSize", "Timer font size", 12, 28, 1],
  ];
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Make it yours.</h2>
          <p>A compact overlay that fits your desktop.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          {ranges.map(([key, label, min, max, step]) => (
            <label className="slider" key={key}>
              <span>
                {label}
                <b>{s[key]}</b>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={s[key] as number}
                onChange={(e) =>
                  void save({ ...s, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          {(["background", "locked"] as const).map((key) => (
            <label className="toggle" key={key}>
              {key === "background"
                ? "Show panel background"
                : "Lock overlay position"}
              <input
                type="checkbox"
                checked={s[key]}
                onChange={(e) => void save({ ...s, [key]: e.target.checked })}
              />
            </label>
          ))}
          <label className="toggle">
            Cooldown color
            <input
              type="color"
              value={s.color}
              onChange={(e) => void save({ ...s, color: e.target.value })}
            />
          </label>
          <label>
            Show / hide shortcut
            <input
              defaultValue={s.hotkey}
              onBlur={(e) => void save({ ...s, hotkey: e.target.value })}
            />
          </label>
          <div className="position">
            {(["x", "y"] as const).map((k) => (
              <label key={k}>
                {k.toUpperCase()} position
                <input
                  type="number"
                  defaultValue={s[k] ?? 0}
                  onBlur={(e) =>
                    void save({
                      ...s,
                      [k]: Number(e.target.value),
                      [k === "x" ? "y" : "x"]: s[k === "x" ? "y" : "x"] ?? 0,
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <div className="preview-stage">
          <Overlay preview />
          <span className="preview-caption">LIVE PREVIEW · CLICK TO TEST</span>
        </div>
      </div>
    </>
  );
}
function General() {
  const { settings: s, save, code } = useRift(),
    [version, setVersion] = useState("0.1.0"),
    [update, setUpdate] = useState("");
  useEffect(() => {
    void window.rift?.version().then(setVersion);
  }, []);
  return (
    <>
      <div className="section-title">
        <div>
          <h2>General settings</h2>
          <p>Desktop preferences and connection details.</p>
        </div>
      </div>
      <section className="panel general">
        {(["startup", "tray", "debug"] as const).map((k) => (
          <label className="toggle" key={k}>
            {
              {
                startup: "Launch on Windows startup",
                tray: "Minimize to system tray",
                debug: "Debug logging (local console only)",
              }[k]
            }
            <input
              type="checkbox"
              checked={s[k]}
              onChange={(e) => void save({ ...s, [k]: e.target.checked })}
            />
          </label>
        ))}
        <label>
          Simulation server address
          <input
            disabled={!!code}
            defaultValue={s.server}
            onBlur={(e) => void save({ ...s, server: e.target.value })}
          />
        </label>
        <p className="note">
          Use HTTPS for a hosted server. Leave your room before changing
          servers.
        </p>
        <div className="version">
          <span>
            RiftTimers <b>v{version}</b>
          </span>
          <button
            onClick={() =>
              setUpdate(
                "This prototype has no published update feed. Install a newer signed release manually when one is available.",
              )
            }
          >
            Check for updates
          </button>
        </div>
        {update && <p className="note">{update}</p>}
      </section>
      <section className="panel compliance">
        <ShieldCheck />
        <div>
          <h3>Simulation by design</h3>
          <p>
            Live-match integration is disabled. Use only outside League matches.
            The desktop simulator pauses when the League game process is
            detected.
          </p>
          <p>
            Data Dragon {catalog.patch} · {catalog.champions.length} champions ·
            locally cached assets
          </p>
          <small>
            RiftTimers is not endorsed by Riot Games and does not reflect the
            views or opinions of Riot Games or anyone officially involved in
            producing or managing Riot Games properties. Riot Games and all
            associated properties are trademarks or registered trademarks of
            Riot Games, Inc.
          </small>
        </div>
      </section>
    </>
  );
}
function Dashboard({ navigate }: { navigate: (s: string) => void }) {
  const { state, status, code, members, blocked } = useRift();
  return (
    <>
      <div className="section-title">
        <div>
          <div className="eyebrow">YOUR SIMULATION WORKSPACE</div>
          <h1>Every second counts.</h1>
          <p>Set the lineup. Start a timer. Stay in sync.</p>
        </div>
        <span className="badge">
          <span className="status-dot" />
          Standalone mode
        </span>
      </div>
      <div className="stats">
        <div className="panel">
          <span>SESSION MODE</span>
          <b>
            Simulation <ShieldCheck size={17} />
          </b>
          <small>Live integration disabled</small>
        </div>
        <div className="panel">
          <span>PARTY STATUS</span>
          <b>
            {code || "Flying solo"} <Users size={17} />
          </b>
          <small>
            {code
              ? `${members.filter((m) => m.online).length} connected participants`
              : status}
          </small>
        </div>
        <div className="panel">
          <span>GAME DATA</span>
          <b>Patch {catalog.patch}</b>
          <small>Riot Data Dragon · cached locally</small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel lineup-card">
          <div className="card-heading">
            <h3>
              Enemy lineup <span className="count">5</span>
            </h3>
            <button
              className="text-button"
              onClick={() => navigate("Champion Setup")}
            >
              Edit lineup <ExternalLink size={13} />
            </button>
          </div>
          <div className="table-labels">
            <span>CHAMPION</span>
            <span>SUMMONER SPELLS</span>
            <span>MODIFIERS</span>
          </div>
          {state.lineup.map((r, i) => (
            <div className="dashboard-row" key={r.id}>
              <img src={asset("champion", r.champion)} alt="" />
              <div className="champion-name">
                <b>
                  {catalog.champions.find((c) => c.id === r.champion)?.name}
                </b>
                <small>{roles[i]}</small>
              </div>
              <div className="spell-pair">
                <Spell row={r} slot={0} />
                <Spell row={r} slot={1} />
              </div>
              <span className="estimate">
                {r.haste === null ? "Unknown haste" : `${r.haste} haste`}
              </span>
            </div>
          ))}
          <div className="card-bottom">
            <span className="status-dot" />
            Click a spell to start · Right-click for timer actions
          </div>
        </section>
        <section className="panel overlay-card">
          <div className="card-heading">
            <h3>Desktop overlay</h3>
            <span className="badge small">PREVIEW</span>
          </div>
          <div className="preview-stage">
            <Overlay preview />
          </div>
          <button
            className="primary wide"
            disabled={blocked}
            onClick={() => {
              if (window.rift) void window.rift.overlay(true);
              else
                useRift
                  .getState()
                  .setError(
                    "The transparent desktop overlay is available in the Electron app. This browser shows the interactive preview.",
                  );
            }}
          >
            <Eye size={16} />
            Open simulation overlay
          </button>
          <button
            className="wide"
            onClick={() => void window.rift?.overlay(false)}
          >
            <EyeOff size={15} />
            Hide overlay
          </button>
        </section>
      </div>
      <div className="bottom-callout">
        <ShieldCheck size={20} />
        <div>
          <b>A space to test, outside the Rift.</b>
          <p>
            All timers are manual simulation estimates. No game connection,
            account access, or live competitive tracking.
          </p>
        </div>
        <button onClick={() => navigate("Multiplayer")}>
          Invite friends →
        </button>
      </div>
    </>
  );
}
function App() {
  const [page, setPage] = useState("Dashboard"),
    { error, setError, blocked, status } = useRift();
  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Multiplayer", Users],
    ["Champion Setup", Swords],
    ["Overlay Settings", SlidersHorizontal],
    ["General Settings", SettingsIcon],
  ] as const;
  if (location.hash === "#overlay") return <Overlay />;
  return (
    <div className="app">
      <aside>
        <div className="logo">
          <span>◇</span>
          <div>
            RIFT<b>TIMERS</b>
            <small>THE SIMULATION COMPANION</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              className={page === name ? "selected" : ""}
              key={name}
              onClick={() => setPage(name)}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <span className="status-dot" /> {status}
          </div>
          <small>RiftTimers / v0.1.0</small>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>
            Workspace <span>/</span> <b>{page}</b>
          </span>
          <div>
            <span className="sim-tag">SIMULATION ONLY</span>
            <span className="avatar">RT</span>
          </div>
        </div>
        <div className="content">
          {blocked && (
            <div className="warning">
              Simulation paused: League is running, or the process safety check
              is unavailable.
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {page === "Dashboard" ? (
            <Dashboard navigate={setPage} />
          ) : page === "Multiplayer" ? (
            <Multiplayer />
          ) : page === "Champion Setup" ? (
            <Lineup />
          ) : page === "Overlay Settings" ? (
            <OverlaySettings />
          ) : (
            <General />
          )}
        </div>
      </main>
    </div>
  );
}
if (location.hash === "#overlay") document.body.classList.add("overlay-body");
void init();
useRift.subscribe((s) => {
  if (s.settings.debug)
    console.debug("[RiftTimers]", {
      revision: s.state.revision,
      status: s.status,
    });
});
createRoot(document.getElementById("root")!).render(<App />);
