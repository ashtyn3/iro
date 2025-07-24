import { contextBridge } from "electron";
import type { StorageAPI } from "../shared/storage-types";
import { Storage } from "./storage";

// Initialize storage instance
const storage = Storage.instance;

// Create a plain object with storage methods for context bridge
const storageAPI: StorageAPI = {
	// Map management
	createTileSet: storage.createTileSet.bind(storage),
	getAllMaps: storage.getAllMaps.bind(storage),

	
	// Block operations
	insertTileBlocks: storage.insertTileBlocks.bind(storage),
	updateViewportTiles: storage.updateViewportTiles.bind(storage),
	loadMapContent: storage.loadMapContent.bind(storage),
	
	// Cluster operations
	saveClusters: storage.saveClusters.bind(storage),
	loadCluster: storage.loadCluster.bind(storage),
	clusterUpdate: storage.clusterUpdate.bind(storage),
	
	// Entity operations
	saveEntityState: storage.saveEntityState.bind(storage),
	getEntityState: storage.getEntityState.bind(storage),
	clearEntityStates: storage.clearEntityStates.bind(storage),
	
	// Cleanup operations
	clearUserData: storage.clearUserData.bind(storage),
	death: storage.death.bind(storage),
	
	// Settings operations
	hasSettings: storage.hasSettings.bind(storage),
	getSettings: storage.getSettings.bind(storage),
	createSettings: storage.createSettings.bind(storage),
	updateSettings: storage.updateSettings.bind(storage),
};

// Custom APIs for renderer
const api = {
	storage: storageAPI,
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("electronAPI", api);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)
	window.electronAPI = api;
}
