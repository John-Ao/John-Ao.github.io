import { classicLevels } from "./classic-levels.mjs";
export const levels = classicLevels;
export const defaultLevel = 0;
export const groups = [...new Set(levels.map(l => l.group))];
