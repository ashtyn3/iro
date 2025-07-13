import { clientOnly } from "@solidjs/start";
import {
	ClerkLoaded,
	ClerkLoading,
	SignedIn,
	SignedOut,
	SignInButton,
	useAuth,
} from "clerk-solidjs";

const Menu = clientOnly(() => import("~/components/menu"));

export default function Home() {
	return (
		<>
			<ClerkLoading>
				<div class="flex items-center justify-center h-screen bg-black">
					<div class="text-center">
						<p class="text-white font-mono text-lg">Loading</p>
					</div>
				</div>
			</ClerkLoading>
			<ClerkLoaded>
				<SignedIn>
					<Menu />
				</SignedIn>
				<SignedOut>
					<div class="flex items-center justify-center h-screen bg-black">
						<div class="text-center">
							<h1 class="text-white font-mono text-2xl mb-6">Welcome to Iro</h1>
							<p class="text-gray-400 font-mono text-lg mb-8">
								Please sign in to continue
							</p>
							<SignInButton class="bg-white text-black font-mono font-bold px-6 py-3 rounded-lg transition-all duration-200 ease-in-out hover:bg-gray-200 hover:scale-105 active:scale-95 shadow-lg" />
						</div>
					</div>
				</SignedOut>
			</ClerkLoaded>
		</>
	);
}
