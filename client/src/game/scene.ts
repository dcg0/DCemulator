import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

export type GameHandle = { scene: Scene; dispose: () => void };
type Action = "left" | "right" | "jump" | "light" | "heavy" | "special" | "tag";
type FighterState = "idle" | "run" | "jump" | "attack" | "hit" | "ko";

const W = 32;
const DC_FRAMES = ["/manus-storage/dc2-00_6b6a874b.png", "/manus-storage/dc2-01_e8d8a27f.png", "/manus-storage/dc2-02_beb9cbfd.png", "/manus-storage/dc2-03_ae41f9f6.png", "/manus-storage/dc2-04_68df0316.png", "/manus-storage/dc2-05_89d22d79.png", "/manus-storage/dc2-06_29983921.png", "/manus-storage/dc2-07_e44ce99d.png", "/manus-storage/dc2-08_39c67ec4.png"];
const CHARACTER_ART: Record<string, string> = { DC: DC_FRAMES[0], Wizz: "/manus-storage/wizz-cutout_8367d3ff.png" };
const FLOOR = -5.4;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

class InputManager {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private keyMap: Record<string, Action> = { a: "left", ArrowLeft: "left", d: "right", ArrowRight: "right", w: "jump", ArrowUp: "jump", j: "light", k: "heavy", l: "special", i: "tag" };
  constructor(private canvas: HTMLCanvasElement) {
    this.onKeyDown = this.onKeyDown.bind(this); this.onKeyUp = this.onKeyUp.bind(this); this.onPointer = this.onPointer.bind(this);
    window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointer);
  }
  private onKeyDown(e: KeyboardEvent) { const a = this.keyMap[e.key]; if (!a) return; e.preventDefault(); this.held.add(a); this.pressed.add(a); }
  private onKeyUp(e: KeyboardEvent) { const a = this.keyMap[e.key]; if (a) this.held.delete(a); }
  private onPointer(e: PointerEvent) { const x = e.clientX / window.innerWidth; const y = e.clientY / window.innerHeight; const a: Action | undefined = y > .72 ? (x < .22 ? "left" : x < .42 ? "right" : x < .62 ? "light" : x < .82 ? "heavy" : "special") : undefined; if (a) this.pressed.add(a); }
  down(a: Action) { return this.held.has(a); }
  consume(a: Action) { const yes = this.pressed.has(a); this.pressed.delete(a); return yes; }
  clear() { this.pressed.clear(); }
  dispose() { window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp); this.canvas.removeEventListener("pointerdown", this.onPointer); }
}

function mat(scene: Scene, name: string, color: string, emissive = false) {
  const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color); m.emissiveColor = emissive ? Color3.FromHexString(color) : Color3.Black(); return m;
}
function textPlane(scene: Scene, text: string, width: number, height: number, color: string, size = 48) {
  const plane = MeshBuilder.CreatePlane("label", { width, height }, scene);
  const tex = new DynamicTexture("labelTexture", { width: 1024, height: 256 }, scene, true); tex.hasAlpha = true;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D; ctx.clearRect(0, 0, 1024, 256); ctx.font = `900 ${size}px Arial Black, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.shadowColor = "#000"; ctx.shadowBlur = 12; ctx.fillText(text, 512, 128); tex.update();
  const material = new StandardMaterial("labelMat", scene); material.diffuseTexture = tex; material.opacityTexture = tex; material.emissiveColor = Color3.White(); material.backFaceCulling = false; plane.material = material; return { plane, tex, ctx };
}
function setText(label: ReturnType<typeof textPlane>, text: string, color: string, size = 48) { const ctx = label.ctx; ctx.clearRect(0, 0, 1024, 256); ctx.font = `900 ${size}px Arial Black, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.shadowColor = "#000"; ctx.shadowBlur = 12; ctx.fillText(text, 512, 128); label.tex.update(); }

