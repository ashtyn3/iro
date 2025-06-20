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
					<SignInButton />
				</SignedOut>
			</ClerkLoaded>
		</>
	);
}
