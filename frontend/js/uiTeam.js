// uiTeam.js
import { getTeams, getMatches, getPools, getTournamentData } from './state.js';
import { getAllPoolStandings } from './uiMath.js';
import { ensureReadableColor, addMinutes, formatTime } from './utils.js';
import { generateBracketData } from './bracketGenerator.js';

export function populateTeamDropdown() {
    const teamSelect = document.getElementById('myTeamSelect');
    if (!teamSelect) return;

    const teams = getTeams();
    teamSelect.innerHTML = '<option value="">-- Select a Team --</option>';
    
    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });

    if (!teamSelect.dataset.listenerAttached) {
        teamSelect.addEventListener('change', (e) => renderMyTeam(e.target.value));
        teamSelect.dataset.listenerAttached = 'true';
    }
}

export function renderMyTeam(teamId) {
    const content = document.getElementById('myTeamContent');
    if (!content) return;

    if (!teamId) {
        content.innerHTML = '';
        return;
    }

    const teams = getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const rawColor = team.color || '#F26922';
    const teamColor = typeof ensureReadableColor === 'function' ? ensureReadableColor(rawColor) : rawColor;
    content.style.setProperty('--accent-orange', teamColor);

    const pools = getPools();
    const matches = getMatches();
    const standingsByPool = getAllPoolStandings();
    const tournamentData = getTournamentData();

    // 1. CALCULATE POOL RECORD
    let poolMatchWins = 0, poolMatchLosses = 0, poolSetWins = 0, poolSetLosses = 0;
    let poolName = 'Unknown Pool';
    let location = tournamentData?.location || 'TBD';

    let myStanding = null;
    for (const [pId, standings] of Object.entries(standingsByPool)) {
        const found = standings.find(t => t.id === teamId);
        if (found) {
            myStanding = found;
            const p = pools.find(pool => pool.id === pId);
            if (p) {
                poolName = p.name;
                // Grab the pool's specific site, then fall back to the tournament default
                location = p.site || tournamentData?.location || 'TBD'; 
            }
            break;
        }
    }

    if (myStanding) {
        poolMatchWins = myStanding.matchesWon || 0;
        poolMatchLosses = (myStanding.matchesPlayed || 0) - poolMatchWins;
        poolSetWins = myStanding.setsWon || 0;
        poolSetLosses = myStanding.setsLost || 0;
    }

    // 2. RESOLVE BRACKET MATCHES
    const config = tournamentData?.bracket_config || {};
    const savedScores = tournamentData?.bracket_scores || {}; // <-- Add this missing line!
    const hasSeeding = config.seeding === 'Yes' || tournamentData?.has_seeding_rounds === true;
    const allTeams = getTeams();
    
    const allBracketMatches = [];
    ['gold', 'silver', 'bronze'].forEach(div => {
        // Skip bronze if it doesn't exist
        if (div === 'bronze' && !config.locBronze) return;
        
        let prefix = div === 'gold' ? 'G' : div === 'silver' ? 'S' : 'B';
        const divMatches = generateBracketData(prefix, pools, allTeams, config, hasSeeding);
        
        // Map the generated matches to match the uiTeam.js format
        const mappedMatches = divMatches.map(m => ({
            id: m.id,
            t1: m.t1,
            t2: m.t2,
            ref: m.ref,
            time: formatTime(m.rawTime),
            col: m.col
        }));
        
        allBracketMatches.push(...mappedMatches);
    });

    const isPoolFinished = (poolId) => {
        const poolTeams = (standingsByPool[poolId] || []).map(t => t.id);
        if (!poolTeams.length) return false;
        const poolMatches = matches.filter(m => poolTeams.includes(m.teamA) || poolTeams.includes(m.teamB));
        return !poolMatches.some(m => m.status !== 'completed' && m.status !== 'complete');
    };

    const resolveTeamId = (refStr) => {
        if (!refStr) return null;
        if (refStr.startsWith('seed:')) {
            const [, poolId, rank] = refStr.split(':');
            const rankIdx = parseInt(rank) - 1;
            if (isPoolFinished(poolId) && standingsByPool[poolId]?.[rankIdx]) {
                return standingsByPool[poolId][rankIdx].id;
            }
            return null;
        }
        if (refStr.startsWith('winner:') || refStr.startsWith('loser:')) {
            const [, matchId] = refStr.split(':');
            const rawScore = savedScores[matchId];
            if (!rawScore) return null;
            if (rawScore.setsA !== undefined && rawScore.setsB !== undefined && rawScore.setsA !== rawScore.setsB) {
                const matchDef = allBracketMatches.find(m => m.id === matchId);
                if (matchDef) {
                    const t1Id = resolveTeamId(matchDef.t1);
                    const t2Id = resolveTeamId(matchDef.t2);
                    if (t1Id && t2Id) {
                        if (refStr.startsWith('winner:')) return rawScore.setsA > rawScore.setsB ? t1Id : t2Id;
                        if (refStr.startsWith('loser:')) return rawScore.setsA > rawScore.setsB ? t2Id : t1Id;
                    }
                }
            }
        }
        return null;
    };

    const resolveTeamName = (refStr, resolvedId) => {
        if (resolvedId) {
            const t = teams.find(t => t.id === resolvedId);
            if (t) return t.name;
        }
        if (refStr.startsWith('seed:')) {
            const [, poolId, rank] = refStr.split(':');
            const p = pools.find(pl => pl.id === poolId);
            const rankStr = rank == 1 ? '1st' : rank == 2 ? '2nd' : rank == 3 ? '3rd' : '4th';
            return `${rankStr} ${p ? p.name : 'Pool'}`;
        }
        if (refStr.startsWith('winner:')) return `Winner ${refStr.split(':')[1]}`;
        if (refStr.startsWith('loser:')) return `Loser ${refStr.split(':')[1]}`;
        return 'TBD';
    };

    const myBracketMatches = allBracketMatches.map(m => {
        const t1Id = resolveTeamId(m.t1);
        const t2Id = resolveTeamId(m.t2);
        const refId = resolveTeamId(m.ref);
        return { 
            ...m, t1Id, t2Id, refId,
            teamAName: resolveTeamName(m.t1, t1Id),
            teamBName: resolveTeamName(m.t2, t2Id),
            refName: resolveTeamName(m.ref, refId),
            rawScore: savedScores[m.id] || {}
        };
    }).filter(m => m.t1Id === teamId || m.t2Id === teamId || m.refId === teamId);

    let bracketMatchWins = 0, bracketMatchLosses = 0, bracketSetWins = 0, bracketSetLosses = 0;
    let highestRound = 0;
    let wonHighest = false;
    let divName = '';
    
    myBracketMatches.forEach(m => {
        if (m.t1Id === teamId || m.t2Id === teamId) {
            const rs = m.rawScore;
            if (rs && rs.setsA !== undefined && rs.setsB !== undefined && rs.setsA !== rs.setsB) {
                const iAmT1 = m.t1Id === teamId;
                const mySets = iAmT1 ? rs.setsA : rs.setsB;
                const oppSets = iAmT1 ? rs.setsB : rs.setsA;
                
                bracketSetWins += mySets;
                bracketSetLosses += oppSets;
                const wonMatch = mySets > oppSets;
                if (wonMatch) bracketMatchWins++;
                else bracketMatchLosses++;

                // Inside uiTeam.js, where you calculate highestRound:
                let round = 0;
                if (m.col === 'Quarterfinals') round = 1;
                else if (m.col === 'Semifinals') round = 2;
                else if (m.col === 'Finals' || m.col === 'Championship') round = 3;
                
                if (round > highestRound) highestRound = round;
            }
        }
    });

    let finishBadgeHtml = '';
    if (highestRound === 3) {
        if (wonHighest) finishBadgeHtml = `<div style="display: inline-block; background: var(--accent-orange); color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; margin-top: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🏆 ${divName} Division Champion</div>`;
        else finishBadgeHtml = `<div style="display: inline-block; background: #475569; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; margin-top: 6px;">🥈 ${divName} Division Runner-Up</div>`;
    } else if (highestRound === 2 && !wonHighest) {
        finishBadgeHtml = `<div style="display: inline-block; background: #334155; color: #cbd5e1; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.8rem; margin-top: 6px;">🏅 ${divName} Semi-Finalist</div>`;
    } else if (highestRound === 1 && !wonHighest) {
        finishBadgeHtml = `<div style="display: inline-block; background: #334155; color: #cbd5e1; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.8rem; margin-top: 6px;">🏅 ${divName} Quarter-Finalist</div>`;
    }

    // 3. BUILD HEADER
    const logoHtml = team.logo_id 
        ? `<img src="${team.logo_id}" style="width: 70px; height: 70px; object-fit: contain;">`
        : `<div style="width: 70px; height: 70px; border-radius: 8px; background: var(--accent-orange);"></div>`;

    let html = `
        <div class="team-header-container">
            <div class="team-header-identity">
                ${logoHtml}
                <div>
                    <h2 style="margin: 0 0 4px 0; color: var(--accent-orange); font-size: 1.8rem;">${team.name}</h2>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">🏐 ${poolName} | ${location}</p>
                    ${finishBadgeHtml}
                </div>
            </div>
            
            <div class="team-header-stats">
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: bold; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Pool Play</div>
                    <div style="display: flex; gap: 20px; justify-content: center;">
                        <div>
                            <div style="font-size: 1.4rem; font-weight: bold; color: white;">${poolMatchWins} - ${poolMatchLosses}</div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase;">Matches</div>
                        </div>
                        <div>
                            <div style="font-size: 1.4rem; font-weight: bold; color: white;">${poolSetWins} - ${poolSetLosses}</div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase;">Sets</div>
                        </div>
                    </div>
                </div>
                
                <div class="header-divider" style="width: 1px; background: #334155; display: block;"></div>
                
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: bold; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Bracket Play</div>
                    <div style="display: flex; gap: 20px; justify-content: center;">
                        <div>
                            <div style="font-size: 1.4rem; font-weight: bold; color: white;">${bracketMatchWins} - ${bracketMatchLosses}</div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase;">Matches</div>
                        </div>
                        <div>
                            <div style="font-size: 1.4rem; font-weight: bold; color: white;">${bracketSetWins} - ${bracketSetLosses}</div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase;">Sets</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Determine the next upcoming match index for pool matches to highlight it automatically
    const myPoolMatches = matches.filter(m => m.teamA === team.id || m.teamB === team.id || m.ref === team.id);
    myPoolMatches.sort((a, b) => a.time.localeCompare(b.time));
    const nextPoolMatchId = myPoolMatches.find(m => m.status !== 'completed' && m.status !== 'complete')?.id;

    // 4. MATCH CARD TEMPLATE
    const buildMatchCard = (m, isBracket = false, matchLabel = '') => {
        const refProperty = isBracket ? m.refId : m.ref; 
        const isRefOnly = refProperty === team.id && (isBracket ? (m.t1Id !== team.id && m.t2Id !== team.id) : (m.teamA !== team.id && m.teamB !== team.id));
        
        const tAId = isBracket ? m.t1Id : m.teamA;
        const tBId = isBracket ? m.t2Id : m.teamB;
        
        const teamAName = isBracket ? m.teamAName : (teams.find(t => t.id === m.teamA)?.name || 'TBD');
        const teamBName = isBracket ? m.teamBName : (teams.find(t => t.id === m.teamB)?.name || 'TBD');
        const refName = isBracket ? m.refName : (teams.find(t => t.id === m.ref)?.name || 'TBD');
        
        let s1A = isBracket ? m.rawScore?.s1A : m.s1A;
        let s1B = isBracket ? m.rawScore?.s1B : m.s1B;
        let s2A = isBracket ? m.rawScore?.s2A : m.s2A;
        let s2B = isBracket ? m.rawScore?.s2B : m.s2B;
        let s3A = isBracket ? m.rawScore?.s3A : m.s3A;
        let s3B = isBracket ? m.rawScore?.s3B : m.s3B;

        let isComplete = false;
        let matchWinnerId = null;
        let matchState = 'pending';

        if (isBracket) {
            isComplete = m.rawScore?.setsA !== undefined && m.rawScore?.setsB !== undefined && m.rawScore.setsA !== m.rawScore.setsB;
            if (isComplete) {
                matchState = 'completed';
                matchWinnerId = (m.rawScore.setsA > m.rawScore.setsB) ? tAId : tBId;
            } else if (s1A !== null && s1A !== undefined && s1A !== '') {
                matchState = 'active';
            }
        } else {
            isComplete = m.status === 'completed' || m.status === 'complete';
            if (isComplete) {
                matchState = 'completed';
                let setsA = 0, setsB = 0;
                if (parseFloat(s1A) > parseFloat(s1B)) setsA++; else if (parseFloat(s1B) > parseFloat(s1A)) setsB++;
                if (parseFloat(s2A) > parseFloat(s2B)) setsA++; else if (parseFloat(s2B) > parseFloat(s2A)) setsB++;
                if (parseFloat(s3A) > parseFloat(s3B)) setsA++; else if (parseFloat(s3B) > parseFloat(s3A)) setsB++;
                if (setsA > setsB) matchWinnerId = tAId;
                else if (setsB > setsA) matchWinnerId = tBId;
            } else if (m.status === 'active' || m.id === nextPoolMatchId) {
                matchState = 'active';
            }
        }

        const displayTime = isBracket ? m.time : formatTime(m.time);
        
        let statusBadge = '';
        if (matchState === 'completed') {
            statusBadge = `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid #334155; color: #94a3b8; border-radius: 4px; font-size: 0.7rem;" title="Completed">✔</div>`;
        } else if (matchState === 'active') {
            statusBadge = `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid #22c55e; background: rgba(34, 197, 94, 0.1); color: #22c55e; border-radius: 4px; font-size: 0.65rem; padding-left: 2px;" title="Active">▶</div>`;
        } else {
            statusBadge = `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid var(--accent-orange); color: var(--accent-orange); border-radius: 4px; font-size: 0.8rem;" title="Upcoming">-</div>`;
        }

        // Gracefully truncate long ref names instead of wrapping
        const refBadge = isRefOnly 
            ? `<span style="background: var(--accent-orange); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; display: inline-block; flex-shrink: 0;">REF DUTY</span>`
            : `<span style="border: 1px solid #334155; color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; display: inline-flex; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; flex-shrink: 1;">Ref:&nbsp;<span style="color: ${refName === team.name ? 'var(--accent-orange)' : '#cbd5e1'}; font-weight: 500; overflow: hidden; text-overflow: ellipsis;">${refName}</span></span>`;

        let tAColor = 'white', tBColor = 'white';
        let tAWeight = 'normal', tBWeight = 'normal';

        if (isComplete) {
            tAColor = (matchWinnerId === tAId) ? 'var(--accent-orange)' : '#64748b';
            tBColor = (matchWinnerId === tBId) ? 'var(--accent-orange)' : '#64748b';
            tAWeight = (matchWinnerId === tAId) ? 'bold' : 'normal';
            tBWeight = (matchWinnerId === tBId) ? 'bold' : 'normal';
        } else {
            tAColor = (tAId === team.id) ? 'var(--accent-orange)' : 'white';
            tBColor = (tBId === team.id) ? 'var(--accent-orange)' : 'white';
            tAWeight = (tAId === team.id) ? 'bold' : 'normal';
            tBWeight = (tBId === team.id) ? 'bold' : 'normal';
        }

        const renderScoreBox = (score, isWinner) => {
            if (score === null || score === undefined || score === '' || score === '-') {
                return `<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: #475569; border: 1px solid transparent; box-sizing: border-box;">-</div>`;
            }
            if (isWinner) {
                return `<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid var(--accent-orange); border-radius: 4px; font-weight: bold; color: white; box-sizing: border-box;">${score}</div>`;
            }
            return `<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: #94a3b8; border: 1px solid transparent; box-sizing: border-box;">${score}</div>`;
        };

        const s1A_html = renderScoreBox(s1A, s1A !== null && s1A !== '-' && parseFloat(s1A) > parseFloat(s1B));
        const s1B_html = renderScoreBox(s1B, s1B !== null && s1B !== '-' && parseFloat(s1B) > parseFloat(s1A));
        const s2A_html = renderScoreBox(s2A, s2A !== null && s2A !== '-' && parseFloat(s2A) > parseFloat(s2B));
        const s2B_html = renderScoreBox(s2B, s2B !== null && s2B !== '-' && parseFloat(s2B) > parseFloat(s2A));
        const s3A_html = renderScoreBox(s3A, s3A !== null && s3A !== '-' && parseFloat(s3A) > parseFloat(s3B));
        const s3B_html = renderScoreBox(s3B, s3B !== null && s3B !== '-' && parseFloat(s3B) > parseFloat(s3A));

        const isActive = matchState === 'active';
        const cardBg = isActive ? '#24334a' : '#1e293b';
        const cardBorder = isActive ? '1px solid var(--accent-orange)' : '1px solid #334155';
        const cardLeftBorder = isActive ? '4px solid var(--accent-orange)' : (!isRefOnly ? '4px solid var(--accent-orange)' : '4px solid #334155');
        const cardShadow = isActive ? '0 4px 15px rgba(0,0,0,0.5)' : 'none';

        // Notice the height: 100% on the main container and flex-wrap: nowrap on the header group!
        return `
            <div style="background: ${cardBg}; border-radius: 8px; border: ${cardBorder}; border-left: ${cardLeftBorder}; padding: 10px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; box-shadow: ${cardShadow}; height: 100%; box-sizing: border-box; justify-content: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                    <div style="display: flex; flex-wrap: nowrap; gap: 6px; align-items: center; overflow: hidden; flex: 1;">
                        ${statusBadge}
                        ${matchLabel ? `<span style="color: white; font-size: 0.65rem; font-weight: bold; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; display: inline-block; white-space: nowrap; flex-shrink: 0;">${matchLabel}</span>` : ''}
                        ${refBadge}
                    </div>
                    <div style="text-align: right; flex-shrink: 0;">
                        <div style="color: var(--accent-orange); font-size: 0.75rem; font-weight: bold; white-space: nowrap;">🕒 ${displayTime}</div>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="color: ${tAColor}; font-weight: ${tAWeight}; font-size: 0.85rem; flex-grow: 1; padding-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${teamAName}</div>
                        <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                            ${s1A_html} ${s2A_html} ${s3A_html}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="color: ${tBColor}; font-weight: ${tBWeight}; font-size: 0.85rem; flex-grow: 1; padding-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${teamBName}</div>
                        <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                            ${s1B_html} ${s2B_html} ${s3B_html}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // 5. RENDER POOL MATCHES
    html += `<h3 style="color: white; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; font-size: 1.1rem;">Pool Schedule & Duties</h3>`;
    
    if (myPoolMatches.length === 0) {
        html += `<p style="color: var(--text-secondary);">No pool matches scheduled yet.</p>`;
    } else {
        html += `<div class="team-match-grid">`;
        myPoolMatches.forEach(m => {
            html += buildMatchCard(m, false);
        });
        html += `</div>`;
    }

    // 6. RENDER BRACKET MATCHES
    html += `<h3 style="color: white; margin-top: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; font-size: 1.1rem;">Bracket Matches</h3>`;

    if (myBracketMatches.length === 0) {
        html += `<div class="team-match-grid"><p style="color: var(--text-secondary); font-size: 0.9rem;">Bracket scheduling depends on pool play results.</p></div>`;
    } else {
        html += `<div class="team-match-grid">`;
        myBracketMatches.forEach(m => {
            html += buildMatchCard(m, true, `Match ${m.id}`);
        });
        html += `</div>`;
    }

    content.innerHTML = html;
}