class Fighter {
  readonly root: TransformNode; readonly accent: StandardMaterial; state: FighterState = "idle"; hp = 100; meter = 0; combo = 0; comboTimer = 0; velocity = new Vector3(0, 0, 0); facing = 1; attackTimer = 0; attackType: "light" | "heavy" | "special" | null = null; hitCooldown = 0; aiTimer = 0;
  private body: AbstractMesh; private limbs: AbstractMesh[] = []; private artFrames: AbstractMesh[] = []; private artClock = 0; private artIndex = 0;
  constructor(private scene: Scene, readonly name: string, x: number, color: string, private isPlayer: boolean) {
    this.root = new TransformNode(name, scene); this.root.position = new Vector3(x, FLOOR + 1.25, 0);
    this.accent = mat(scene, `${name}Accent`, color, true); const skin = mat(scene, `${name}Skin`, "#F0B18B"); const dark = mat(scene, `${name}Dark`, "#241b44");
    this.body = MeshBuilder.CreateBox(`${name}Body`, { width: 1.1, height: 1.45, depth: .65 }, scene); this.body.material = this.accent; this.body.parent = this.root;
    const head = MeshBuilder.CreateSphere(`${name}Head`, { diameter: .82, segments: 12 }, scene); head.position.y = .98; head.material = skin; head.parent = this.root;
    const leg1 = MeshBuilder.CreateBox(`${name}Leg1`, { width: .32, height: .85, depth: .38 }, scene); leg1.position.set(-.28, -.95, 0); leg1.material = dark; leg1.parent = this.root;
    const leg2 = leg1.clone(`${name}Leg2`)!; leg2.position.x = .28; leg2.parent = this.root;
    this.limbs.push(leg1, leg2);
    const artUrls = name === "DC" ? DC_FRAMES : [CHARACTER_ART[name]];
    artUrls.forEach((url, index) => { const art = MeshBuilder.CreatePlane(`${name}Art${index}`, { width: 2.15, height: 3.45 }, scene); art.position.set(0, .42, -.75); const artMat = new StandardMaterial(`${name}ArtMat${index}`, scene); artMat.diffuseTexture = new Texture(url, scene); artMat.diffuseTexture.hasAlpha = true; artMat.useAlphaFromDiffuseTexture = true; artMat.emissiveColor = Color3.White(); artMat.backFaceCulling = false; art.material = artMat; art.parent = this.root; art.renderingGroupId = 1; art.setEnabled(index === 0); this.artFrames.push(art); });
    if (name === "DC") { const cup = MeshBuilder.CreateCylinder("cup", { height: .45, diameter: .25 }, scene); cup.position.set(.72, .2, 0); cup.material = mat(scene, "cup", "#F8D34B", true); cup.parent = this.root; }
    if (name === "Wizz") { const hair = MeshBuilder.CreateBox("hair", { width: 1.0, height: .35, depth: .72 }, scene); hair.position.y = 1.35; hair.material = dark; hair.parent = this.root; }
  }
  get x() { return this.root.position.x; }
  get y() { return this.root.position.y; }
  update(dt: number, input: InputManager | null, opponent: Fighter, world: BattleWorld) {
    if (this.state === "ko") return;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt); this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0;
    const pose = this.state === "run" ? [0, 1, 2, 3] : this.state === "jump" ? [4, 5] : this.state === "attack" ? (this.attackType === "special" ? [5, 6, 7] : this.attackType === "heavy" ? [2, 3, 4] : [0, 1, 2]) : this.state === "hit" ? [6, 7] : [7, 8];
    this.artClock += dt; const frameRate = this.state === "attack" ? .075 : this.state === "run" ? .11 : this.state === "jump" ? .16 : .24; if (this.artFrames.length > 1 && this.artClock > frameRate) { this.artClock = 0; const current = pose.indexOf(this.artIndex); this.artIndex = pose[(current < 0 ? 0 : current + 1) % pose.length]; this.artFrames.forEach((frame, index) => frame.setEnabled(index === this.artIndex)); }
    if (this.attackTimer > 0) { this.attackTimer -= dt; this.root.rotation.z = Math.sin(this.attackTimer * 18) * (this.attackType === "heavy" ? .18 : .1) * this.facing; if (this.attackTimer <= 0) { this.state = "idle"; this.attackType = null; this.root.rotation.z = 0; } }
    if (this.state === "hit") { this.velocity.x *= .88; if (this.hitCooldown <= 0) this.state = "idle"; }
    if (this.isPlayer && input) this.playerControl(input, dt, opponent, world); else this.aiControl(dt, opponent, world);
    this.velocity.y -= 24 * dt; this.root.position.y += this.velocity.y * dt; if (this.root.position.y <= FLOOR + 1.25) { this.root.position.y = FLOOR + 1.25; this.velocity.y = 0; if (this.state === "jump") this.state = "idle"; }
    this.root.position.x = clamp(this.root.position.x + this.velocity.x * dt, -14.2, 14.2); this.velocity.x *= .84; this.root.scaling.y = this.state === "hit" ? .9 : 1;
    this.facing = opponent.x >= this.x ? 1 : -1; this.root.scaling.x = this.facing;
  }
  private playerControl(input: InputManager, dt: number, opp: Fighter, world: BattleWorld) {
    if (this.state !== "attack" && this.state !== "hit") { if (input.down("left")) { this.velocity.x = -8; this.state = "run"; } else if (input.down("right")) { this.velocity.x = 8; this.state = "run"; } else this.state = this.velocity.y !== 0 ? "jump" : "idle"; }
    if (input.consume("jump") && this.root.position.y <= FLOOR + 1.3) { this.velocity.y = 11; this.state = "jump"; world.spark(this.x, this.y - .9, "#F8D34B"); }
    if (input.consume("light")) this.attack("light", opp, world); if (input.consume("heavy")) this.attack("heavy", opp, world); if (input.consume("special")) this.attack("special", opp, world); if (input.consume("tag")) world.assist(this);
  }
  private aiControl(dt: number, opp: Fighter, world: BattleWorld) {
    this.aiTimer -= dt; if (this.state !== "attack" && this.state !== "hit") { const d = opp.x - this.x; if (Math.abs(d) > 3.0) { this.velocity.x = Math.sign(d) * 4.3; this.state = "run"; } else { this.velocity.x = 0; this.state = "idle"; if (this.aiTimer <= 0) { this.attack(Math.random() > .72 ? "heavy" : "light", opp, world); this.aiTimer = 1.1 + Math.random() * 1.6; } } }
  }
  performAttack(kind: "light" | "heavy" | "special", opp: Fighter, world: BattleWorld) { this.attack(kind, opp, world); }
  private attack(kind: "light" | "heavy" | "special", opp: Fighter, world: BattleWorld) { if (this.attackTimer > 0 || this.state === "ko") return; this.attackType = kind; this.attackTimer = kind === "special" ? .72 : kind === "heavy" ? .48 : .28; this.state = "attack"; const reach = kind === "special" ? 5.4 : kind === "heavy" ? 3.8 : 3.0; if (Math.abs(opp.x - this.x) < reach && Math.abs(opp.y - this.y) < 2.2) { const damage = kind === "special" ? 18 : kind === "heavy" ? 12 : 7; opp.takeHit(damage, this.facing * (kind === "special" ? 8 : 5), world); this.combo += 1; this.comboTimer = 1.2; this.meter = clamp(this.meter + damage * .6, 0, 100); world.spark(opp.x, opp.y, kind === "special" ? "#C75CFF" : "#F8D34B"); } else world.spark(this.x + this.facing * reach * .6, this.y, kind === "special" ? "#C75CFF" : "#22D3EE"); }
  takeHit(damage: number, knock: number, world: BattleWorld) { if (this.hitCooldown > 0 || this.state === "ko") return; this.hp = clamp(this.hp - damage, 0, 100); this.velocity.x = knock; this.velocity.y = 3.2; this.state = this.hp <= 0 ? "ko" : "hit"; this.hitCooldown = .22; if (this.state === "ko") { this.root.rotation.z = -this.facing * .8; world.spark(this.x, this.y, "#FF3E81"); } }
}

