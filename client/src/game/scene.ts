import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

export type GameHandle = { scene: Scene; dispose: () => void };
type Action = "left" | "right" | "punchLight" | "punchHeavy" | "kickLight" | "kickHeavy" | "jump" | "dodge" | "special";
type MoveAction = Exclude<Action, "left" | "right"> | "special";
type SceneOptions = { playerName?: "DC" | "Wizz"; enemyName?: "DC" | "Wizz" };
type FighterState = "idle" | "action" | "hit" | "ko";

const FLOOR = -5.4;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DC_FRAMES = ["/manus-storage/dchd-00_bf56406f.png", "/manus-storage/dchd-01_b44b615a.png", "/manus-storage/dchd-02_61ccf18c.png", "/manus-storage/dchd-03_ae72f668.png", "/manus-storage/dchd-04_5fe8a495.png", "/manus-storage/dchd-05_065486bc.png", "/manus-storage/dchd-06_20687d9d.png", "/manus-storage/dchd-07_d5702622.png", "/manus-storage/dchd-08_c5c1b98b.png", "/manus-storage/dchd-09_92cfa360.png"];
const WIZZ_FRAMES = ["/manus-storage/wizzhd-00_2f1c9ac4.png", "/manus-storage/wizzhd-01_46c6bf12.png", "/manus-storage/wizzhd-02_1cb127f1.png", "/manus-storage/wizzhd-03_3911e179.png", "/manus-storage/wizzhd-04_aad17283.png", "/manus-storage/wizzhd-05_28c67ab0.png", "/manus-storage/wizzhd-06_395aa7e9.png", "/manus-storage/wizzhd-07_b6e66dcd.png", "/manus-storage/wizzhd-08_650ad518.png", "/manus-storage/wizzhd-09_fe1d7bb9.png", "/manus-storage/wizzhd-10_3e423197.png"];

const FRAME_SEQUENCES: Record<"DC" | "Wizz", Record<MoveAction | "idle", number[]>> = {
  DC: { idle: [8, 9], punchLight: [1, 2], punchHeavy: [2, 3], kickLight: [0], kickHeavy: [3, 4], jump: [4], dodge: [6, 7], special: [1, 2, 3, 4, 5, 6, 7] },
  Wizz: { idle: [9, 10], punchLight: [0, 1], punchHeavy: [2, 3], kickLight: [4], kickHeavy: [5, 6], jump: [7], dodge: [8, 9, 10], special: [7, 8, 9, 10, 6] },
};

class InputManager {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private keyMap: Record<string, Action> = { a: "left", ArrowLeft: "left", d: "right", ArrowRight: "right", "1": "punchLight", "2": "punchHeavy", "3": "kickLight", "4": "kickHeavy", "5": "jump", "6": "dodge" };
  constructor(private canvas: HTMLCanvasElement) { this.onKeyDown = this.onKeyDown.bind(this); this.onKeyUp = this.onKeyUp.bind(this); window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp); }
  private onKeyDown(e: KeyboardEvent) { const action = this.keyMap[e.key]; if (!action) return; e.preventDefault(); this.held.add(action); this.pressed.add(action); }
  private onKeyUp(e: KeyboardEvent) { const action = this.keyMap[e.key]; if (action) this.held.delete(action); }
  down(action: Action) { return this.held.has(action); }
  consume(action: Action) { const value = this.pressed.has(action); this.pressed.delete(action); return value; }
  clear() { this.pressed.clear(); }
  dispose() { window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp); }
}

function material(scene: Scene, name: string, color: string, emissive = false) { const value = new StandardMaterial(name, scene); value.diffuseColor = Color3.FromHexString(color); value.emissiveColor = emissive ? Color3.FromHexString(color) : Color3.Black(); return value; }

class Fighter {
  readonly root: TransformNode;
  readonly accent: StandardMaterial;
  state: FighterState = "idle";
  hp = Number.POSITIVE_INFINITY;
  meter = 0;
  combo = 0;
  comboTimer = 0;
  velocity = new Vector3(0, 0, 0);
  facing = 1;
  private action: MoveAction | "idle" = "idle";
  private actionTime = 0;
  private actionFrame = 0;
  private hitCooldown = 0;
  private frames: AbstractMesh[] = [];
  private frameClock = 0;
  private aiClock = 0;
  private specialLatch = false;
  private readonly frameSources: string[];
  private readonly sequences: Record<MoveAction | "idle", number[]>;

