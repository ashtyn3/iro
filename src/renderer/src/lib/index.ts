import Letter from "@renderer/components/letter";
import { Howl } from "howler";
import * as ROT from "rot-js";
import SimpleScheduler from "rot-js/lib/scheduler/simple";
import letterComponents from "~/lib/generators/letter-components.json";
import { Clock } from "./clock";
import { Debug } from "./debug";
import { EntityRegistry } from "./entity";
import {
	createExtendedMenuHolder,
	createMenuHolder,
	type MenuHolder,
} from "./inventory";
import { KeyHandles, keyMap } from "./keyhandle";
import { GMap, setCellMetrics, setViewport, VIEWPORT } from "./map";
import { COLORS } from "./material";
import {
	createMouseMoveListener,
	MouseMove,
	type MouseMoveListener,
} from "./mouse";
import { Fire } from "./objects/fire";
import { GenericMachine } from "./objects/generic_machine";
import { calcDistanceBtwVecs, DarkThing } from "./objects/mobs/dark_thing";
import { Player, type PlayerType } from "./player";
import { DB, type State, Vec2d } from "./state";
import { Storage } from "./storage";
import type { Syncable } from "./sync";
import { Renderable, type Timed } from "./traits";
import {
	createAtmosphere,
	createTime,
	type Time,
} from "./traits/sims/atmospheric";
import type { Storeable } from "./traits/storeable";
import type { InputEvent, MapInfo } from "./types";

export class Engine {
	width: number;
	height: number;
	display: ROT.Display;
	mapBuilder: GMap;
	player: PlayerType;

	scheduler: SimpleScheduler;
	engine: ROT.Engine;
	state: State;
	clock: number = 60;
	cycles: number = 0;
	storage: Storage;
	menuHolder: MenuHolder;
	messageMenu: MenuHolder;
	clockSystem: Clock;
	debug: Debug;
	infoMenu: MenuHolder;
	mouse: MouseMoveListener;
	time!: Time & Storeable & Timed & Syncable;
	audio?: {
		score: Howl;
		voicing: {
			openings: Howl;
			greetings: Howl;
			middles: Howl;
			closings: Howl;
		};
	};
	atmosphere: any;

	constructor(w: number, h: number, storage: Storage) {
		this.width = w;
		this.height = h;
		this.storage = storage;

		// if (import.meta.env.DEV) {
		this.debug = Debug.getInstance(this, { logLevel: "debug" });
		// } else {
		// 	this.debug = Debug.getInstance(this, { logLevel: "prod" });
		// }
		this.debug.prod(
			"Iro is open source! https://github.com/ashtyn3/iro go peep the code over there!",
		);

		const TILES_X = VIEWPORT.x;
		const TILES_Y = VIEWPORT.y;
		const FONT_PX = 16;

		this.display = new ROT.Display({
			width: TILES_X,
			height: TILES_Y,
			fontSize: FONT_PX,
			fontFamily:
				"MorePerfectDOSVGA, Courier New, Courier, Consolas, Monaco, Lucida Console, monospace",
			forceSquareRatio: false,
		});

		this.mapBuilder = new GMap(this.width, this.height, this, this.storage, "");
		if ((navigator as any).gpu) {
			this.mapBuilder.useGPU = true;
		}
		this.scheduler = new SimpleScheduler();
		this.clockSystem = new Clock(this);
		this.player = Player(
			this,
			"@",
			(localStorage.getItem("handed") as "left" | "right") ?? "right",
		);

		this.engine = new ROT.Engine(this.scheduler);
		this.state = {
			currentCluster: null,
		};
		this.menuHolder = createMenuHolder(this);
		this.messageMenu = createMenuHolder(this);

		const infoMenu = createExtendedMenuHolder(this);
		infoMenu.add(MouseMove, {
			mousemove: (position: Vec2d) => {
				this.infoMenu.update({ position: position.toJS() });
			},
		});
		this.infoMenu = infoMenu.build();
		this.mouse = createMouseMoveListener(this);
		this.time = createTime(this);
		this.atmosphere = createAtmosphere(this);
	}

