import { v } from "convex/values";
import { defaultKeys } from "~/default_keys";
import { mutation, query } from "../_generated/server";

export const updateSettings = mutation({
	args: {
		keyMap: v.optional(v.any()),
		handed: v.optional(v.union(v.literal("left"), v.literal("right"))),
	},
	handler: async ({ auth, db }, args) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");
		const u = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
			.unique();
		if (!u) throw new Error("User record missing");

		const userSettings = await db
			.query("settings")
			.withIndex("byOwner", (q) => q.eq("owner", u._id))
			.unique();
		if (userSettings) {
			if (args.keyMap) {
				await db.patch(userSettings._id, { keyMap: args.keyMap });
			} else if (args.handed) {
				await db.patch(userSettings._id, { handed: args.handed });
			}
		} else {
			await db.insert("settings", {
				keyMap: args.keyMap ?? defaultKeys,
				handed: args.handed ?? "right",
				owner: u._id,
			});
		}
		return { success: true };
	},
});

export const hasSettings = query({
	handler: async ({ db, auth }, args) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");
		const u = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
			.unique();
		if (!u) throw new Error("User record missing");
		const userSettings = await db
			.query("settings")
			.withIndex("byOwner", (q) => q.eq("owner", u._id))
			.unique();
		return userSettings !== null;
	},
});
export const createSettings = mutation({
	handler: async ({ db, auth }, args) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");
		const u = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
			.unique();
		if (!u) throw new Error("User record missing");
		await db.insert("settings", {
			keyMap: defaultKeys,
			handed: "right",
			owner: u._id,
		});
		return { success: true };
	},
});
export const getSettings = query({
	handler: async ({ db, auth }, args) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");
		const u = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
			.unique();
		if (!u) throw new Error("User record missing");
		const userSettings = await db
			.query("settings")
			.withIndex("byOwner", (q) => q.eq("owner", u._id))
			.unique();

		return userSettings;
	},
});
