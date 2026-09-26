import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

type FighterName = "DC" | "Wizz";
type Hud = { playerHp: number; enemyHp: number; timer: number; combo: number; playerMeter: number; enemyMeter: number; playerName: string; enemyName: string };
const initialHud: Hud = { playerHp: 100, enemyHp: 100, timer: Infinity, combo: 0, playerMeter: 0, enemyMeter: 0, playerName: "DC", enemyName: "WIZZ" };
const controls = [["1", "PUÑO L"], ["2", "PUÑO F"], ["3", "PATADA L"], ["4", "PATADA F"], ["5", "SALTO"], ["6", "ESQUIVA"]] as const;
const roster: { name: FighterName; subtitle: string; color: string; portrait: string; image: string }[] = [
  { name: "DC", subtitle: "EL JUGADOR", color: "blue", portrait: "D", image: "/manus-storage/dchd-08_c5c1b98b.png" },
  { name: "Wizz", subtitle: "EL CICLISTA", color: "red", portrait: "W", image: "/manus-storage/wizzhd-09_fe1d7bb9.png" },
];
function press(key: string) { window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true })), 110); }

class ArcadeAudio {
  private context: AudioContext | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  private ensure() { if (!this.context) { const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AudioCtor) return null; this.context = new AudioCtor(); } if (this.context.state === "suspended") void this.context.resume(); return this.context; }
  private tone(frequency: number, duration = .08, type: OscillatorType = "square", volume = .035, when = 0) { const ctx = this.ensure(); if (!ctx) return; const start = ctx.currentTime + when; const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); oscillator.connect(gain).connect(ctx.destination); oscillator.start(start); oscillator.stop(start + duration + .02); }
  startMusic() { const ctx = this.ensure(); if (!ctx || this.musicTimer !== null) return; const bass = [110, 110, 146.83, 130.81, 98, 98, 130.81, 123.47]; const lead = [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88]; this.musicTimer = window.setInterval(() => { const index = this.step++ % bass.length; this.tone(bass[index], .17, "sawtooth", .018); this.tone(lead[index], .09, "square", .014, .03); if (index % 2 === 0) this.tone(55, .05, "triangle", .025); }, 190); }
  select() { this.startMusic(); this.tone(520, .06, "square", .045); this.tone(780, .09, "square", .035, .055); }
  confirm() { this.startMusic(); [392, 523.25, 659.25, 783.99].forEach((frequency, index) => this.tone(frequency, .12, "square", .05, index * .075)); }
  action(index: number) { this.startMusic(); const notes = [220, 246.94, 293.66, 329.63, 440, 174.61]; this.tone(notes[index] ?? 220, .06, index === 5 ? "triangle" : "square", .04); }
  dispose() { if (this.musicTimer !== null) window.clearInterval(this.musicTimer); this.musicTimer = null; void this.context?.close(); this.context = null; }
}

function CharacterSelect({ onStart, audio }: { onStart: (player: FighterName, enemy: FighterName) => void; audio: ArcadeAudio }) {
  const [player, setPlayer] = useState<FighterName>("DC");
  const [enemy, setEnemy] = useState<FighterName>("Wizz");
  const [activeSide, setActiveSide] = useState<"player" | "enemy">("player");
  const choose = (name: FighterName) => { audio.select(); if (activeSide === "player") { setPlayer(name); if (name === enemy) setEnemy(name === "DC" ? "Wizz" : "DC"); } else { setEnemy(name); if (name === player) setPlayer(name === "DC" ? "Wizz" : "DC"); } };
  return <main className="select-screen" onPointerDown={() => audio.startMusic()}><div className="select-scanlines" /><header className="select-header"><span className="select-kicker">DC LABORATORIO PRESENTA</span><h1>DCM<span>2000</span></h1><div className="select-subtitle">SELECCIONA TU LUCHADOR</div><div className="audio-status">♫ AUDIO ARCADE · TOCA PARA ACTIVAR</div></header><div className="versus-select"><div className={`selection-slot ${activeSide === "player" ? "active" : ""}`} onClick={() => setActiveSide("player")}><span>JUGADOR 1</span><strong>{player}</strong></div><div className="versus-mark">VS</div><div className={`selection-slot rival ${activeSide === "enemy" ? "active" : ""}`} onClick={() => setActiveSide("enemy")}><span>RIVAL CPU</span><strong>{enemy.toUpperCase()}</strong></div></div><section className="roster-grid" aria-label="Selección de personajes">{roster.map((fighter) => <button key={fighter.name} className={`roster-card ${fighter.color} ${player === fighter.name ? "player-picked" : ""} ${enemy === fighter.name ? "enemy-picked" : ""}`} onClick={() => choose(fighter.name)}><div className="roster-portrait"><img src={fighter.image} alt={`${fighter.name} sprite`} /> </div><div className="roster-name">{fighter.name}</div><small>{fighter.subtitle}</small><div className="pick-badges">{player === fighter.name && <b>P1</b>}{enemy === fighter.name && <b>CPU</b>}</div></button>)}</section><div className="select-instructions"><span>HAZ CLIC EN UNA TARJETA PARA ELEGIR</span><span>•</span><span>DC Y WIZZ SON LOS LUCHADORES DISPONIBLES DEL PROTOTIPO</span></div><button className="start-battle" onClick={() => { audio.confirm(); onStart(player, enemy); }}>INICIAR BATALLA <b>▶</b></button><p className="select-disclaimer">Prototipo en desarrollo · no es la versión original</p></main>;
}

