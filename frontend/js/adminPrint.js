// adminPrint.js
import { getTournamentData, getPools, getTeams, getMatches } from './state.js';
import { getAllPoolStandings, isSeedLocked } from './uiMath.js';
import { formatTime, addMinutes, getSiteColor } from './utils.js';
import { generateBracketData } from './bracketGenerator.js';

export function printPoolSheets() {
    const tournamentData = getTournamentData();
    const pools = getPools();
    const allTeams = getTeams();
    const allMatches = getMatches(); 
    
    if (!pools || pools.length === 0) {
        alert("No pools have been created yet.");
        return;
    }

    let config = tournamentData?.bracket_config || {};
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch(e) {}
    }
    
    const poolStart = config.poolStartTime || tournamentData?.start_time || '08:00';
    const poolDur = parseInt(config.poolDuration || '60', 10);

    const toRoman = (num) => {
        if (!num || num === 0) return '';
        const roman = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        return roman[num] || num;
    };
    
    const getOrdinal = (n) => {
        if (n === 1) return '1st';
        if (n === 2) return '2nd';
        if (n === 3) return '3rd';
        if (n === 4) return '4th';
        return n + 'th';
    };

    const formatSeedPrint = (refStr) => {
        if (!refStr) return '?';
        if (typeof refStr === 'string' && refStr.startsWith('seed:')) {
            const parts = refStr.split(':');
            const poolObj = pools.find(p => p.id === parts[1]);
            const pName = poolObj ? poolObj.name.replace('Pool ', '') : '';
            const r = parseInt(parts[2], 10);
            const rStr = r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : r === 4 ? '4th' : r;
            return `${rStr} ${pName}`;
        }
        
        const realTeam = allTeams.find(t => t.id === refStr);
        if (realTeam) return realTeam.seed || '?';

        return '?';
    };

    const printWin = window.open('', '_blank');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Pool Sheets - ${tournamentData.name}</title>
        <style>
            @page { size: landscape; margin: 0.25in; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
            .page { page-break-after: always; display: flex; flex-direction: column; min-height: 95vh; box-sizing: border-box; }
            .page:last-child { page-break-after: auto; }
            
            .header { margin-bottom: 15px; border-bottom: 2px solid #64748b; padding-bottom: 10px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase; color: #000; }
            
            table.standings-table { width: 80%; margin: 0 auto 35px auto; border-collapse: separate; border-spacing: 0; border: 2px solid #64748b; border-radius: 8px; }
            table.standings-table th, table.standings-table td { border-right: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; padding: 8px 12px; text-align: center; font-size: 16px; }
            table.standings-table th:last-child, table.standings-table td:last-child { border-right: none; }
            table.standings-table tr:last-child td { border-bottom: none; }
            
            table.standings-table th { text-transform: uppercase; font-weight: bold; background-color: transparent; color: #334155; }
            table.standings-table td.team-name { text-align: left; font-weight: bold; width: 40%; font-size: 18px; color: #0f172a; }
            table.standings-table td.team-rank { font-weight: 900; color: #475569; width: 30px; font-size: 18px; }
            
            .placement-badge { display: inline-block; width: 36px; text-align: center; padding: 2px 0; border-radius: 4px; font-size: 13px; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .badge-1st { background-color: #fbbf24 !important; color: #000 !important; }
            .badge-2nd { background-color: #cbd5e1 !important; color: #000 !important; }
            .badge-3rd { background-color: #cd7f32 !important; color: #fff !important; }
            .badge-4th { background-color: #475569 !important; color: #fff !important; }
            .badge-other { background-color: #0f172a !important; color: #fff !important; }
            
            .pool-info-cell { vertical-align: middle; border-top-left-radius: 8px; }
            .location-name { font-size: 13px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
            .pool-badge { display: inline-block; padding: 4px 16px; color: #fff !important; font-size: 18px; font-weight: bold; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .matches-wrapper { width: 75%; margin: 0 auto 20px auto; display: flex; flex-direction: column; gap: 12px; }
            .match-row { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 6px 15px; border: 2px solid #cbd5e1; border-radius: 8px; }
            
            .time-badge { position: absolute; top: -9px; left: 15px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            
            .match-info { font-weight: bold; font-size: 16px; display: flex; align-items: center; gap: 8px; width: 320px; flex-shrink: 0; color: #0f172a; }
            .match-num { width: 70px; display: inline-block; color: #475569; }
            .ref-info { font-weight: normal; font-size: 14px; font-style: italic; color: #64748b; margin-left: auto; }
            
            .seed-badge { display: inline-block; min-width: 22px; height: 22px; line-height: 22px; padding: 0 4px; text-align: center; border-radius: 4px; font-weight: 900; color: #475569; white-space: nowrap; box-sizing: border-box; }
            .winner-seed { background-color: #cbd5e1 !important; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .game-boxes { display: flex; gap: 20px; flex-grow: 1; justify-content: flex-end; }
            .game-box-group { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; color: #475569; }
            .box { width: 36px; height: 26px; border: 2px solid #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #0f172a; font-weight: bold; }
            
            .footer { padding-top: 10px; font-size: 15px; font-style: italic; text-align: center; border-top: 2px dashed #94a3b8; margin-top: auto; color: #334155; }
            .footer-primary { font-weight: bold; margin-bottom: 4px; }
            .footer-disclaimer { font-size: 13px; font-weight: 600; color: #64748b; }
        </style>
    </head>
    <body>
    `;

    pools.forEach(pool => {
        let poolAdvancementText = "";
        const pName = (pool.name || '').toUpperCase();
        if (pName.includes('A') || pName.includes('B')) {
            poolAdvancementText = "1st & 2nd advance to Gold. 3rd Pool B auto-advances to Silver. 3rd Pool A plays 4th Pool B for Silver.";
        } else {
            poolAdvancementText = "1st & 2nd play Crossover for Gold. 3rd Pool C plays 4th Pool D for Silver.";
        }

        const poolTeams = allTeams.filter(t => t.pool_id === pool.id).sort((a, b) => a.seed - b.seed);
        const siteColor = getSiteColor(pool.site);
        const poolMatches = allMatches.filter(m => m.pool_id === pool.id).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        
        const teamStats = {};
        poolTeams.forEach(t => teamStats[t.id] = { mw: 0, ml: 0, sw: 0, sl: 0, id: t.id, name: t.name, seed: t.seed });
        
        let matchesPlayed = 0;
        
        poolMatches.forEach(ms => {
            const s1A = parseInt(ms.s1A, 10) || 0;
            const s1B = parseInt(ms.s1B, 10) || 0;
            const s2A = parseInt(ms.s2A, 10) || 0;
            const s2B = parseInt(ms.s2B, 10) || 0;
            const s3A = parseInt(ms.s3A, 10) || 0;
            const s3B = parseInt(ms.s3B, 10) || 0;

            let aSets = 0, bSets = 0;
            if (s1A > s1B) aSets++; else if (s1B > s1A) bSets++;
            if (s2A > s2B) aSets++; else if (s2B > s2A) bSets++;
            if (s3A > s3B) aSets++; else if (s3B > s3A) bSets++;

            if (aSets > 0 || bSets > 0) {
                matchesPlayed++;
                if (teamStats[ms.teamA]) {
                    teamStats[ms.teamA].sw += aSets;
                    teamStats[ms.teamA].sl += bSets;
                    if (aSets > bSets) teamStats[ms.teamA].mw++;
                    else teamStats[ms.teamA].ml++;
                }
                if (teamStats[ms.teamB]) {
                    teamStats[ms.teamB].sw += bSets;
                    teamStats[ms.teamB].sl += aSets;
                    if (bSets > aSets) teamStats[ms.teamB].mw++;
                    else teamStats[ms.teamB].ml++;
                }
            }
        });
        
        const isFinished = poolMatches.length > 0 && matchesPlayed === poolMatches.length;
        
        let sortedStandings = Object.values(teamStats).sort((a, b) => {
            if (b.mw !== a.mw) return b.mw - a.mw;
            if (b.sw !== a.sw) return b.sw - a.sw;
            if (a.sl !== b.sl) return a.sl - b.sl; 
            return a.seed - b.seed;
        });
        
        sortedStandings.forEach((s, i) => {
            teamStats[s.id].rank = i + 1;
        });
        
        const displayTeams = poolTeams.map(t => teamStats[t.id]);
        
        html += `
        <div class="page">
            <div class="header">
                <h1>${tournamentData.name || 'Tournament Name'}</h1>
            </div>
            
            <table class="standings-table">
                <thead>
                    <tr>
                        <th colspan="2" class="pool-info-cell" style="border-right: 1px solid #94a3b8;">
                            <div class="location-name">${pool.site || 'Site TBD'}</div>
                            <div class="pool-badge" style="background-color: ${siteColor};">${pool.name}</div>
                        </th>
                        <th colspan="2">Matches</th>
                        <th colspan="2">Games</th>
                    </tr>
                    <tr>
                        <th style="border-top: 1px solid #94a3b8; width: 30px;">#</th>
                        <th style="border-top: 1px solid #94a3b8;">Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>W</th>
                        <th>L</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayTeams.map((stats) => {
                        let placementBadge = '';
                        if (isFinished) {
                            let badgeClass = 'badge-other';
                            if (stats.rank === 1) badgeClass = 'badge-1st';
                            else if (stats.rank === 2) badgeClass = 'badge-2nd';
                            else if (stats.rank === 3) badgeClass = 'badge-3rd';
                            else if (stats.rank === 4) badgeClass = 'badge-4th';
                            
                            placementBadge = `<span class="placement-badge ${badgeClass}">${getOrdinal(stats.rank)}</span>`;
                        }
                        
                        return `
                        <tr>
                            <td class="team-rank">${stats.seed}</td>
                            <td class="team-name">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>${stats.name}</span>${placementBadge}
                                </div>
                            </td>
                            <td>${toRoman(stats.mw)}</td>
                            <td>${toRoman(stats.ml)}</td>
                            <td>${toRoman(stats.sw)}</td>
                            <td>${toRoman(stats.sl)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        if (poolMatches.length > 0) {
            html += `
            <div class="matches-wrapper">
                ${poolMatches.map((ms, index) => {
                    const tA = poolTeams.find(t => t.id === ms.teamA);
                    const tB = poolTeams.find(t => t.id === ms.teamB);
                    const refTeam = poolTeams.find(t => t.id === ms.ref);
                    
                    const seedA = tA ? tA.seed : formatSeedPrint(ms.teamA);
                    const seedB = tB ? tB.seed : formatSeedPrint(ms.teamB);
                    const refSeed = refTeam ? refTeam.seed : formatSeedPrint(ms.ref);
                    
                    const s1A = parseInt(ms.s1A, 10) || 0;
                    const s1B = parseInt(ms.s1B, 10) || 0;
                    const s2A = parseInt(ms.s2A, 10) || 0;
                    const s2B = parseInt(ms.s2B, 10) || 0;
                    const s3A = parseInt(ms.s3A, 10) || 0;
                    const s3B = parseInt(ms.s3B, 10) || 0;

                    let aSets = 0; let bSets = 0;
                    if (s1A > s1B) aSets++; else if (s1B > s1A) bSets++;
                    if (s2A > s2B) aSets++; else if (s2B > s2A) bSets++;
                    if (s3A > s3B) aSets++; else if (s3B > s3A) bSets++;
                    
                    let winnerId = null;
                    if (aSets > bSets && aSets > 0) winnerId = ms.teamA;
                    if (bSets > aSets && bSets > 0) winnerId = ms.teamB;
                    
                    const displaySeedA = `<span class="seed-badge ${winnerId === ms.teamA ? 'winner-seed' : ''}">${seedA}</span>`;
                    const displaySeedB = `<span class="seed-badge ${winnerId === ms.teamB ? 'winner-seed' : ''}">${seedB}</span>`;
                    
                    const fallbackTime = addMinutes(poolStart, poolDur * index);
                    const displayTime = formatTime(ms.time || fallbackTime);
                    
                    return `
                    <div class="match-row">
                        <div class="time-badge">${displayTime}</div>
                        <div class="match-info">
                            <span class="match-num">Match ${index + 1}</span> 
                            <span>${displaySeedA} &nbsp;&nbsp;v&nbsp;&nbsp; ${displaySeedB}</span> 
                            <span class="ref-info">(${refSeed} ref)</span>
                        </div>
                        <div class="game-boxes">
                            <div class="game-box-group">G1 <div class="box">${ms.s1A ?? ''}</div><div class="box">${ms.s1B ?? ''}</div></div>
                            <div class="game-box-group">G2 <div class="box">${ms.s2A ?? ''}</div><div class="box">${ms.s2B ?? ''}</div></div>
                            <div class="game-box-group">G3 <div class="box">${ms.s3A ?? ''}</div><div class="box">${ms.s3B ?? ''}</div></div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            `;
        } else {
            html += `<div style="font-style: italic; color: #64748b; text-align: center; margin: 20px 0;">No matches have been scheduled for this pool yet.</div>`;
        }

        html += `
            <div class="footer">
                <div class="footer-primary">${poolAdvancementText}</div>
                <div class="footer-disclaimer">* Times are estimates. Matches start when courts clear.</div>
            </div>
        </div>
        `;
    });

    html += `
    </body>
    </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    
    setTimeout(() => {
        printWin.focus();
        printWin.print();
    }, 250);
}

export function printBrackets() {
    const tournamentData = getTournamentData();
    const pools = getPools();
    const allTeams = getTeams();
    const allMatches = getMatches();
    const standingsByPool = getAllPoolStandings();
    
    let config = tournamentData?.bracket_config || {};
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch(e) {}
    }
    
    const activeDivisions = parseInt(config.divisions || '2', 10);
    const hasSeeding = config.seeding === 'Yes' || tournamentData?.has_seeding_rounds === true;
    const bracketSets = parseInt(config.bracketSets || '1', 10);

    const bDur = parseInt(config.bracketDuration || 60, 10);
    const configStart = config.start || '13:00';
    const tSeed1 = addMinutes(configStart, bDur * 0);
    const tSeed2 = addMinutes(configStart, bDur * 1);
    const tQf1   = addMinutes(configStart, bDur * (hasSeeding ? 2 : 0));
    const tQf2   = addMinutes(configStart, bDur * (hasSeeding ? 3 : 1));
    const tSf    = addMinutes(configStart, bDur * (hasSeeding ? 4 : 2));
    const tFinal = addMinutes(configStart, bDur * (hasSeeding ? 5 : 3));

    const printWin = window.open('', '_blank');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Brackets - ${tournamentData.name}</title>
        <style>
            @page { size: landscape; margin: 0.25in; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
            .page { page-break-after: always; display: flex; flex-direction: column; min-height: 95vh; box-sizing: border-box; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 2px solid #64748b; padding-bottom: 8px; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 900; text-transform: uppercase; color: #000; }
            .division-badge { padding: 4px 16px; font-size: 20px; font-weight: bold; border-radius: 6px; border: 2px solid #000; color: #000; text-transform: uppercase; letter-spacing: 1px; }
            
            .bracket-grid { display: flex; flex-grow: 1; gap: 15px; padding-bottom: 5px; height: 100%; justify-content: space-between; }
            .col { display: flex; flex-direction: column; flex: 1; min-width: 210px; position: relative; justify-content: space-around; }
            .round-title { text-align: center; font-size: 13px; font-weight: bold; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; letter-spacing: 1px; }
            
            .pair { flex: 1; display: flex; flex-direction: column; justify-content: space-around; position: relative; }
            
            .match-box { background: #fff; padding: 12px 8px 6px 8px; border: 2px solid #cbd5e1; border-radius: 8px; position: relative; z-index: 2; margin: 5px 0; }
            
            .time-badge { position: absolute; top: -9px; left: 12px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            .ref-badge { position: absolute; top: -9px; right: 12px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            
            .match-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
            
            .match-id-container { display: flex; flex-direction: row; align-items: baseline; gap: 4px; flex-wrap: wrap; }
            .match-id { font-weight: bold; font-size: 12px; color: #0f172a; white-space: nowrap; }
            
            .match-loc { font-size: 10px; font-weight: bold; text-transform: uppercase; }
            
            .team-slot { margin-bottom: 6px; }
            .team-slot:last-of-type { margin-bottom: 0px; }
            
            .team-line-container { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 2px; }
            
            .write-line { border-bottom: 2px solid #0f172a; height: 16px; flex-grow: 1; font-size: 14px; font-weight: bold; color: #000; padding: 2px 4px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: flex-end; box-sizing: border-box; }
            .winner-highlight { background-color: #cbd5e1 !important; border-top-left-radius: 4px; border-top-right-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .score-box { width: 26px; height: 24px; border: 2px solid #94a3b8; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: #0f172a; }
            
            .team-hint { font-size: 10px; color: #64748b; font-weight: bold; }
            
            .connector { position: absolute; right: -7px; top: 25%; bottom: 25%; width: 7px; border: 2px solid #94a3b8; border-left: none; border-radius: 0 8px 8px 0; z-index: 1; }
            .stem { position: absolute; right: -15px; top: 50%; width: 8px; border-top: 2px solid #94a3b8; z-index: 1; }

            .footer { text-align: center; font-size: 13px; font-style: italic; color: #64748b; margin-top: 5px; font-weight: 600; }
        </style>
    </head>
    <body>
    `;

    const pA = pools[0]?.id || 'poolA';
    const pB = pools[1]?.id || 'poolB';
    const pC = pools[2]?.id || 'poolC';
    const pD = pools[3]?.id || 'poolD';

    const divisions = ['Gold', 'Silver', 'Bronze'].slice(0, activeDivisions);

    divisions.forEach(div => {
        let prefix = div === 'Gold' ? 'G' : div === 'Silver' ? 'S' : 'B';
        let r1 = div === 'Gold' ? 1 : div === 'Silver' ? 3 : 5;
        let r2 = div === 'Gold' ? 2 : div === 'Silver' ? 4 : 6;
        
        let bracketData = generateBracketData(prefix, pools, allTeams, config, hasSeeding);

        const savedScores = tournamentData?.bracket_scores || {};
        bracketData = bracketData.map(m => {
            const raw = savedScores[m.id] || {};
            return {
                ...m,
                raw: raw,
                site: raw.siteOverride || null,
                court: raw.courtOverride || null,
                refOverride: raw.refOverride || null,
                time: formatTime(raw.timeOverride || m.rawTime)
            };
        });

        const resolveTeam = (teamRef, matchSite) => {
            if (!teamRef) return { name: '', hint: '', travel: '', resolved: false };
            
            const foundTeam = allTeams.find(t => t.id === teamRef);
            if (foundTeam) return { name: foundTeam.name, hint: '', travel: '', resolved: true };

            if (typeof teamRef === 'string' && teamRef.startsWith('seed:')) {
                const parts = teamRef.split(':');
                const poolId = parts[1];
                const rankIndex = parseInt(parts[2]) - 1;
                const poolName = pools.find(p => p.id === poolId)?.name || 'Pool';
                const pSite = pools.find(p => p.id === poolId)?.site || '';
                const rankStr = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
                
                let travel = '';
                if (pSite && matchSite && pSite !== matchSite) {
                    travel = `<span style="color: ${getSiteColor(pSite)}; margin-left: 4px;">(from ${pSite})</span>`;
                }

                const poolStandings = standingsByPool[poolId] || [];
                
                const seedLocked = typeof isSeedLocked === 'function' 
                    ? isSeedLocked(poolId, rankIndex, poolStandings, allMatches) 
                    : false; 
                
                if (seedLocked && poolStandings[rankIndex]) {
                    return { name: poolStandings[rankIndex].name, hint: `${rankStr} ${poolName}`, travel, resolved: true };
                }
                return { name: '', hint: `${rankStr} ${poolName}`, travel, resolved: false };
            }
            
            if (typeof teamRef === 'string' && (teamRef.startsWith('winner:') || teamRef.startsWith('loser:'))) {
                const [type, matchId] = teamRef.split(':');
                const targetPrefix = matchId.charAt(0);
                const targetNum = matchId.slice(1);
                const targetDivName = targetPrefix === 'G' ? 'Gold' : targetPrefix === 'S' ? 'Silver' : 'Bronze';
                const isCrossDivision = targetPrefix !== prefix;
                
                const typeStr = type === 'winner' ? 'Winner' : 'Loser';
                const hint = isCrossDivision 
                    ? `${typeStr} Match ${targetNum} (${targetDivName})`
                    : `${typeStr} Match ${targetNum}`;
                    
                const targetMatch = bracketData.find(m => m.id === matchId);
                let travel = '';
                if (targetMatch && targetMatch.site && matchSite && targetMatch.site !== matchSite) {
                    travel = `<span style="color: ${getSiteColor(targetMatch.site)}; margin-left: 4px;">(from ${targetMatch.site})</span>`;
                }

                if (targetMatch && targetMatch.raw) {
                    let aWins = 0, bWins = 0;
                    if (targetMatch.raw.s1A > targetMatch.raw.s1B) aWins++; else if (targetMatch.raw.s1B > targetMatch.raw.s1A) bWins++;
                    if (targetMatch.raw.s2A > targetMatch.raw.s2B) aWins++; else if (targetMatch.raw.s2B > targetMatch.raw.s2A) bWins++;
                    if (targetMatch.raw.s3A > targetMatch.raw.s3B) aWins++; else if (targetMatch.raw.s3B > targetMatch.raw.s3A) bWins++;
                    
                    if (aWins !== bWins && (aWins > 0 || bWins > 0)) {
                        const t1 = resolveTeam(targetMatch.t1, matchSite);
                        const t2 = resolveTeam(targetMatch.t2, matchSite);
                        if (t1.resolved && t2.resolved) {
                            const advancingTeam = type === 'winner' 
                                ? (aWins > bWins ? t1 : t2) 
                                : (aWins > bWins ? t2 : t1);
                            return { name: advancingTeam.name, hint: hint, travel, resolved: true };
                        }
                    }
                }
                return { name: '', hint: hint, travel, resolved: false };
            }
            return { name: '', hint: teamRef, travel: '', resolved: false };
        };

        const formatRef = (ref) => {
             if (!ref) return 'TBD';
             const foundRef = allTeams.find(t => t.id === ref);
             if (foundRef) return foundRef.name;
             
             if (ref.startsWith('loser:')) {
                 const matchId = ref.split(':')[1];
                 const num = matchId.replace(/^[GSB]/, '');
                 const divPrefix = matchId.charAt(0);
                 const divName = divPrefix === 'G' ? 'Gold' : divPrefix === 'S' ? 'Silver' : 'Bronze';
                 return `Loser M${num} (${divName})`;
             }
             if (ref.startsWith('seed:')) {
                 const parts = ref.split(':');
                 const rank = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
                 const pName = pools.find(p => p.id === parts[1])?.name || 'Pool';
                 return `${rank} ${pName}`;
             }
             if (typeof ref === 'string' && ref.toLowerCase().includes('loser')) {
                 if (!ref.includes('(')) {
                     const numMatch = ref.match(/\d+/);
                     const num = numMatch ? numMatch[0] : '';
                     let cleanedRef = ref.replace(/of\s+/i, ''); 
                     return num ? `Loser M${num} (${div})` : `${cleanedRef} (${div})`;
                 }
             }
             return ref;
        };
        
        const generateScoreBoxes = (matchRaw, teamLetter) => {
            let boxes = '';
            for (let i = 1; i <= bracketSets; i++) {
                let score = matchRaw[`s${i}${teamLetter}`];
                
                if (score == null || score === 'null' || score === '') {
                    score = ''; 
                    
                    if (bracketSets === 3 && i === 3) {
                        const s1 = matchRaw[`s1${teamLetter}`];
                        const s2 = matchRaw[`s2${teamLetter}`];
                        if (s1 != null && s1 !== 'null' && s1 !== '' && 
                            s2 != null && s2 !== 'null' && s2 !== '') {
                            score = '-';
                        }
                    }
                }
                boxes += `<div class="score-box">${score}</div>`;
            }
            return boxes;
        };

        const renderMatchBox = (m) => {
            if (!m) return '';
            const t1 = resolveTeam(m.t1, m.site);
            const t2 = resolveTeam(m.t2, m.site);
            const refStr = formatRef(m.refOverride || m.ref);
            
            let aWins = 0, bWins = 0;
            if (m.raw) {
                if (m.raw.s1A > m.raw.s1B) aWins++; else if (m.raw.s1B > m.raw.s1A) bWins++;
                if (m.raw.s2A > m.raw.s2B) aWins++; else if (m.raw.s2B > m.raw.s2A) bWins++;
                if (m.raw.s3A > m.raw.s3B) aWins++; else if (m.raw.s3B > m.raw.s3A) bWins++;
            }
            const t1Class = (aWins > bWins && aWins > 0) ? 'write-line winner-highlight' : 'write-line';
            const t2Class = (bWins > aWins && bWins > 0) ? 'write-line winner-highlight' : 'write-line';
            
            return `
            <div class="match-box">
                <div class="time-badge">${m.time}</div>
                <div class="ref-badge">Ref: ${refStr}</div>
                
                <div class="match-header">
                    <div class="match-id-container">
                        <span class="match-id">Match ${m.id.replace(/^[GSB]/, '')}</span>
                    </div>
                    <span class="match-loc" style="color: ${getSiteColor(m.site)};">${m.site || 'Site TBD'}</span>
                </div>
                
                <div class="team-slot">
                    <div class="team-line-container">
                        <div class="${t1Class}">${t1.name}</div>
                        ${generateScoreBoxes(m.raw, 'A')}
                    </div>
                    <div class="team-hint">${t1.hint} ${t1.travel}</div>
                </div>
                
                <div class="team-slot">
                    <div class="team-line-container">
                        <div class="${t2Class}">${t2.name}</div>
                        ${generateScoreBoxes(m.raw, 'B')}
                    </div>
                    <div class="team-hint">${t2.hint} ${t2.travel}</div>
                </div>
            </div>
            `;
        };

        html += `
        <div class="page">
            <div class="header">
                <h1>${tournamentData.name || 'Tournament Name'}</h1>
                <div class="division-badge">${div} Division</div>
            </div>
            <div class="bracket-grid">
        `;

        const getRound = (col) => bracketData.filter(m => m.col === col);

        if (hasSeeding && prefix !== 'S') {
            const sMatches = getRound('Seeding Round');
            html += `<div class="col">
               <div class="round-title">Seeding Round</div>
               ${sMatches.map(m => `
                   <div class="pair" style="justify-content: center;">
                       ${renderMatchBox(m)}
                   </div>
               `).join('')}
            </div>`;
        }

        const qf = getRound('Quarterfinals');
        if (qf.length === 4) {
            html += `<div class="col">
                <div class="round-title">Quarterfinals</div>
                <div class="pair">
                    ${renderMatchBox(qf[0])}
                    ${renderMatchBox(qf[1])}
                    <div class="connector"></div><div class="stem"></div>
                </div>
                <div class="pair">
                    ${renderMatchBox(qf[2])}
                    ${renderMatchBox(qf[3])}
                    <div class="connector"></div><div class="stem"></div>
                </div>
            </div>`;
        } else if (qf.length === 2) {
            html += `<div class="col">
                <div class="round-title">Quarterfinals</div>
                <div class="pair" style="justify-content: flex-end; padding-bottom: 5px;">
                    ${renderMatchBox(qf[0])}
                    <div class="stem" style="top: 85%;"></div>
                </div>
                <div class="pair" style="justify-content: flex-end; padding-bottom: 5px;">
                    ${renderMatchBox(qf[1])}
                    <div class="stem" style="top: 85%;"></div>
                </div>
            </div>`;
        }
        // If qf.length is 0 (Pure 4-Team Bracket), it skips this block entirely!

        const sf = getRound('Semifinals');
        html += `<div class="col">
            <div class="round-title">Semifinals</div>
            <div class="pair">
                ${renderMatchBox(sf[0])}
                ${renderMatchBox(sf[1])}
                <div class="connector"></div><div class="stem"></div>
            </div>
        </div>`;

        const f = getRound('Finals');
        html += `<div class="col">
            <div class="round-title">Championship</div>
            <div class="pair" style="justify-content: center;">
                ${renderMatchBox(f[0])}
            </div>
        </div>`;

        html += `
            </div>
            <div class="footer">* Times are estimates. Matches start when courts clear.</div>
        </div>
        `;
    });

    html += `
    </body>
    </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    
    setTimeout(() => {
        printWin.focus();
        printWin.print();
    }, 250);
}