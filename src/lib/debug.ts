import { Axiom } from "@axiomhq/js";
import type { Engine } from ".";

const axiom = new Axiom({
	token: import.meta.env.VITE_AXIOM_TOKEN || "",
});

type LogLevel = "info" | "warn" | "error" | "debug" | "prod";
type LogLevelSeries = Record<LogLevel, number>;

const logLevelSeries: LogLevelSeries = {
	info: 0,
	warn: 1,
	error: 2,
	debug: 3,
	prod: 4,
};

type DebugConfig = {
	logLevel: LogLevel;
};

export class Debug {
	private static instance: Debug | null = null;
	private logLevel: LogLevel = "info";
	private engine: Engine | null = null;
	private sessionStart: Date = new Date();

	private constructor() {}

	static getInstance(engine?: Engine, config?: DebugConfig): Debug {
		if (!Debug.instance) {
			Debug.instance = new Debug();
			if (engine && config) {
				Debug.instance.engine = engine;
				Debug.instance.logLevel = config.logLevel;
			}
		}
		return Debug.instance;
	}

	log(message: string, level: LogLevel = "info") {
		if (
			logLevelSeries[level] >= logLevelSeries[this.logLevel] &&
			this.logLevel !== "prod"
		) {
			console[level](`[${level}] ${message}`);
		}
		axiom.ingest("iro", {
			message,
			level: level,
			timestamp: new Date().toISOString(),
			trace: new Error().stack,
			sessionStart: this.sessionStart.toISOString(),
			metadata: {
				mapId: this.engine?.mapBuilder.mapId,
			},
		});
	}

	info(message: string) {
		this.log(message, "info");
	}

	warn(message: string) {
		this.log(message, "warn");
	}

	error(message: string) {
		this.log(message, "error");
	}

	debug(message: string) {
		this.log(message, "debug");
	}
}