  constructor(private scene: Scene, readonly name: "DC" | "Wizz", x: number, color: string, private isPlayer: boolean) {
    this.root = new TransformNode(name, scene); this.root.position = new Vector3(x, FLOOR + 1.72, 0); this.accent = material(scene, `${name}Accent`, color, true);
    this.frameSources = name === "DC" ? DC_FRAMES : WIZZ_FRAMES; this.sequences = FRAME_SEQUENCES[name];
    this.frameSources.forEach((url, index) => { const plane = MeshBuilder.CreatePlane(`${name}Frame${index}`, { width: 4.5, height: 4.5 }, scene); const spriteMaterial = new StandardMaterial(`${name}FrameMaterial${index}`, scene); spriteMaterial.diffuseTexture = new Texture(url, scene); spriteMaterial.diffuseTexture.hasAlpha = true; spriteMaterial.diffuseTexture.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE); spriteMaterial.diffuseTexture.anisotropicFilteringLevel = 16; spriteMaterial.useAlphaFromDiffuseTexture = true; spriteMaterial.emissiveColor = Color3.White(); spriteMaterial.disableLighting = true; spriteMaterial.backFaceCulling = false; plane.material = spriteMaterial; plane.position.set(0, .5, -.8); plane.parent = this.root; plane.renderingGroupId = 1; plane.setEnabled(index === this.sequences.idle[0]); this.frames.push(plane); });
  }

  get x() { return this.root.position.x; }
  get y() { return this.root.position.y; }
  get airborne() { return this.root.position.y > FLOOR + 1.35; }

  update(dt: number, input: InputManager | null, opponent: Fighter, world: BattleWorld) {
    if (this.state === "ko") return;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt); this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0;
    if (this.actionTime > 0) { this.actionTime -= dt; this.frameClock += dt; const sequence = this.sequences[this.action]; if (this.frameClock > .075) { this.frameClock = 0; this.actionFrame = Math.min(this.actionFrame + 1, sequence.length - 1); this.showFrame(sequence[this.actionFrame]); } if (this.actionTime <= 0 && this.action !== "jump") { this.action = "idle"; this.actionFrame = 0; this.showFrame(this.sequences.idle[0]); this.state = this.airborne ? "action" : "idle"; } }
    if (this.state === "hit") { this.velocity.x *= .88; if (this.hitCooldown <= 0) { this.state = this.airborne ? "action" : "idle"; this.action = "idle"; this.showFrame(this.sequences.idle[0]); } }
    if (this.isPlayer && input) this.playerControl(input, opponent, world); else this.aiControl(dt, opponent, world);
    this.velocity.y -= 24 * dt; this.root.position.y += this.velocity.y * dt;
    if (this.root.position.y <= FLOOR + 1.72) { const wasAirborne = this.airborne; this.root.position.y = FLOOR + 1.72; this.velocity.y = 0; if (wasAirborne || this.action === "jump") { this.action = "idle"; this.actionTime = 0; this.state = "idle"; this.showFrame(this.sequences.idle[0]); } }
    this.root.position.x = clamp(this.root.position.x + this.velocity.x * dt, -14.2, 14.2); this.velocity.x *= .82; this.facing = opponent.x >= this.x ? 1 : -1; this.root.scaling.x = this.facing;
  }

  private playerControl(input: InputManager, opponent: Fighter, world: BattleWorld) {
    if (this.state !== "action" && this.state !== "hit") { if (input.down("left")) this.velocity.x = -7; else if (input.down("right")) this.velocity.x = 7; }
    const actionButtons: MoveAction[] = ["punchLight", "punchHeavy", "kickLight", "kickHeavy", "jump", "dodge"];
    const heldCount = actionButtons.filter(action => input.down(action)).length;
    if (heldCount >= 3 && !this.specialLatch) { this.specialLatch = true; this.perform("special", opponent, world); }
    if (heldCount < 3) this.specialLatch = false;
    actionButtons.forEach(action => { if (input.consume(action)) this.perform(action, opponent, world); });
  }
  private aiControl(dt: number, opponent: Fighter, world: BattleWorld) { this.aiClock -= dt; if (this.state === "action" || this.state === "hit") return; if (Math.abs(opponent.x - this.x) > 3) this.velocity.x = Math.sign(opponent.x - this.x) * 3.8; if (this.aiClock <= 0) { const actions: MoveAction[] = ["punchLight", "punchHeavy", "kickLight", "kickHeavy", "jump", "dodge"]; this.perform(actions[Math.floor(Math.random() * actions.length)], opponent, world); this.aiClock = 1.0 + Math.random() * .8; } }

  perform(action: MoveAction, opponent: Fighter, world: BattleWorld) {
    if (this.state === "ko" || (this.actionTime > 0 && !this.airborne && action !== "jump")) return;
    this.action = action; this.actionFrame = 0; this.frameClock = 0; this.state = "action"; const sequence = this.sequences[action]; this.actionTime = Math.max(.18, sequence.length * .1);
    this.showFrame(sequence[0]);
    if (action === "jump") { this.velocity.y = 11; return; }
    if (action === "dodge") { this.velocity.x = this.facing * 8; return; }
    if (action === "special") {
      this.actionTime = .82;
      if (this.name === "Wizz") { this.root.position.x = clamp(opponent.x - this.facing * 5.2, -14.2, 14.2); this.velocity.x = this.facing * 11; } else { this.velocity.x = this.facing * 4; }
    }
    const airborneBonus = this.airborne ? 1 : 0; const reach = action === "special" ? 6.4 : action.includes("Heavy") ? 3.7 : 3.1; const damage = action === "special" ? 30 : action === "punchLight" || action === "kickLight" ? 7 + airborneBonus : 12 + airborneBonus * 2;
    if (Math.abs(opponent.x - this.x) < reach && Math.abs(opponent.y - this.y) < 2.5) { opponent.takeHit(damage, this.facing * (action.includes("Heavy") ? 6 : 4), world); this.combo += 1; this.comboTimer = 1.1; this.meter = clamp(this.meter + damage * .7, 0, 100); }
  }

  private showFrame(index: number) { this.frames.forEach((frame, frameIndex) => frame.setEnabled(frameIndex === index)); }
  takeHit(damage: number, knock: number, _world: BattleWorld) { if (this.hitCooldown > 0 || this.state === "ko" || this.action === "dodge") return; this.hp = Number.POSITIVE_INFINITY; this.velocity.x = knock; this.velocity.y = 3.2; this.state = "hit"; this.hitCooldown = .24; }
}

