declare global {
	interface Window {
		electronAPI: {
			storage: any;
		};
	}
}
