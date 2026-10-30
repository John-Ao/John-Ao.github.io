// Groups and games are displayed in metadata order.
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
  return parseGameMetadata(await response.json());
}

export function parseGameMetadata(groups) {
  if (!Array.isArray(groups)) throw new Error('游戏分区必须为数组');
  const groupIds = new Set();
  const entries = new Set();
  return groups.map(group => {
    if (!group || typeof group.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(group.id) ||
        groupIds.has(group.id) || typeof group.title !== 'string' || !group.title.trim() ||
        !Array.isArray(group.games)) throw new Error('游戏分区格式错误或分区重复');
    groupIds.add(group.id);
    const games = group.games.map(entry => {
      if (!entry || typeof entry.game !== 'string' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(entry.game) || entries.has(entry.game) ||
          ('title' in entry && (typeof entry.title !== 'string' || !entry.title.trim()))) {
        throw new Error('游戏元数据格式错误或入口重复');
      }
      entries.add(entry.game);
      return {
        game: entry.game,
        title: entry.title ?? formatGameName(entry.game),
        description: 'title' in entry ? formatGameName(entry.game) : '',
        url: `/game/${encodeURIComponent(entry.game)}${standaloneGames.has(entry.game) ? '.html' : '/'}`
      };
    });
    return { id: group.id, title: group.title, games };
  });
}
