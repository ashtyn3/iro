import { createEffect, createResource, createSignal, For } from "solid-js";
import { DB } from "~/lib/state";

export function KeyMapSwitcher({ settings }: { settings: any }) {
	const db = new DB(null as any);
	const updateSettings = async (newSettings: any) => {
		await db.updateSettings(newSettings);
	};
	return (
		<div>
			<For each={Object.keys(settings()?.keyMap ?? {})}>
				{(keyMap) => (
					<div class="flex flex-row gap-2">
						<p>{settings()?.keyMap[keyMap].desc}</p>
						<input
							type="text"
							placeholder={settings()?.keyMap[keyMap].key}
							onkeydown={(e) => {
								e.preventDefault();
								const key = e.key;
								(e.target as HTMLInputElement).value = key;
								updateSettings({
									keyMap: {
										...settings()?.keyMap,
										[keyMap]: {
											...settings()?.keyMap[keyMap],
											key,
										},
									},
								});
							}}
						/>
					</div>
				)}
			</For>
		</div>
	);
}

export default function Settings() {
	const db = new DB(null as any);
	const [settings, setSettings] = createResource(async () => {
		const s = await db.getSettings();
		return s;
	});

	createEffect(async () => {
		const s = await db.getSettings();
		if (s !== undefined) {
			localStorage.setItem("keys", JSON.stringify(s.keyMap));
			localStorage.setItem("handed", s.handed ?? "right");
		}
	});

	createEffect(async () => {
		const has = await db.hasSettings();
		if (has === false) {
			await db.createSettings();
			setSettings.refetch();
		}
	});

	const updateSettings = async (newSettings: any) => {
		await db.updateSettings(newSettings);
	};

	const handleHandedChange = async (event: Event) => {
		const target = event.target as HTMLSelectElement;
		const value = target.value as "left" | "right";
		await updateSettings({ handed: value });
	};

	return (
		<div class="max-w-md mx-auto p-6 text-white rounded-lg">
			<h1 class="text-2xl font-bold mb-6">Settings</h1>

			<div class="space-y-4">
				<div>
					<label for="handed-select" class="block text-sm font-medium mb-2">
						Handed Preference
					</label>
					<select
						id="handed-select"
						class="w-full px-3 py-2 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						value={settings()?.handed || "right"}
						onChange={handleHandedChange}
					>
						<option value="right">Right Handed</option>
						<option value="left">Left Handed</option>
					</select>
				</div>

				<div>
					<label for="keymap-display" class="block text-sm font-medium mb-2">
						Key Map
					</label>
					<div
						id="keymap-display"
						class="px-3 py-2 border border-gray-600 rounded-md text-gray-300"
					>
						<KeyMapSwitcher settings={settings} />
					</div>
				</div>
			</div>
		</div>
	);
}
