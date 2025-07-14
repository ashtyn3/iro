export default function Docs() {
	return (
		<div class="min-h-screen bg-black text-white font-mono p-8">
			<div class="max-w-4xl mx-auto">
				<h1 class="text-4xl font-bold mb-8 text-center">Iro Game Guide</h1>
				<section class="mb-8">
					<h2 class="text-2xl font-bold mb-4 text-yellow-400">World Symbols</h2>
					<div class="bg-gray-900 p-4 rounded-lg">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<h3 class="text-lg font-bold mb-2 text-green-400">
									Player & Entities
								</h3>
								<div class="space-y-1">
									<div>
										<span class="text-white">@</span> - You (the player)
									</div>
									<div>
										<span class="text-red-500 bg-yellow-500 p-1">*</span> - Fire
									</div>
								</div>
							</div>
							<div>
								<h3 class="text-lg font-bold mb-2 text-orange-400">
									Trees & Resources
								</h3>
								<div class="space-y-1">
									<div>
										<span class="text-amber-600">$</span> - Tree trunk (wood)
									</div>
									<div>
										<span class="text-green-500">^</span> - Tree leaves
									</div>
									<div>
										<span class="text-red-500">o</span> - berry bush
									</div>
								</div>
							</div>
							<div>
								<h3 class="text-lg font-bold mb-2 text-gray-400">Terrain</h3>
								<div class="space-y-1">
									<div>
										<span class="text-green-500">.</span> - Grass/empty ground
									</div>
									<div>
										<span class="text-blue-400">~</span> - Water
									</div>
									<div>
										<span class="text-gray-600">#</span> - Rock/mountain
									</div>
									<div>
										<span class="text-yellow-600">#</span> - Copper
									</div>
								</div>
							</div>
						</div>
						<p class="mt-4 text-sm text-gray-400">
							Note: Colors represent different terrain types and may appear
							differently based on distance and lighting.
						</p>
					</div>
				</section>

				<section class="mb-8">
					<h2 class="text-2xl font-bold mb-4 text-yellow-400">
						Core Mechanics
					</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-red-400">Air Supply</h3>
							<p>
								Your air depletes over time. When it reaches 0, you take damage.
								Use O2 canisters to restore air.
							</p>
						</div>
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-green-400">Health</h3>
							<p>
								You have 20 health points. Health regenerates slowly when air is
								above 60%.
							</p>
						</div>
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-blue-400">
								Vision Radius
							</h3>
							<p>
								Your view radius shrinks as your air supply decreases, making
								exploration more dangerous.
							</p>
						</div>
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-yellow-400">Traps</h3>
							<p>
								Hidden traps in the world can damage you when stepped on. Some
								are lethal.
							</p>
						</div>
					</div>
				</section>

				<section class="mb-8">
					<h2 class="text-2xl font-bold mb-4 text-yellow-400">Items & Tools</h2>
					<div class="space-y-4">
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-cyan-400">O2 Canister</h3>
							<p>
								Restores 10 air when used. Essential for survival. Found in
								starting inventory.
							</p>
						</div>
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-gray-400">Pickaxe</h3>
							<p>
								Efficient tool for harvesting wood from trees. Deals 7.5 damage
								to trees. Found in starting inventory.
							</p>
						</div>
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-orange-400">Hands</h3>
							<p>
								Basic tool for harvesting wood. Deals 3 damage to trees. Always
								available.
							</p>
						</div>
						<div class="bg-gray-900 p-4 rounded-lg">
							<h3 class="text-lg font-bold mb-2 text-amber-600">Wood</h3>
							<p>
								Resource obtained from trees. Used for crafting and building.
								Each tree yields 1-5 wood.
							</p>
						</div>
					</div>
				</section>

				<section class="mb-8">
					<h2 class="text-2xl font-bold mb-4 text-yellow-400">
						Inventory System
					</h2>
					<div class="bg-gray-900 p-4 rounded-lg">
						<h3 class="text-lg font-bold mb-2 text-green-400">
							Inventory Slots
						</h3>
						<p class="mb-2">You have 6 inventory slots for storing items.</p>
						<h3 class="text-lg font-bold mb-2 text-green-400">Hand System</h3>
						<p class="mb-2">
							You have left and right hands that can hold different tools. Press
							R to swap items between hands.
						</p>
						<h3 class="text-lg font-bold mb-2 text-green-400">Dominant Hand</h3>
						<p>
							The F key uses the tool in your dominant hand (right hand by
							default).
						</p>
					</div>
				</section>

				<section class="mb-8">
					<h2 class="text-2xl font-bold mb-4 text-yellow-400">Survival Tips</h2>
					<ul class="space-y-2 bg-gray-900 p-4 rounded-lg">
						<li class="flex items-start">
							<span class="text-red-400 mr-2">•</span>
							<span>
								Monitor your air and health percentages - they are displayed at
								the top of the screen
							</span>
						</li>
						<li class="flex items-start">
							<span class="text-red-400 mr-2">•</span>
							<span>
								Use O2 canisters before your air drops to 0 to avoid taking
								damage
							</span>
						</li>
						<li class="flex items-start">
							<span class="text-red-400 mr-2">•</span>
							<span>
								The pickaxe is more efficient than hands for harvesting wood
							</span>
						</li>
						<li class="flex items-start">
							<span class="text-red-400 mr-2">•</span>
							<span>
								Watch for traps - they can instantly kill you if you're not
								careful
							</span>
						</li>
						<li class="flex items-start">
							<span class="text-red-400 mr-2">•</span>
							<span>
								Your vision becomes limited when air is low, making navigation
								harder
							</span>
						</li>
						<li class="flex items-start">
							<span class="text-red-400 mr-2">•</span>
							<span>
								Health regenerates slowly when you have good air supply (above
								60%)
							</span>
						</li>
					</ul>
				</section>

				<section class="mb-8">
					<h2 class="text-2xl font-bold mb-4 text-yellow-400">
						Game Mechanics
					</h2>
					<div class="bg-gray-900 p-4 rounded-lg">
						<h3 class="text-lg font-bold mb-2 text-purple-400">
							Air Depletion
						</h3>
						<p class="mb-2">
							Air decreases by 10 every 4 seconds when above 0.
						</p>
						<h3 class="text-lg font-bold mb-2 text-purple-400">
							Damage System
						</h3>
						<p class="mb-2">
							When air reaches 0, you take 4 damage every 2 seconds. Traps can
							deal 1 or 20 damage.
						</p>
						<h3 class="text-lg font-bold mb-2 text-purple-400">
							Tree Harvesting
						</h3>
						<p>
							Trees require damage to harvest. Once destroyed, they yield 1-5
							wood randomly.
						</p>
					</div>
				</section>

				<div class="text-center mt-12">
					<p class="text-gray-400">Good luck!</p>
				</div>
			</div>
		</div>
	);
}