class BattleWorld {
  private input: InputManager;
  private player: Fighter;
  private enemy: Fighter;
  private time = Number.POSITIVE_INFINITY;
  private gameOver = false;
  private demo = new URLSearchParams(location.search).has("demo");
  private demoBeat = -1;
  private demoElapsed = 0;
  private hud: { playerHp: number; enemyHp: number; timer: number; combo: number; playerMeter: number; enemyMeter: number; playerName: string; enemyName: string } = { playerHp: 100, enemyHp: 100, timer: 60, combo: 0, playerMeter: 0, enemyMeter: 0, playerName: "DC", enemyName: "Wizz" };
  constructor(private scene: Scene, canvas: HTMLCanvasElement, playerName: "DC" | "Wizz" = "DC", enemyName: "DC" | "Wizz" = "Wizz") { this.input = new InputManager(canvas); this.player = new Fighter(scene, playerName, -1.8, playerName === "DC" ? "#1F7BFF" : "#C75CFF", true); this.enemy = new Fighter(scene, enemyName, 1.8, enemyName === "DC" ? "#1F7BFF" : "#C75CFF", false); this.buildStage(); }
  private buildStage() { const floor = MeshBuilder.CreateBox("floor", { width: 32, height: .5, depth: 2 }, this.scene); floor.position.set(0, FLOOR - .25, 0); floor.material = material(this.scene, "floor", "#101434"); for (let i = -14; i <= 14; i += 2) { const line = MeshBuilder.CreateBox("line", { width: .06, height: .05, depth: 1.8 }, this.scene); line.position.set(i, FLOOR + .03, -.2); line.material = material(this.scene, `line${i}`, i % 4 === 0 ? "#22D3EE" : "#D946EF", true); } }
  update(dt: number) { if (this.gameOver) return; this.time = Number.POSITIVE_INFINITY; this.demoElapsed += dt; if (this.demo) { const beat = Math.floor(this.demoElapsed * 1.25); if (beat !== this.demoBeat) { this.demoBeat = beat; const actions: MoveAction[] = ["punchLight", "punchHeavy", "kickLight", "kickHeavy", "jump", "dodge"]; if (beat % 12 === 10) this.player.perform("special", this.enemy, this); else if (beat % 12 === 11) this.enemy.perform("special", this.player, this); else this.player.perform(actions[beat % 6], this.enemy, this); } } this.player.update(dt, this.input, this.enemy, this); this.enemy.update(dt, null, this.player, this); this.hud = { playerHp: 100, enemyHp: 100, timer: 99, combo: this.player.combo, playerMeter: this.player.meter, enemyMeter: this.enemy.meter, playerName: this.player.name, enemyName: this.enemy.name }; window.dispatchEvent(new CustomEvent("battle-hud", { detail: this.hud })); this.gameOver = false; this.input.clear(); }
  dispose() { this.input.dispose(); }
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement, options: SceneOptions = {}): Promise<GameHandle> { const scene = new Scene(engine); scene.clearColor = new Color4(.015, .02, .07, 1); const camera = new FreeCamera("camera", new Vector3(0, 0, -25), scene); camera.setTarget(Vector3.Zero()); camera.mode = 1; camera.orthoLeft = -13; camera.orthoRight = 13; camera.orthoTop = 8; camera.orthoBottom = -8; new HemisphericLight("ambient", new Vector3(0, 1, -1), scene).intensity = .85; const world = new BattleWorld(scene, canvas, options.playerName, options.enemyName); const observer = scene.onBeforeRenderObservable.add(() => world.update(Math.min(scene.getEngine().getDeltaTime() / 1000, .05))); return { scene, dispose: () => { scene.onBeforeRenderObservable.remove(observer); world.dispose(); scene.dispose(); } }; }
