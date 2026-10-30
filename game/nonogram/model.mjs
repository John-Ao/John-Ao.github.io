export * from "./core.mjs";
import { curatedLevels } from "./curated.mjs";
import { generatedLevels } from "./levels.generated.mjs";
export const levels = [...curatedLevels, ...generatedLevels];
