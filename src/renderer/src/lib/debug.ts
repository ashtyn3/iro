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
	private logLevel: LogLevel = import.meta.env.DEV ? "debug" : "info";
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

	log(level: LogLevel = "info", ...args: any[]) {
		if (logLevelSeries[level] >= logLevelSeries[this.logLevel]) {
			if (level === "prod") {
				console.info(`[${level}]`, ...args);
			} else {
				console[level](`[${level}]`, ...args);
			}
		}
		if (import.meta.env.PROD && level !== "prod") {
			axiom.ingest("iro", {
				message: args.join(" "),
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

	info(...messages: any[]) {
		this.log("info", ...messages);
	}

	warn(...messages: any[]) {
		this.log("warn", ...messages);
	}

	error(...messages: any[]) {
		this.log("error", ...messages);
	}

	debug(...messages: any[]) {
		this.log("debug", ...messages);
	}
	prod(...messages: any[]) {
		this.log("prod", ...messages);
	}
}