class BattleWorld {
  private input: InputManager; private player: Fighter; private enemy: Fighter; private particles: { mesh: AbstractMesh; life: number; vx: number; vy: number }[] = []; private assistTimer = 0; private time = 60; private gameOver = false; private demo = new URLSearchParams(location.search).has("demo"); private demoBeat = -1;
  private hud: ReturnType<typeof textPlane>[] = [];
  constructor(private scene: Scene, canvas: HTMLCanvasElement) { this.input = new InputManager(canvas); this.player = new Fighter(scene, "DC", -6, "#1F7BFF", true); this.enemy = new Fighter(scene, "Wizz", 6, "#C75CFF", false); if (this.demo) { this.player.root.position.x = -1.55; this.enemy.root.position.x = 1.55; } this.buildStage(); this.buildHud(); }
  private buildStage() {
    const stage = MeshBuilder.CreatePlane("generatedStage", { width: 32, height: 18 }, this.scene); stage.position.set(0, 1.1, 6); const stageMat = new StandardMaterial("generatedStageMat", this.scene); stageMat.diffuseTexture = new Texture("/manus-storage/stage-neon-rooftop_337b0a75.png", this.scene); stageMat.emissiveColor = Color3.White(); stageMat.backFaceCulling = false; stage.material = stageMat;
    const floorMat = mat(this.scene, "floor", "#1C2148"); const floor = MeshBuilder.CreateBox("floor", { width: W, height: .6, depth: 2 }, this.scene); floor.position.set(0, FLOOR - .3, 0); floor.material = floorMat; for (let i = -14; i <= 14; i += 2) { const line = MeshBuilder.CreateBox("neonLine", { width: .08, height: .05, depth: 1.8 }, this.scene); line.position.set(i, FLOOR + .03, -.2); line.material = mat(this.scene, `line${i}`, i % 4 === 0 ? "#22D3EE" : "#D946EF", true); }
    for (let i = -12; i <= 12; i += 3) { const h = 2 + Math.abs(i % 5); const b = MeshBuilder.CreateBox("building", { width: 2.3, height: h, depth: .6 }, this.scene); b.position.set(i, FLOOR + h / 2 + .3, 7.0); b.material = mat(this.scene, `building${i}`, i % 2 ? "#20204D" : "#292053"); for (let w = -0.7; w <= .7; w += .7) { const win = MeshBuilder.CreateBox("window", { width: .12, height: .24, depth: .04 }, this.scene); win.position.set(i + w, FLOOR + 1 + (h / 3), 6.8); win.material = mat(this.scene, `win${i}${w}`, i % 2 ? "#F8D34B" : "#22D3EE", true); } }
    const sign = textPlane(this.scene, "DC KING M2000", 10, 1.2, "#F8D34B", 70); sign.plane.position.set(0, 7.1, 1); sign.plane.position.z = 1; }
  private buildHud() { const title = textPlane(this.scene, "DC  VS  WIZZ", 14, .75, "#FFFFFF", 56); title.plane.position.set(0, 8.1, -1); title.plane.position.z = -1; const info = textPlane(this.scene, "A/D MOVER   W SALTAR   J GOLPE   K PESADO   L ESPECIAL   I ASISTIR", 27, .42, "#BFE9FF", 26); info.plane.position.set(0, -8.15, -1); info.plane.position.z = -1; const timer = textPlane(this.scene, "60", 2, 1, "#F8D34B", 72); timer.plane.position.set(0, 7.25, -1); timer.plane.position.z = -1; const combo = textPlane(this.scene, "", 5, .8, "#F8D34B", 58); combo.plane.position.set(-10.5, 4.1, -1); combo.plane.position.z = -1; const bars = textPlane(this.scene, "DC  ██████████        ██████████  WIZZ", 24, .65, "#FFFFFF", 34); bars.plane.position.set(0, 6.35, -1); bars.plane.position.z = -1; const buttonLabels = [["◀", -12.2], ["▶", -9.6], ["J", 7.2], ["K", 9.2], ["L", 11.2], ["I", 13.0]] as const; for (const [label, x] of buttonLabels) { const button = textPlane(this.scene, label, 1.1, .7, label === "L" ? "#F8D34B" : "#BFE9FF", 42); button.plane.position.set(x, -7.25, -1); button.plane.position.z = -1; } this.hud = [title, info, timer, combo, bars]; }
  update(dt: number) { if (this.gameOver) { if (this.input.consume("special")) location.reload(); return; } this.time = Math.max(0, this.time - dt); this.assistTimer = Math.max(0, this.assistTimer - dt); if (this.demo) { const beat = Math.floor((60 - this.time) * 1.8); if (beat !== this.demoBeat) { this.demoBeat = beat; if (beat % 3 === 0) this.player.performAttack("light", this.enemy, this); else if (beat % 3 === 1) this.player.performAttack("heavy", this.enemy, this); else this.player.performAttack("special", this.enemy, this); } }
    this.player.update(dt, this.input, this.enemy, this); this.enemy.update(dt, null, this.player, this); for (const p of this.particles) { p.life -= dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.vy -= 10 * dt; p.mesh.scaling.scaleInPlace(.96); } this.particles = this.particles.filter(p => { if (p.life <= 0) { p.mesh.dispose(); return false; } return true; });
    const t = this.hud[2]; setText(t, `${Math.ceil(this.time).toString().padStart(2, "0")}`, "#F8D34B", 72); const hpText = `${this.player.name} ${"█".repeat(Math.ceil(this.player.hp / 10))}${"░".repeat(10 - Math.ceil(this.player.hp / 10))}     ${"█".repeat(Math.ceil(this.enemy.hp / 10))}${"░".repeat(10 - Math.ceil(this.enemy.hp / 10))} ${this.enemy.name}`; setText(this.hud[4], hpText, "#FFFFFF", 34); setText(this.hud[3], this.player.combo > 1 ? `${this.player.combo} HIT COMBO` : "", "#F8D34B", 58); window.dispatchEvent(new CustomEvent("battle-hud", { detail: { playerHp: this.player.hp, enemyHp: this.enemy.hp, timer: this.time, combo: this.player.combo, playerMeter: this.player.meter, enemyMeter: this.enemy.meter, playerName: this.player.name, enemyName: this.enemy.name } }));
    if (this.player.hp <= 0 || this.enemy.hp <= 0 || this.time <= 0) { this.gameOver = true; const winner = this.player.hp > this.enemy.hp ? "DC WINS!" : "WIZZ WINS!"; const end = textPlane(this.scene, `${winner}   —   PRESS L TO RESTART`, 18, 1.4, "#FFFFFF", 54); end.plane.position.set(0, 1.1, -1); end.plane.position.z = -1; }
    this.input.clear(); }
  assist(fighter: Fighter) { if (this.assistTimer > 0 || this.gameOver) return; this.assistTimer = 3; const target = fighter === this.player ? this.enemy : this.player; target.takeHit(10, fighter.facing * 5, this); this.spark(target.x, target.y + .6, "#22D3EE"); this.spark(target.x, target.y + 1.2, "#F8D34B"); }
  spark(x: number, y: number, color: string) { for (let i = 0; i < 10; i++) { const s = MeshBuilder.CreateBox("spark", { width: .14, height: .14, depth: .12 }, this.scene); s.position.set(x, y, -.6); s.material = mat(this.scene, `spark${Math.random()}`, color, true); this.particles.push({ mesh: s, life: .35 + Math.random() * .3, vx: (Math.random() - .5) * 10, vy: (Math.random() - .2) * 9 }); } }
  dispose() { this.input.dispose(); this.particles.forEach(p => p.mesh.dispose()); }
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> { const scene = new Scene(engine); scene.clearColor = new Color4(.02, .025, .1, 0); const camera = new FreeCamera("camera", new Vector3(0, 0, -25), scene); camera.setTarget(Vector3.Zero()); camera.mode = 1; camera.orthoLeft = -16; camera.orthoRight = 16; camera.orthoTop = 9; camera.orthoBottom = -9; new HemisphericLight("ambient", new Vector3(0, 1, -1), scene).intensity = .75; const world = new BattleWorld(scene, canvas); const observer = scene.onBeforeRenderObservable.add(() => world.update(Math.min(scene.getEngine().getDeltaTime() / 1000, .05))); return { scene, dispose: () => { scene.onBeforeRenderObservable.remove(observer); world.dispose(); scene.dispose(); } }; }
