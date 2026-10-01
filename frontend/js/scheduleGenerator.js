// scheduleGenerator.js
import { minutesToTimeStr } from './utils.js';

// Standard USAV bracket templates. Numbers represent array indexes (0 = Seed 1, 1 = Seed 2, etc.)
const SCHEDULE_TEMPLATES = {
    3: [
        [0, 2, 1], // Match 1: 1 v 3 (Ref 2)
        [1, 2, 0], // Match 2: 2 v 3 (Ref 1)
        [0, 1, 2]  // Match 3: 1 v 2 (Ref 3)
    ],
    4: [
        [0, 2, 1], // Match 1: 1 v 3 (Ref 2)
        [1, 3, 0], // Match 2: 2 v 4 (Ref 1)
        [0, 3, 2], // Match 3: 1 v 4 (Ref 3)
        [1, 2, 0], // Match 4: 2 v 3 (Ref 1)
        [2, 3, 1], // Match 5: 3 v 4 (Ref 2)
        [0, 1, 3]  // Match 6: 1 v 2 (Ref 4)
    ],
    5: [
        [0, 4, 2], // Match 1: 1 v 5 (Ref 3)
        [1, 3, 0], // Match 2: 2 v 4 (Ref 1)
        [0, 3, 4], // Match 3: 1 v 4 (Ref 5)
        [1, 2, 0], // Match 4: 2 v 3 (Ref 1)
        [2, 4, 1], // Match 5: 3 v 5 (Ref 2)
        [0, 2, 4], // Match 6: 1 v 3 (Ref 5)
        [3, 4, 0], // Match 7: 4 v 5 (Ref 1)
        [0, 1, 3], // Match 8: 1 v 2 (Ref 4)
        [2, 3, 1], // Match 9: 3 v 4 (Ref 2)
        [1, 4, 2]  // Match 10: 2 v 5 (Ref 3)
    ]
};

export const generatePoolSchedule = (teams, poolsList, startMins, incrementMins) => {
    const poolsMap = {};
    
    // Group teams by their assigned pools
    teams.forEach(team => {
        if (team.pool_id) {
            if (!poolsMap[team.pool_id]) poolsMap[team.pool_id] = [];
            poolsMap[team.pool_id].push(team);
        }
    });

    // Sort pools alphabetically (Pool A, Pool B, etc.)
    const sortedPoolIds = Object.keys(poolsMap).sort((idA, idB) => {
        const poolA = poolsList.find(p => p.id === idA)?.name || '';
        const poolB = poolsList.find(p => p.id === idB)?.name || '';
        return poolA.localeCompare(poolB);
    });

    let generatedMatches = [];

    // Loop through each pool and generate matches based on team count
    sortedPoolIds.forEach(poolId => {
        // Sort teams in this pool by their seed (1, 2, 3, 4...)
        const poolTeams = poolsMap[poolId].sort((a, b) => (parseInt(a.seed) || 99) - (parseInt(b.seed) || 99));
        const teamCount = poolTeams.length;

        const template = SCHEDULE_TEMPLATES[teamCount];
        
        if (!template) {
            console.warn(`Cannot generate schedule: No USAV template exists for a ${teamCount}-team pool.`);
            return;
        }

        // Map the template to the actual team IDs and calculate match times
        template.forEach((matchup, index) => {
            const [t1Index, t2Index, refIndex] = matchup;
            generatedMatches.push({
                id: crypto.randomUUID(),
                pool_id: poolId,
                teamA: poolTeams[t1Index]?.id,
                teamB: poolTeams[t2Index]?.id,
                ref: poolTeams[refIndex]?.id,
                time: minutesToTimeStr(startMins + (index * incrementMins))
            });
        });
    });

    return generatedMatches;
};