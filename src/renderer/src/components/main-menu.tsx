export default function MainMenu({
  handleNewGame,
  setCurrentState,
}: {
  handleNewGame: () => void;
  setCurrentState: (state: string) => void;
}) {
  return (
    <div id="menu" class="flex flex-col gap-3 text-center">
      <h1>IRO</h1>
      <i>By Ashtyn</i>
      <button
        type="button"
        onClick={handleNewGame}
        class="bg-transparent border-2 border-white text-white text-base font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
      >
        &gt; NEW &lt;
      </button>
      <button
        type="button"
        onClick={() => setCurrentState("select")}
        class="bg-transparent border-2 border-white text-white text-base font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
      >
        &gt; LOAD &lt;
      </button>
      <button
        type="button"
        onClick={() => setCurrentState("settings")}
        class="bg-transparent border-2 border-white text-white text-base font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
      >
        &gt; SETTINGS &lt;
      </button>
    </div>
  );
}
