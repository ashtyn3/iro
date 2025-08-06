declare global {
	interface Window {
		electronAPI: {
			storage: StorageAPI;
		};
	}
}
