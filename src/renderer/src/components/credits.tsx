export default function Credits() {
	return (
		<div class="flex flex-col gap-6 text-left text-white">
			<h1 class="text-3xl font-bold">Credits</h1>

			<div class="flex flex-col gap-8 max-w-md mx-auto">
				<div class="space-y-4">
					<h2 class="text-xl font-semibold">Music</h2>
					<div class="space-y-2">
						<p class="text-lg">Score</p>
						<p class="text-sm text-gray-300">by Alex Bainter</p>
						<p class="text-xs text-gray-400">CC BY</p>
					</div>
				</div>

				<div class="space-y-4">
					<h2 class="text-xl font-semibold">Development</h2>
					<div class="space-y-2">
						<p class="text-lg">Writing & Development</p>
						<p class="text-sm text-gray-300">by Ashtyn Morel-Blake</p>
					</div>
				</div>
			</div>
		</div>
	);
}
