// uiMath.js
import { getTeams, getMatches, getPools } from './state.js';

export function getPoolStandings(poolId) {
    const allTeams = getTeams();
    const allMatches = getMatches();

    const poolTeams = allTeams.filter(team => team.pool_id === poolId);

    const standings = poolTeams.map(team => ({
        id: team.id,
        name: team.name,
        color: team.color || '#3b82f6',
        logo_id: team.logo_id,
        seed: parseInt(team.seed, 10) || 99, 
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        setsWon: 0,
        setsLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        setDiff: 0,
        pointDiff: 0
    }));

    const statsMap = new Map(standings.map(s => [s.id, s]));

    allMatches.forEach(match => {
        if (match.status !== 'completed' && match.status !== 'complete') return;
        
        const t1 = statsMap.get(match.teamA);
        const t2 = statsMap.get(match.teamB);

        if (!t1 || !t2) return;

        let t1Sets = 0;
        let t2Sets = 0;
        
        // Strict Number parsing prevents alphabetical string comparisons (e.g. '9' > '25')
        if (Number(match.s1A || 0) > Number(match.s1B || 0)) t1Sets++; else if (Number(match.s1B || 0) > Number(match.s1A || 0)) t2Sets++;
        if (Number(match.s2A || 0) > Number(match.s2B || 0)) t1Sets++; else if (Number(match.s2B || 0) > Number(match.s2A || 0)) t2Sets++;
        if (Number(match.s3A || 0) > Number(match.s3B || 0)) t1Sets++; else if (Number(match.s3B || 0) > Number(match.s3A || 0)) t2Sets++;

        t1.setsWon += t1Sets;
        t1.setsLost += t2Sets;
        t2.setsWon += t2Sets;
        t2.setsLost += t1Sets;

        t1.matchesPlayed++;
        t2.matchesPlayed++;

        if (t1Sets > t2Sets) {
            t1.matchesWon++;
            t2.matchesLost++;
        } else if (t2Sets > t1Sets) {
            t2.matchesWon++;
            t1.matchesLost++;
        }

        // Strict Number parsing prevents string concatenation (e.g. '25' + '25' = '25250')
        const t1Points = Number(match.s1A || 0) + Number(match.s2A || 0) + Number(match.s3A || 0);
        const t2Points = Number(match.s1B || 0) + Number(match.s2B || 0) + Number(match.s3B || 0);

        t1.pointsFor += t1Points;
        t1.pointsAgainst += t2Points;
        t2.pointsFor += t2Points;
        t2.pointsAgainst += t1Points;
    });

    standings.forEach(stats => {
        stats.setDiff = stats.setsWon - stats.setsLost;
        stats.pointDiff = stats.pointsFor - stats.pointsAgainst;
    });

    return standings.sort((a, b) => {
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        return a.seed - b.seed; 
    });
}

export function getAllPoolStandings() {
    const pools = getPools();
    const standingsByPool = {};

    pools.forEach(pool => {
        standingsByPool[pool.id] = getPoolStandings(pool.id);
    });

    return standingsByPool;
}

// Add to the bottom of uiMath.js
export const checkMathematicalLock = (team, index, standings, maxMatches) => {
    if (maxMatches === 0 || team.matchesPlayed !== maxMatches) return false;
    
    let safeFromAbove = true;
    let safeFromBelow = true;

    for (let i = 0; i < index; i++) {
        if (standings[i].matchesPlayed < maxMatches && standings[i].matchesWon <= team.matchesWon) {
            safeFromAbove = false;
        }
    }
    for (let i = index + 1; i < standings.length; i++) {
        const maxPossibleWins = standings[i].matchesWon + (maxMatches - standings[i].matchesPlayed);
        if (standings[i].matchesPlayed < maxMatches && maxPossibleWins >= team.matchesWon) {
            safeFromBelow = false;
        }
    }
    
    return safeFromAbove && safeFromBelow;
};

// Add to uiMath.js
export const isSeedLocked = (poolId, rankIndex, poolStandings, allMatches) => {
    const poolTeams = poolStandings.map(t => t.id);
    if (poolTeams.length === 0) return false;

    const poolMatches = allMatches.filter(m => poolTeams.includes(m.teamA) || poolTeams.includes(m.teamB));
    if (poolMatches.length === 0) return false;

    const unfinished = poolMatches.filter(m => m.status !== 'completed' && m.status !== 'complete');
    if (unfinished.length === 0) return true;

    const team = poolStandings[rankIndex];
    if (!team) return false;
    if (team.isLocked || team.clinched) return true;

    const expectedMatches = poolTeams.length - 1; 
    if (team.matchesPlayed < expectedMatches) return false;

    const wins = team.matchesWon;
    if (rankIndex > 0) {
        const teamAbove = poolStandings[rankIndex - 1];
        if (teamAbove.matchesWon <= wins && teamAbove.matchesPlayed < expectedMatches) return false;
    }
    if (rankIndex < poolTeams.length - 1) {
        const teamBelow = poolStandings[rankIndex + 1];
        const maxPossibleWinsBelow = teamBelow.matchesWon + (expectedMatches - teamBelow.matchesPlayed);
        if (maxPossibleWinsBelow >= wins && teamBelow.matchesPlayed < expectedMatches) return false;
    }
    return true;
};