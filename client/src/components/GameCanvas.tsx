import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

type Hud = { playerHp: number; enemyHp: number; timer: number; combo: number; playerMeter: number; enemyMeter: number; playerName: string; enemyName: string };
const initialHud: Hud = { playerHp: 100, enemyHp: 100, timer: 60, combo: 0, playerMeter: 25, enemyMeter: 40, playerName: "DC", enemyName: "WIZZ" };

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true })), 110);
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const [hud, setHud] = useState(initialHud);
  useEffect(() => { const onHud = (event: Event) => setHud((event as CustomEvent<Hud>).detail); window.addEventListener("battle-hud", onHud); return () => window.removeEventListener("battle-hud", onHud); }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true, alpha: true });
    let handle: GameHandle | null = null;
    createGameScene(engine, canvas).then((nextHandle) => { handle = nextHandle; engine.runRenderLoop(() => nextHandle.scene.render()); });
    const onResize = () => engine.resize(); window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); handle?.dispose(); engine.dispose(); startedRef.current = false; };
  }, []);
  return <main className="arcade-frame"><canvas ref={canvasRef} className="fixed inset-0 h-full w-full outline-none" style={{ touchAction: "none" }} /><section className="arcade-ui" aria-label="Arcade HUD"><header className="arcade-topbar"><div className="team-block left-team"><div className="portrait portrait-dc">D</div><div className="team-copy"><strong>{hud.playerName}</strong><span>TEAM DC · PLAYER 1</span></div></div><div className="health-stack"><div className="health-row"><span className="health-label">LIFE</span><div className="health-track"><div className="health-fill player-fill" style={{ width: `${hud.playerHp}%` }} /></div></div><div className="meter-row"><span>SUPER</span><div className="meter-track"><div className="meter-fill player-meter" style={{ width: `${hud.playerMeter}%` }} /></div></div></div><div className="round-timer">{String(Math.ceil(hud.timer)).padStart(2, "0")}</div><div className="health-stack right-stack"><div className="health-row"><div className="health-track"><div className="health-fill enemy-fill" style={{ width: `${hud.enemyHp}%` }} /></div><span className="health-label">LIFE</span></div><div className="meter-row"><div className="meter-track"><div className="meter-fill enemy-meter" style={{ width: `${hud.enemyMeter}%` }} /></div><span>SUPER</span></div></div><div className="team-block right-team"><div className="team-copy right-copy"><strong>{hud.enemyName}</strong><span>TEAM WIZZ · CPU</span></div><div className="portrait portrait-wizz">W</div></div></header><div className="assist-row"><span className="assist-chip ready">DC SPECIAL READY</span><span className="series-mark">DC KING <b>M2000</b></span><span className="assist-chip ready">WIZZ BMX ASSIST</span></div>{hud.combo > 1 && <div className="combo-badge"><b>{hud.combo}</b><span>HIT<br />COMBO</span></div>}<footer className="arcade-controls"><div className="dpad"><button onPointerDown={() => press("ArrowLeft")}>◀</button><button onPointerDown={() => press("ArrowRight")}>▶</button><button onPointerDown={() => press("ArrowUp")}>▲</button></div><div className="control-hints"><span>A/D MOVE</span><span>W JUMP</span><span>I ASSIST</span></div><div className="attack-pad"><button className="light" onPointerDown={() => press("j")}>J<small>LIGHT</small></button><button className="heavy" onPointerDown={() => press("k")}>K<small>HEAVY</small></button><button className="special" onPointerDown={() => press("l")}>L<small>HYPER</small></button></div></footer></section></main>;
}
