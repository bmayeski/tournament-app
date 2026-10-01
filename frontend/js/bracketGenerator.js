// bracketGenerator.js
import { addMinutes } from './utils.js';

export const generateBracketData = (prefix, pools, allTeams, config, hasSeeding) => {
    const bDur = parseInt(config.bracketDuration || 60, 10);
    const configStart = config.start || '13:00';
    const getRoundTime = (offsetMultiplier) => addMinutes(configStart, bDur * offsetMultiplier);

    // 1. USE CUSTOM OVERRIDES IF ADMIN SET THEM VIA 🔀
    if (config?.customTemplates?.[prefix]) {
        return config.customTemplates[prefix].map(match => ({
            col: match.col,
            rawTime: getRoundTime(match.timeOffset || 0),
            id: match.id,
            t1: match.t1,
            t2: match.t2,
            ref: match.ref
        }));
    }

    // 2. FULLY FLUID DYNAMIC ENGINE
    const pA = pools[0]?.id || 'poolA';
    const pB = pools[1]?.id || 'poolB';
    const pC = pools[2]?.id || 'poolC';
    const pD = pools[3]?.id || 'poolD';

    const tQf1 = getRoundTime(hasSeeding ? 2 : 0);
    const tQf2 = getRoundTime(hasSeeding ? 3 : 1);
    const tSf  = getRoundTime(hasSeeding ? 4 : 2);
    const tFinal = getRoundTime(hasSeeding ? 5 : 3);

    // Determine standard rank offsets based on division prefix
    // Gold takes top ranks from each pool (1st/2nd), Silver takes next slice (3rd/4th)
    let r1 = 1, r2 = 2;
    if (prefix === 'S') { r1 = 3; r2 = 4; }
    else if (prefix === 'B') { r1 = 5; r2 = 6; }

    // Check how many teams actually exist for these ranks to handle dropouts/BYEs gracefully
    const checkTeamExists = (poolId, rank) => {
        const poolTeamList = allTeams.filter(t => t.pool_id === poolId).sort((a, b) => (a.seed || 99) - (b.seed || 99));
        return poolTeamList[rank - 1] ? `seed:${poolId}:${rank}` : 'BYE';
    };

    // Standard 8-Team Bracket Layout (Quarterfinals -> Semis -> Finals)
    return [
        { col: 'Quarterfinals', timeOffset: 0, rawTime: tQf1, id: `${prefix}1`, t1: checkTeamExists(pA, r1), t2: checkTeamExists(pB, r2), ref: checkTeamExists(pC, r2) },
        { col: 'Quarterfinals', timeOffset: 1, rawTime: tQf2, id: `${prefix}2`, t1: checkTeamExists(pD, r1), t2: checkTeamExists(pC, r2), ref: `loser:${prefix}1` },
        { col: 'Quarterfinals', timeOffset: 1, rawTime: tQf2, id: `${prefix}3`, t1: checkTeamExists(pC, r1), t2: checkTeamExists(pD, r2), ref: `loser:${prefix}4` },
        { col: 'Quarterfinals', timeOffset: 0, rawTime: tQf1, id: `${prefix}4`, t1: checkTeamExists(pB, r1), t2: checkTeamExists(pA, r2), ref: checkTeamExists(pD, r2) },
        { col: 'Semifinals', timeOffset: 2, rawTime: tSf, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2` },
        { col: 'Semifinals', timeOffset: 2, rawTime: tSf, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3` },
        { col: 'Finals', timeOffset: 3, rawTime: tFinal, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5` }
    ];
};