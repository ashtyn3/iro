import seedrandom from "seedrandom";
import letterComponents from "~/lib/generators/letter-components.json";

export function generateLetter(seed: string) {
    const rng = seedrandom(`${seed}--letter`);

    const greetings = letterComponents.game.greetings;
    const openings = letterComponents.game.openings;
    const middles = letterComponents.game.middles;
    const closings = letterComponents.game.closings;


    const greetingIndex = Math.floor(rng() * greetings.length);
    const openingIndex = Math.floor(rng() * openings.length);
    const middleIndex = Math.floor(rng() * middles.length);
    const closingIndex = Math.floor(rng() * closings.length);

    const greeting = greetings[greetingIndex];
    const opening = openings[openingIndex];
    const middle = middles[middleIndex];
    const closing = closings[closingIndex];

    const greetingSample = `greetings_${greetingIndex}`;
    const openingSample = `openings_${openingIndex}`;
    const middleSample = `middles_${middleIndex}`;
    const closingSample = `closings_${closingIndex}`;

    const letter = [greeting, opening, middle, closing];
    const sprites = [greetingSample, openingSample, middleSample, closingSample];

    return {
        letter,
        sprites,
    }
}