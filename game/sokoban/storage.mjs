// v1 indices 60–83 were the first Microban selection. Never reinterpret practice saves.
const legacyIds = ["microban-79","microban-10","microban-13","microban-49","microban-61","microban-43","microban-37","microban-73","microban-70","microban-68","microban-6","microban-54","microban-64","microban-35","microban-74","microban-75","microban-69","microban-80","microban-16","microban-72","microban-65","microban-60","microban-77","microban-76"];
export const STORAGE_KEY = 'sokoban-v2';
export function readStore(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const value = JSON.parse(saved);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    const old = JSON.parse(storage.getItem('sokoban-v1'));
    if (!old || typeof old !== 'object') return {};
    const result = {};
    legacyIds.forEach((id,i) => { if(old[i+60]) result[id] = old[i+60]; });
    if(Number.isInteger(old.current) && legacyIds[old.current-60]) result.current=legacyIds[old.current-60];
    return result;
  } catch { return {}; }
}
