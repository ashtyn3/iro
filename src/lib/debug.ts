import { Axiom } from "@axiomhq/js";
import type { Engine } from ".";

const axiom = new Axiom({
	token: import.meta.env.VITE_AXIOM_TOKEN || "",
});

type LogLevel = "info" | "warn" | "error" | "debug" | "prod";
type LogLevelSeries = Record<LogLevel, number>;

const logLevelSeries: LogLevelSeries = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
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

	log(message: any, level: LogLevel = "info") {
		if (logLevelSeries[level] >= logLevelSeries[this.logLevel]) {
			if (level === "prod") {
				console.info(`[${level}]`, message);
			} else {
				console[level](`[${level}]`, message);
			}
		}
		if (import.meta.env.PROD && level !== "prod") {
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
	}

	info(message: any) {
		this.log(message, "info");
	}

	warn(message: any) {
		this.log(message, "warn");
	}

	error(message: any) {
		this.log(message, "error");
	}

	debug(message: any) {
		this.log(message, "debug");
	}
	prod(message: any) {
		this.log(message, "prod");
	}
}
