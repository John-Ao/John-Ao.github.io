// Labels describe the source clips; animation keyframes are never synthesized.
const rules = [
  [/^idle$|idle_loop|stand_loop/i, '待机', 'idle'],
  [/idle.*special|special.*idle/i, '特殊待机', 'idle'],
  [/idle/i, '待机', 'idle'],
  [/dialog|interact|greet|hello|handshake|touch|camera|talk|emotion|expression|sit|relax|hug|gift/i, '互动', 'interaction'],
  [/attack|atk|skill|ultimate|ult_|combo|battle|combat|fight|dodge|hit|damage|die|death|finish|execution|revive/i, '战斗', 'combat'],
  [/walk|run|sprint|jump|fall|land|climb|swim|move|turn|dash|slide|vault|rope|zipline/i, '移动', 'movement'],
  [/show|display|menu|select|appear|enter|gacha/i, '展示', 'idle'],
];
const terms = [
  ['dialog_single_handshake', '握手'], ['idle', '待机'], ['walk', '行走'],
  ['run', '奔跑'], ['sprint', '冲刺'], ['jump', '跳跃'], ['attack', '普通攻击'],
  ['skill', '技能'], ['ultimate', '终结技'], ['dodge', '闪避'],
  ['hit', '受击'], ['death', '倒下'], ['die', '倒下'], ['sit', '坐姿'],
  ['greet', '招呼'], ['handshake', '握手'], ['dialog', '对话'],
  ['turn', '转向'], ['special', '特殊'], ['interact', '互动'],
  ['show', '展示'], ['stand', '站立'], ['battle', '战斗'],
];

export function describeClip(clip, index = 0) {
  const name = typeof clip === 'string' ? clip : clip.name || clip.id || `clip_${index}`;
  const rule = rules.find(([pattern]) => pattern.test(name));
  let label = terms.find(([term]) => name.toLowerCase().includes(term))?.[1] || rule?.[1] || '动作';
  const suffix = name.match(/(?:_|\b)(\d+)(?:_|$)/g)?.map(x => x.replaceAll('_', '')).join(' · ');
  if (suffix) label += ` ${suffix}`;
  return { ...(typeof clip === 'object' ? clip : {}), name, label: clip.label || label, category: clip.category || rule?.[2] || 'other' };
}

export function chooseIdle(clips) {
  return clips.find(c => /_ui_overview_loop(?:_\d+)?$/i.test(c.name))
    || clips.find(c => /^(?:char_)?idle(?:_loop)?$/i.test(c.name))
    || clips.find(c => /idle/i.test(c.name) && !/battle|combat|to_|2|3|special/i.test(c.name))
    || clips.find(c => c.category === 'idle') || clips[0];
}
