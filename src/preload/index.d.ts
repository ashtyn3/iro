declare global {
	interface Window {
		electronAPI: {
			storage: StorageAPI;
			enterFullScreen: () => Promise<boolean>;
			leaveFullScreen: () => Promise<boolean>;
		};
	}
}