function FightCanvas({ playerName, enemyName, onBack, audio }: { playerName: FighterName; enemyName: FighterName; onBack: () => void; audio: ArcadeAudio }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const startedRef = useRef(false); const [hud, setHud] = useState(initialHud);
  useEffect(() => { const onHud = (event: Event) => setHud((event as CustomEvent<Hud>).detail); window.addEventListener("battle-hud", onHud); return () => window.removeEventListener("battle-hud", onHud); }, []);
  useEffect(() => { const canvas = canvasRef.current; if (!canvas || startedRef.current) return; startedRef.current = true; const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true, alpha: true }); let handle: GameHandle | null = null; createGameScene(engine, canvas, { playerName, enemyName }).then((next) => { handle = next; engine.runRenderLoop(() => next.scene.render()); }); const onResize = () => engine.resize(); window.addEventListener("resize", onResize); return () => { window.removeEventListener("resize", onResize); handle?.dispose(); engine.dispose(); startedRef.current = false; }; }, [playerName, enemyName]);
  return <main className="arcade-frame" onPointerDown={() => audio.startMusic()}><canvas ref={canvasRef} className="fixed inset-0 h-full w-full outline-none" style={{ touchAction: "none" }} /><section className="arcade-ui" aria-label="Demo jugable DC Laboratorio"><a className="lab-card" href="/" aria-label="Abrir la selección DCM2000"><div className="lab-eyebrow">DC LABORATORIO · DEMO</div><div className="lab-logo">DC<span>M2000</span></div><div className="lab-coming">PRÓXIMAMENTE</div><div className="lab-caption">Prototipo arcade en desarrollo</div><div className="lab-features"><span>{playerName} VS {enemyName.toUpperCase()}</span><span>6 BOTONES · VIDA ∞</span><span>3 BOTONES = ESPECIALES</span><span>SPRITES HD · TRANSPARENTES</span></div><p>Interfaz arcade de equipos y combate de demostración.</p><p>Este demo no es la versión original. Es un prototipo en desarrollo y promete ser un éxito.</p><strong className="lab-cta">TOCA PARA ELEGIR PERSONAJE</strong></a><button className="back-to-select" onClick={() => { audio.select(); onBack(); }}>SELECCIÓN</button><header className="arcade-topbar"><div className="team-block"><div className="portrait portrait-dc">{playerName === "DC" ? "D" : "W"}</div><div className="team-copy"><strong>{hud.playerName}</strong><span>{playerName} · JUGADOR</span></div></div><div className="health-stack"><div className="health-row"><span className="health-label">VIDA ∞</span><div className="health-track"><div className="health-fill player-fill" style={{ width: "100%" }} /></div></div><div className="meter-row"><span>ENERGÍA</span><div className="meter-track"><div className="meter-fill player-meter" style={{ width: `${hud.playerMeter}%` }} /></div></div></div><div className="round-timer">∞</div><div className="health-stack right-stack"><div className="health-row"><div className="health-track"><div className="health-fill enemy-fill" style={{ width: "100%" }} /></div><span className="health-label">∞ VIDA</span></div><div className="meter-row"><div className="meter-track"><div className="meter-fill enemy-meter" style={{ width: `${hud.enemyMeter}%` }} /></div><span>ENERGÍA</span></div></div><div className="team-block right-team"><div className="team-copy right-copy"><strong>{hud.enemyName}</strong><span>{enemyName.toUpperCase()} · CPU</span></div><div className="portrait portrait-wizz">{enemyName === "Wizz" ? "W" : "D"}</div></div></header><footer className="six-button-bar">{controls.map(([key, label], index) => <button key={key} className={`action-button action-${index + 1}`} onPointerDown={() => { audio.action(index); press(key); }}><b>{key}</b><small>{label}</small></button>)}</footer></section></main>;
}

export default function GameCanvas() {
  const demoMode = new URLSearchParams(window.location.search).has("demo");
  const audioRef = useRef<ArcadeAudio | null>(null);
  if (!audioRef.current) audioRef.current = new ArcadeAudio();
  useEffect(() => () => audioRef.current?.dispose(), []);
  const [screen, setScreen] = useState<"select" | "fight">(demoMode ? "fight" : "select");
  const [matchup, setMatchup] = useState<{ player: FighterName; enemy: FighterName }>({ player: "DC", enemy: "Wizz" });
  const audio = audioRef.current;
  if (screen === "select") return <CharacterSelect audio={audio} onStart={(player, enemy) => { setMatchup({ player, enemy }); setScreen("fight"); }} />;
  return <FightCanvas key={`${matchup.player}-${matchup.enemy}`} audio={audio} playerName={matchup.player} enemyName={matchup.enemy} onBack={() => setScreen("select")} />;
}
