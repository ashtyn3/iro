import * as ROT from "rot-js";
import SimpleScheduler from "rot-js/lib/scheduler/simple";
import { GMap, VIEWPORT } from "./map";
import { Air, Player } from "./player";
import { KeyHandles } from "./keyhandle";
import { Vec2d, type State } from "./state";
import { Syncable } from "./sync.svelte";
import { Inventory } from "./inventory";
import * as immutable from "immutable";
import type { Movable, Storeable } from "./entity";
import type { ConvexClient } from "convex/browser";

export class Engine {
    width: number;
    height: number;
    display: ROT.Display;
    mapBuilder: GMap;
    player: Movable & Inventory & Syncable & Air & Storeable;

    scheduler: SimpleScheduler;
    engine: ROT.Engine;
    state: State
    clock: number = 60
    convex: ConvexClient

    constructor(w: number, h: number, convex: ConvexClient) {
        this.width = w;
        this.height = h;
        this.convex = convex

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
        if (navigator.gpu) {
            this.mapBuilder.useGPU = true
        }
        this.scheduler = new SimpleScheduler();
        this.player = Player(this, "@", "right");

        this.engine = new ROT.Engine(this.scheduler);
        this.state = {
            currentCluster: null,
            entities: immutable.Map()
        }
    }

    async start() {
        await this.player.sync()
        this.player.update(this.player)
        this.clock = 60
        const actor = {
            act: () => {
                const player_vec = this.player.position
                const cluster = this.mapBuilder.getClusterAt(player_vec)
                this.state.currentCluster = cluster || null
                if (this.clock === 0) {
                    if (this.player.air === 0) {
                        this.mapBuilder.VIEW_RADIUS = 0;
                    }
                    this.clock = 60
                } else {
                    if (this.clock == 20) {
                        if (this.player.air === 0) {
                            this.mapBuilder.VIEW_RADIUS = this.mapBuilder.VIEW_RADIUS ^ 1;
                        }
                    }
                    if (this.clock == 30) {
                        if (this.player.air === 0) {
                            this.mapBuilder.VIEW_RADIUS = this.mapBuilder.VIEW_RADIUS ^ 2;
                        }
                    }
                    this.clock -= 1
                }
                // world‐update logic goes here…
                this.engine.lock();
            }
        }
        this.scheduler.add(actor, true);
    }

    renderDOM() {
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

        document.body.addEventListener("keydown", async e => {
            const handler = KeyHandles[e.key];
            if (handler) {
                await handler.perform(this, this.player);
            }
        });
        document.body.addEventListener("mousedown", e => {
            const pos = this.display.eventToPosition(e)
            const vp = this.viewport()
            const cluster = this.mapBuilder.getClusterAt(Vec2d({ x: vp.x + pos[0], y: vp.y + pos[1] }))
        });


        window.onbeforeunload = function (event) {
            return confirm("Confirm refresh");
        };

        const frame = async () => {
            this.engine.unlock();
            await this.render();
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);

        document.getElementById("gamebox")!.appendChild(canvas);
        this.render();
        console.log(this.mapBuilder.useGPU ? "using GPU" : "using CPU")
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
        this.player?.render?.();
    }
}