	async loadAudio() {
		const db = new DB(Storage.instance);
		const settings = await db.getSettings();
		const sprites = {};
		Object.keys(letterComponents.audio).forEach((key) => {
			sprites[key] = {};
			Object.keys(letterComponents.audio[key]).forEach((sample, i) => {
				letterComponents.audio[key][sample].forEach((_, idx) => {
					sprites[key][`${key}_${idx}`] = [
						letterComponents.audio[key][sample][idx].sample_start * 1000,
						letterComponents.audio[key][sample][idx].sample_end * 1000,
					];
				});
			});
		});

		// Debug the dynamic imports
		const scoreImport = await import("~/lib/assets/audio/score.ogg");
		const openingsImport = await import("~/lib/assets/audio/openings.mp3");
		const greetingsImport = await import("~/lib/assets/audio/greetings.mp3");
		const middlesImport = await import("~/lib/assets/audio/middles.mp3");
		const closingsImport = await import("~/lib/assets/audio/closings.mp3");

		// Resume audio context if suspended
		if (Howler.ctx && Howler.ctx.state === "suspended") {
			Howler.ctx.resume();
		}

		this.audio = {
			score: new Howl({
				src: [scoreImport.default],
				html5: true,
				loop: true,
				autoplay: true,
				volume: settings?.audio.music,
			}),
			voicing: {
				openings: new Howl({
					src: [openingsImport.default],
					sprite: sprites["openings"],
					volume: settings?.audio.sfx,
				}),
				greetings: new Howl({
					src: [greetingsImport.default],
					sprite: sprites["greetings"],
					volume: settings?.audio.sfx,
				}),
				middles: new Howl({
					src: [middlesImport.default],
					sprite: sprites["middles"],
					volume: settings?.audio.sfx,
				}),
				closings: new Howl({
					src: [closingsImport.default],
					sprite: sprites["closings"],
					volume: settings?.audio.sfx,
				}),
			},
		};
	}

	async start() {
		await this.time.sync();
		await this.player.sync();
		const db = new DB(Storage.instance);
		this.player.update({ ...this.player });
		const actor = {
			act: () => {
				const player_vec = this.player.position;
				const cluster = this.mapBuilder.getClusterAt(player_vec);
				this.state.currentCluster = cluster || null;
				this.engine.lock();
			},
		};
		this.scheduler.add(actor, true);
		await this.loadAudio();
	}

	handlePlayStart() {
		// Resume audio context if suspended
		if (Howler.ctx && Howler.ctx.state === "suspended") {
			Howler.ctx.resume();
		}

		if (!this.mapBuilder.mapHeader.progress?.letter) {
			this.menuHolder.setMenu(() =>
				Letter({ mapHeader: this.mapBuilder.mapHeader, engine: this }),
			);
			if (this.audio?.voicing) {
				const playVoicingSequence = (voicing, spriteNames) => {
					const voicingOrder = ["greetings", "openings", "middles", "closings"];
					let idx = 0;

					const playNext = () => {
						if (idx >= voicingOrder.length) {
							// Audio sequence completed - now set progress to true
							if (this.mapBuilder.mapHeader.progress) {
								const db = new DB(Storage.instance);
								db.updateMapHeader({
									...this.mapBuilder.mapHeader,
									progress: { letter: true },
								} as MapInfo);
								this.mapBuilder.mapHeader.progress.letter = true;
							}
							return;
						}
						const key = voicingOrder[idx];
						const sprite = spriteNames[idx];
						const howl = voicing[key];

						if (!howl || !sprite) {
							idx++;
							playNext();
							return;
						}

						try {
							const soundId = howl.play(sprite);

							howl.once(
								"end",
								() => {
									// Add a small pause between segments
									setTimeout(() => {
										idx++;
										playNext();
									}, 300);
								},
								soundId,
							);

							howl.once(
								"loaderror",
								() => {
									idx++;
									playNext();
								},
								soundId,
							);

							howl.once(
								"playerror",
								() => {
									idx++;
									playNext();
								},
								soundId,
							);
						} catch (error) {
							idx++;
							playNext();
						}
					};

					playNext();
				};

				playVoicingSequence(
					this.audio.voicing,
					this.mapBuilder.mapHeader.letter?.sprites ?? [],
				);
			}
		}
	}

