// Both entry pages use this catalog; array order determines display order.
// These legacy games are standalone files, not directory index pages.
const standaloneGames = new Set(['connect4', 'othello']);

export function formatGameName(game) {
  return game.replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .split(/[_\s-]+/).filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export async function loadGameMetadata() {
  const response = await fetch('/game/meta.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const games = await response.json();
  if (!Array.isArray(games)) throw new Error('游戏元数据必须为数组');
  const entries = new Set();
  for (const entry of games) {
    if (!entry || typeof entry.game !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(entry.game) || entries.has(entry.game) ||
        ('title' in entry && (typeof entry.title !== 'string' || !entry.title.trim()))) {
      throw new Error('游戏元数据格式错误或入口重复');
    }
    entries.add(entry.game);
  }
  return games.map(entry => ({
    game: entry.game,
    title: entry.title ?? formatGameName(entry.game),
    description: 'title' in entry ? formatGameName(entry.game) : '',
    url: `/game/${encodeURIComponent(entry.game)}${standaloneGames.has(entry.game) ? '.html' : '/'}`
  }));
}
