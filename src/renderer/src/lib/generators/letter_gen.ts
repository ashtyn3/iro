import seedrandom from "seedrandom";
import letterComponents from "~/lib/generators/letter-components.json";

export function generateLetter(seed: string) {
    const rng = seedrandom(`${seed}--letter`);

    const greetings = letterComponents.game.greetings;
    const openings = letterComponents.game.openings;
    const middles = letterComponents.game.middles;
    const closings = letterComponents.game.closings;

    const greetingSamples = letterComponents.audio.greetings.samples;
    const openingSamples = letterComponents.audio.openings.samples;
    const middleSamples = letterComponents.audio.middles.samples;
    const closingSamples = letterComponents.audio.closings.samples;

    const greeting = greetings[Math.floor(rng() * greetings.length)];
    const opening = openings[Math.floor(rng() * openings.length)];
    const middle = middles[Math.floor(rng() * middles.length)];
    const closing = closings[Math.floor(rng() * closings.length)];

    const greetingSample = greetingSamples[Math.floor(rng() * greetingSamples.length)];
    const openingSample = openingSamples[Math.floor(rng() * openingSamples.length)];
    const middleSample = middleSamples[Math.floor(rng() * middleSamples.length)];
    const closingSample = closingSamples[Math.floor(rng() * closingSamples.length)];

    const letter = `${greeting}\n\n${opening}\n\n${middle}\n\n${closing}`;

    return {
        letter,
        greetingSample,
        openingSample,
        middleSample,
        closingSample,
    }
}