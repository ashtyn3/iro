import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";
import { ClerkProvider } from "clerk-solidjs";
import { ConvexClient } from "convex/browser";
import { ConvexContext } from "./convex";
import { Debug } from "./lib/debug";

// Check if environment variables are set
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!convexUrl) {
	Debug.getInstance().error("VITE_CONVEX_URL is not set");
}

if (!clerkKey) {
	Debug.getInstance().error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}

const convex = convexUrl ? new ConvexClient(convexUrl) : undefined;

export default function App() {
	return (
		<Router
			root={(props) => (
				<>
					<ClerkProvider publishableKey={clerkKey || ""}>
						<ConvexContext.Provider value={convex}>
							<Suspense>{props.children}</Suspense>
						</ConvexContext.Provider>
					</ClerkProvider>
				</>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
