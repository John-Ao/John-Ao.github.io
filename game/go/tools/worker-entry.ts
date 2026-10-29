// Keep UI legality and search legality identical: area, positional superko,
// no suicide, no handicap compensation (this UI does not place handicap stones).
import { RULES } from '../vendor/katago-src/src/utils/goRules';
import '../vendor/katago-src/src/engine/katago/worker';
RULES.chinese = { ...RULES.chinese, ko: 'positional', handicapBonus: 'zero' };
