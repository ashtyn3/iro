import type { ConvexClient } from "convex/browser";
import * as immutable from "immutable";
import * as ROT from "rot-js";
import SimpleScheduler from "rot-js/lib/scheduler/simple";
import { Clock } from "./clock";
import { Debug } from "./debug";
import { EntityRegistry } from "./entity";
import { createMenuHolder, Inventory, type MenuHolder } from "./inventory";
import { KeyHandles, keyMap } from "./keyhandle";
import { GMap, VIEWPORT } from "./map";
import { Fire } from "./objects/fire";
import { DarkThing } from "./objects/mobs/dark_thing";
import { Player, type PlayerType } from "./player";
import { type State, Vec2d } from "./state";
import {
	Destructible,
	type Movable,
	Name,
	Named,
	Renderable,
	type Storeable,
	Timed,
} from "./traits";

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
	convex: ConvexClient;
	menuHolder: MenuHolder;
	messageMenu: MenuHolder;
	clockSystem: Clock;
	debug: Debug;

	constructor(w: number, h: number, convex: ConvexClient) {
		this.width = w;
		this.height = h;
		this.convex = convex;

		// Initialize debug system
		if (import.meta.env.DEV) {
			this.debug = Debug.getInstance(this, { logLevel: "debug" });
		} else {
			this.debug = Debug.getInstance(this, { logLevel: "prod" });
		}
		this.debug.prod(
			"Iro is open source! https://github.com/ashtyn3/iro go peep the code over there!",
		);

		const TILES_X = VIEWPORT.x;
		const TILES_Y = VIEWPORT.y;
		const FONT_PX = 18;

		this.display = new ROT.Display({
			width: TILES_X,
			height: TILES_Y,
			fontSize: FONT_PX,
			fontFamily: "monospace",
			forceSquareRatio: true,
		});

		this.mapBuilder = new GMap(this.width, this.height, this, this.convex, "");
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
	}

	async start() {
		await this.player.sync();
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
	}

	async renderDOM() {
		const canvas = this.display.getContainer() as HTMLCanvasElement;

		// Stretch to 90% of viewport width/height
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		canvas.style.imageRendering = "pixelated";
		canvas.style.display = "block";
		canvas.style.backgroundColor = "#000";
		canvas.style.objectFit = "contain"; // Maintain aspect ratio
		// document.body.style.overflow = "hidden";

		this.engine.lock();
		this.engine.start();

		document.body.addEventListener("keydown", async (e) => {
			const handler = KeyHandles[e.key];
			if (this.clockSystem.state === "paused" && e.key !== keyMap().pause.key) {
				return;
			}
			if (handler) {
				await handler.perform(this, this.player);
			}
		});
		document.body.addEventListener("mousemove", (e) => {
			const pos = this.display.eventToPosition(e);
			const vp = this.viewport();
			const cluster = this.mapBuilder.getClusterAt(
				Vec2d({ x: vp.x + pos[0], y: vp.y + pos[1] }),
			);
			if (cluster) {
				this.display.drawOver(pos[0], pos[1], null, null, "red");
			}
		});

		window.onbeforeunload = () => confirm("Confirm refresh");

		const f = Fire(this, Vec2d({ x: 5, y: 5 }));
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