	cleanupAudio() {
		if (this.audio) {
			// Stop all audio instances
			this.audio.score.stop();
			this.audio.voicing.greetings.stop();
			this.audio.voicing.openings.stop();
			this.audio.voicing.middles.stop();
			this.audio.voicing.closings.stop();

			// Unload the audio to free memory
			this.audio.score.unload();
			this.audio.voicing.greetings.unload();
			this.audio.voicing.openings.unload();
			this.audio.voicing.middles.unload();
			this.audio.voicing.closings.unload();

			this.audio = undefined;
		}
	}

	async renderDOM() {
		const canvas = this.display.getContainer() as HTMLCanvasElement;

		canvas.style.imageRendering = "pixelated";
		canvas.style.imageRendering = "crisp-edges";
		canvas.style.display = "block";
		canvas.style.backgroundColor = "#000";

		const measureGlyphWidth = (): number => {
			const tmp = document.createElement("canvas");
			const ctx = tmp.getContext("2d");
			if (!ctx) return 8;
			ctx.font = `${this.display.getOptions().fontSize}px ${this.display.getOptions().fontFamily}`;
			return Math.ceil(ctx.measureText("M").width) || 8;
		};

		const fitCanvasToWindow = () => {
			const CELL_W = measureGlyphWidth();
			const CELL_H = this.display.getOptions().fontSize as number;
			setCellMetrics(CELL_W, CELL_H);
			let cols = Math.max(1, Math.floor(window.innerWidth / CELL_W));
			const rows = Math.max(1, Math.floor(window.innerHeight / CELL_H));
			setViewport(cols, rows);
			this.display.setOptions({ width: cols, height: rows });

			const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
			const intrinsicCssWidth = canvas.width / dpr;
			const intrinsicCssHeight = canvas.height / dpr;

			let maxScaleXFloor =
				Math.floor(window.innerWidth / intrinsicCssWidth) || 1;
			let maxScaleYFloor =
				Math.floor(window.innerHeight / intrinsicCssHeight) || 1;
			const maxScaleXCeil =
				Math.ceil(window.innerWidth / intrinsicCssWidth) || 1;
			let scale = Math.max(1, Math.min(maxScaleXFloor, maxScaleYFloor));

			const desiredIntrinsicCssWidth = window.innerWidth / scale;
			const additionalCols = Math.floor(
				(desiredIntrinsicCssWidth - intrinsicCssWidth) / CELL_W,
			);
			if (additionalCols > 0) {
				cols += additionalCols;
				setViewport(cols, rows);
				this.display.setOptions({ width: cols, height: rows });
				const dpr2 = Math.max(1, Math.floor(window.devicePixelRatio || 1));
				const intrinsicCssWidth2 = canvas.width / dpr2;
				const intrinsicCssHeight2 = canvas.height / dpr2;
				maxScaleXFloor =
					Math.floor(window.innerWidth / intrinsicCssWidth2) || 1;
				maxScaleYFloor =
					Math.floor(window.innerHeight / intrinsicCssHeight2) || 1;
				scale = Math.max(1, Math.min(maxScaleXFloor, maxScaleYFloor));
			}

			const cssWidth = Math.round((canvas.width / dpr) * scale);
			const cssHeight = Math.round((canvas.height / dpr) * scale);

			canvas.style.width = `${cssWidth}px`;
			canvas.style.height = `${cssHeight}px`;
		};

		fitCanvasToWindow();
		window.addEventListener("resize", fitCanvasToWindow);

		this.engine.lock();
		this.engine.start();

		document.body.addEventListener("keydown", async (e) => {
			const inputEvent: InputEvent = {
				key: e.key,
				ctrlKey: e.ctrlKey,
				shiftKey: e.shiftKey,
				altKey: e.altKey,
			};

			const handler = KeyHandles[inputEvent.key];
			if (
				this.clockSystem.state === "paused" &&
				inputEvent.key !== keyMap().pause.key
			) {
				return;
			}
			if (handler) {
				await handler.perform(this, this.player);
			}
		});

		let lastPos: Vec2d | null = null;
		document.getElementById("gamebox")?.addEventListener("mousemove", (e) => {
			const canvasRect = (canvas as HTMLCanvasElement).getBoundingClientRect();
			const intrinsicWidth = (canvas as HTMLCanvasElement).width;
			const intrinsicHeight = (canvas as HTMLCanvasElement).height;
			const contentAspect = intrinsicWidth / intrinsicHeight;
			const rectAspect = canvasRect.width / canvasRect.height;

			let contentWidth = canvasRect.width;
			let contentHeight = canvasRect.height;
			let offsetX = 0;
			let offsetY = 0;
			if (rectAspect > contentAspect) {
				contentHeight = canvasRect.height;
				contentWidth = contentHeight * contentAspect;
				offsetX = (canvasRect.width - contentWidth) / 2;
			} else {
				contentWidth = canvasRect.width;
				contentHeight = contentWidth / contentAspect;
				offsetY = (canvasRect.height - contentHeight) / 2;
			}

			const relX = Math.max(
				0,
				Math.min(e.clientX - canvasRect.left - offsetX, contentWidth),
			);
			const relY = Math.max(
				0,
				Math.min(e.clientY - canvasRect.top - offsetY, contentHeight),
			);

			const col = Math.floor((relX / contentWidth) * VIEWPORT.x);
			const row = Math.floor((relY / contentHeight) * VIEWPORT.y);
			const viewportVec = Vec2d({ x: col, y: row });

			const worldVec = Vec2d({
				x: this.viewport().x + viewportVec.x,
				y: this.viewport().y + viewportVec.y,
			});

			if (
				worldVec.x < 0 ||
				worldVec.y < 0 ||
				worldVec.x >= this.width ||
				worldVec.y >= this.height
			) {
				if (lastPos) {
					this.mapBuilder.tiles[lastPos.x][lastPos.y].cursor = null;
				}
				const clamped = Vec2d({
					x: Math.max(0, Math.min(worldVec.x, this.width - 1)),
					y: Math.max(0, Math.min(worldVec.y, this.height - 1)),
				});
				this.mouse.position = clamped;
				lastPos = null;
				return;
			}

			if (lastPos && !lastPos.equals(worldVec)) {
				this.mapBuilder.tiles[lastPos.x][lastPos.y].cursor = null;
			}

			this.mapBuilder.tiles[worldVec.x][worldVec.y].cursor = {
				fg: COLORS.colors().cursor.close,
				bg: "",
				char: "X",
			};

			lastPos = worldVec;
			this.mouse.position = worldVec;
		});

		window.onbeforeunload = () => {
			if (this.clockSystem.state === "paused") {
				return;
			} else {
				confirm("Confirm refresh");
			}
		};
		await (window as any).electronAPI.enterFullScreen();

		const f = Fire(this, Vec2d({ x: 5, y: 5 }));
		const g = GenericMachine(
			this,
			Vec2d({ x: 10, y: 10 }),
			Vec2d({ x: 3, y: 3 }),
			{
				corners: {
					topLeft: "┌",
					topRight: "┐",
					bottomLeft: "└",
					bottomRight: "┘",
				},
				horizontal: "─",
				vertical: "│",
				center: "µ",
				centerFill: false,
			},
		);
		const h = GenericMachine(
			this,
			Vec2d({ x: 20, y: 20 }),
			Vec2d({ x: 5, y: 5 }),
			{
				corners: {
					topLeft: "┌",
					topRight: "┐",
					bottomLeft: "└",
					bottomRight: "┘",
				},
				horizontal: "─",
				vertical: "│",
				center: "o",
				centerFill: false,
			},
		);
		const d = DarkThing(this, Vec2d({ x: 10, y: 13 }));

		const frame = async () => {
			if (this.clockSystem.state === "paused") {
				requestAnimationFrame(frame);
				return;
			}
			this.clockSystem.act();
			this.engine.unlock();
			await this.render();
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);

		document.getElementById("gamebox")?.appendChild(canvas);
		await this.render();
		this.debug.info(this.mapBuilder.useGPU ? "using GPU" : "using CPU");
		this.handlePlayStart();
	}
	viewport(): Vec2d {
		const halfX = Math.floor(VIEWPORT.x / 2),
			halfY = Math.floor(VIEWPORT.y / 2);
		let vx = this.player.position.x - halfX,
			vy = this.player.position.y - halfY;
		vx = Math.max(0, Math.min(vx, this.width - VIEWPORT.x));
		vy = Math.max(0, Math.min(vy, this.height - VIEWPORT.y));
		return Vec2d({ x: vx, y: vy });
	}

	public async render() {
		await this.mapBuilder.render();
		EntityRegistry.instance.lookup([Renderable]).forEach((e) => {
			e.render();
		});
		this.player?.render?.();
	}
}
