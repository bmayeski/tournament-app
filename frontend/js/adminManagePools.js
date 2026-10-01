// adminManagePools.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, getTeams, getPools, getMatches, setMatches, getTournamentData } from './state.js';
import { getAllPoolStandings, checkMathematicalLock } from './uiMath.js';
import { formatTime, getSiteColor, ensureReadableColor, getOrdinalSuffix, addMinutes } from './utils.js';
import { renderPublicPools } from './uiPublic.js';
import { printPoolSheets } from './adminPrint.js';

export function initManagePools() {
    const refreshBtn = document.getElementById('refreshScoresBtn');
    const closeBtn = document.getElementById('closeScoreModalBtn');
    const saveBtn = document.getElementById('saveScoresBtn');

    if (refreshBtn) refreshBtn.addEventListener('click', loadPoolScores);
    if (closeBtn) closeBtn.addEventListener('click', closeScoreModal);
    if (saveBtn) saveBtn.addEventListener('click', handleSaveScores);

    document.addEventListener('click', (e) => {
        // 1. Open Score Modal
        if (e.target.classList.contains('edit-score-admin-btn')) {
            openScoreModal(e.target.dataset.matchId);
        }
        
        // 2. Open Pool Details Modal
        if (e.target.closest('.edit-pool-details-btn')) {
            const btn = e.target.closest('.edit-pool-details-btn');
            document.getElementById('poolDetailsMatchId').value = btn.dataset.matchId;
            document.getElementById('poolDetailsModalMatchup').innerText = `${btn.dataset.t1} vs ${btn.dataset.t2}`;
            
            document.getElementById('poolDetailsTime').value = btn.dataset.time || '';
            document.getElementById('poolDetailsCourt').value = btn.dataset.court || '';
            
            const allTeams = getTeams();
            const sortedTeams = [...allTeams].sort((a, b) => a.name.localeCompare(b.name));
            
            let refOpts = '<option value="">-- Select Referee --</option>';
            sortedTeams.forEach(t => {
                const isSelected = btn.dataset.ref === t.id ? 'selected' : '';
                refOpts += `<option value="${t.id}" ${isSelected}>${t.name}</option>`;
            });
            document.getElementById('poolDetailsRef').innerHTML = refOpts;
            
            const modal = document.getElementById('editPoolDetailsModal');
            if (modal) modal.style.display = 'flex';
        }

        // 3. Close Pool Details Modal
        if (e.target.closest('#closePoolDetailsModalBtn')) {
            const modal = document.getElementById('editPoolDetailsModal');
            if (modal) modal.style.display = 'none';
        }

        // 4. Save Pool Details
        if (e.target.closest('#savePoolDetailsBtn')) {
            handleSavePoolDetails(e.target.closest('#savePoolDetailsBtn'));
        }

        // 5. Print Pool Sheets
        if (e.target.id === 'printPoolSheetsBtn') {
            printPoolSheets();
        }
    });
}

export async function loadPoolScores() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('time', { ascending: true }); 

    if (error) {
        console.error("Error loading matches:", error);
        return;
    }

    if (matches) {
        setMatches(matches);
        renderAdminPools();
        
        if (typeof renderPublicPools === 'function') {
            renderPublicPools();
        }
    }
}

export function renderAdminPools() {
    const container = document.getElementById('adminScoresGrid');
    if (!container) return;

    const standingsByPool = getAllPoolStandings();
    const pools = getPools();
    const allMatches = getMatches();
    const allTeams = getTeams();
    
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    if (pools.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No pools have been created yet.</p>';
        return;
    }

    let html = '<div class="public-pools-grid" style="width: 100%;">';
    
    pools.forEach(pool => {
        const standings = standingsByPool[pool.id] || [];
        const poolMatches = allMatches.filter(m => m.pool_id === pool.id).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const headerColor = getSiteColor(pool.site);
        
        const isPoolComplete = poolMatches.length > 0 && poolMatches.every(m => m.status === 'completed' || m.status === 'complete');
        const maxMatches = standings.length > 0 ? standings.length - 1 : 0; 
        
        const nextMatchIndex = poolMatches.findIndex(m => m.status !== 'completed' && m.status !== 'complete');

        html += `
        <div class="pool-card">
            <div class="pool-card-header" style="background: ${headerColor};">
                <span style="font-size: 1rem; display: flex; align-items: center; gap: 8px;">🏐 ${pool.name}</span>
                <span style="font-size: 0.8rem; font-weight: 500; opacity: 0.9;">${pool.site || ''}</span>
            </div>
            
            <div class="pool-card-content">
                <table class="pool-standings-table">
                    <colgroup>
                        <col style="width: 38px;">
                        <col style="width: auto;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 32px;"> 
                        <col style="width: 32px;"> 
                    </colgroup>
                    <thead>
                        <tr class="header-row1">
                            <th rowspan="2">Seed</th>
                            <th rowspan="2" style="text-align: left; padding-left: 8px;">Team</th>
                            <th colspan="2" style="border-left: 1px solid var(--border-color); color: #fff; font-size: 0.7rem;">Matches</th>
                            <th colspan="2" style="border-left: 1px solid var(--border-color); color: #fff; font-size: 0.7rem;">Sets</th>
                            <th rowspan="2" style="border-left: 1px solid var(--border-color); line-height: 1.2;">Set<br>+/-</th>
                            <th rowspan="2" style="border-left: 1px solid var(--border-color); line-height: 1.2;">Pt<br>+/-</th>
                        </tr>
                        <tr class="header-row2">
                            <th style="border-left: 1px solid var(--border-color);">W</th>
                            <th>L</th>
                            <th style="border-left: 1px solid var(--border-color);">W</th>
                            <th>L</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standings.map((team, index) => {
                            const isLocked = checkMathematicalLock(team, index, standings, maxMatches);
                            
                            let seedDisplay = '';
                            if (isPoolComplete || isLocked) {
                                const placeClass = index < 3 ? `seed-${index + 1}` : 'seed-unlocked';
                                seedDisplay = `<span class="seed-badge ${placeClass}">${getOrdinalSuffix(index + 1)}</span>`;
                            } else {
                                seedDisplay = `<span class="seed-badge seed-unlocked">${team.seed === 99 ? '-' : team.seed}</span>`;
                            }

                            const logoHtml = team.logo_id ? `<img src="${team.logo_id}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 4px; flex-shrink: 0;">` : `<div style="width: 20px; height: 20px; border-radius: 4px; background: ${team.color || '#3b82f6'}; flex-shrink: 0;"></div>`;
                            const nameColor = team.color ? ensureReadableColor(team.color) : 'var(--text-primary)';
                            
                            const setSign = team.setDiff > 0 ? '+' : '';
                            const ptSign = team.pointDiff > 0 ? '+' : '';

                            const rowHtml = `
                            <tr class="standings-row">
                                <td>${seedDisplay}</td>
                                <td style="text-align: left; padding-left: 8px; font-weight: bold; overflow: hidden;">
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                        ${logoHtml}
                                        <span style="color: ${nameColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: inline-block;">
                                            ${team.name}
                                        </span>
                                    </div>
                                </td>
                                <td style="font-weight: bold; border-left: 1px solid var(--border-color); color: white;">${team.matchesWon}</td>
                                <td style="font-weight: bold; color: white;">${team.matchesLost}</td>
                                <td style="border-left: 1px solid var(--border-color); color: white;">${team.setsWon}</td>
                                <td style="color: white;">${team.setsLost}</td>
                                <td style="border-left: 1px solid var(--border-color); color: ${team.setDiff >= 0 ? '#22c55e' : '#ef4444'};">${setSign}${team.setDiff}</td>
                                <td style="border-left: 1px solid var(--border-color); color: ${team.pointDiff >= 0 ? '#22c55e' : '#ef4444'}; font-weight: bold;">${ptSign}${team.pointDiff}</td>
                            </tr>
                            `;

                            return { seed: team.seed, name: team.name, html: rowHtml };
                        }).sort((a, b) => a.seed !== b.seed ? a.seed - b.seed : a.name.localeCompare(b.name))
                          .map(item => item.html).join('')}
                    </tbody>
                </table>

                <div style="margin-top: auto;">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${poolMatches.map((m, index) => {
                            const t1 = teamMap.get(m.teamA);
                            const t2 = teamMap.get(m.teamB);
                            const ref = teamMap.get(m.ref);
                            
                            const t1Name = t1 ? t1.name : 'TBD';
                            const t2Name = t2 ? t2.name : 'TBD';
                            const refName = ref ? ref.name : 'TBD';
                            
                            const isComplete = (m.status === 'completed' || m.status === 'complete');
                            const isNextMatch = (index === nextMatchIndex);
                            
                            const s1a = m.s1A !== null && m.s1A !== undefined ? m.s1A : '-';
                            const s1b = m.s1B !== null && m.s1B !== undefined ? m.s1B : '-';
                            const s2a = m.s2A !== null && m.s2A !== undefined ? m.s2A : '-';
                            const s2b = m.s2B !== null && m.s2B !== undefined ? m.s2B : '-';
                            const s3a = m.s3A !== null && m.s3A !== undefined ? m.s3A : '-';
                            const s3b = m.s3B !== null && m.s3B !== undefined ? m.s3B : '-';

                            const hasScores = (s1a !== '-' || s1b !== '-' || s2a !== '-' || s2b !== '-' || s3a !== '-' || s3b !== '-');
                            let matchState = 'pending';
                            let matchWinnerId = null;

                            if (isComplete) {
                                matchState = 'completed';
                                let t1Sets = 0, t2Sets = 0;
                                if (s1a !== '-' && s1b !== '-') { if (Number(s1a) > Number(s1b)) t1Sets++; else if (Number(s1b) > Number(s1a)) t2Sets++; }
                                if (s2a !== '-' && s2b !== '-') { if (Number(s2a) > Number(s2b)) t1Sets++; else if (Number(s2b) > Number(s2a)) t2Sets++; }
                                if (s3a !== '-' && s3b !== '-') { if (Number(s3a) > Number(s3b)) t1Sets++; else if (Number(s3b) > Number(s3a)) t2Sets++; }
                                if (t1Sets > t2Sets) matchWinnerId = m.teamA;
                                else if (t2Sets > t1Sets) matchWinnerId = m.teamB;
                            } else if (m.status === 'active' || hasScores || isNextMatch) {
                                matchState = 'active';
                            }

                            const statusIcon = matchState === 'completed' ? `<div class="match-status-icon completed" title="Completed">✔</div>`
                                             : matchState === 'active' ? `<div class="match-status-icon active" title="Active">▶</div>`
                                             : `<div class="match-status-icon upcoming" title="Upcoming">-</div>`;

                            const renderScoreBox = (score, isWinner) => {
                                if (score === '-' || score === null) return `<div class="score-box empty">-</div>`;
                                return `<div class="score-box ${isWinner ? 'winner' : 'loser'}">${score}</div>`;
                            };

                            const tAColor = (matchState === 'completed' && matchWinnerId !== m.teamA) ? '#64748b' : (matchWinnerId === m.teamA ? 'var(--accent-orange)' : 'white');
                            const tAWeight = matchWinnerId === m.teamA ? 'bold' : 'normal';
                            const tBColor = (matchState === 'completed' && matchWinnerId !== m.teamB) ? '#64748b' : (matchWinnerId === m.teamB ? 'var(--accent-orange)' : 'white');
                            const tBWeight = matchWinnerId === m.teamB ? 'bold' : 'normal';

                            return `
                            <div class="match-card-container ${matchState}">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                                        ${statusIcon}
                                        <span class="ref-badge">Ref: <span style="color: #cbd5e1; font-weight: 500;">${refName}</span></span>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--accent-orange); font-size: 0.75rem; font-weight: bold; white-space: nowrap;">🕒 ${formatTime(m.time)}</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div style="color: ${tAColor}; font-weight: ${tAWeight}; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis;">${t1Name}</div>
                                            <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                                                ${renderScoreBox(s1a, s1a !== '-' && parseFloat(s1a) > parseFloat(s1b))}
                                                ${renderScoreBox(s2a, s2a !== '-' && parseFloat(s2a) > parseFloat(s2b))}${renderScoreBox(s3a, s3a !== '-' && parseFloat(s3a) > parseFloat(s3b))}
                                            </div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div style="color: ${tBColor}; font-weight: ${tBWeight}; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis;">${t2Name}</div>
                                            <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                                                ${renderScoreBox(s1b, s1b !== '-' && parseFloat(s1b) > parseFloat(s1a))}
                                                ${renderScoreBox(s2b, s2b !== '-' && parseFloat(s2b) > parseFloat(s2a))}${renderScoreBox(s3b, s3b !== '-' && parseFloat(s3b) > parseFloat(s3a))}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
                                        <button class="btn edit-pool-details-btn" 
                                            data-match-id="${m.id}" data-t1="${t1Name}" data-t2="${t2Name}" 
                                            data-time="${m.time ? m.time : ''}" data-court="${m.court ? m.court : ''}" 
                                            data-ref="${m.ref ? m.ref : ''}" 
                                            style="font-size: 0.9rem; padding: 4px; background: var(--surface-light); border: 1px solid var(--border-color); color: white; cursor: pointer; border-radius: 4px;" title="Edit Match Details">⚙️</button>
                                        <button class="btn edit-score-admin-btn" data-match-id="${m.id}" style="font-size: 0.65rem; padding: 4px 8px; background: var(--surface-light); border: 1px solid var(--border-color); color: white; cursor: pointer; border-radius: 4px;">Edit Scores</button>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function openScoreModal(matchId) {
    const matches = getMatches();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const allTeams = getTeams();
    const t1 = allTeams.find(t => t.id === match.teamA);
    const t2 = allTeams.find(t => t.id === match.teamB);

    document.getElementById('scoreModalMatchId').value = match.id;
    document.getElementById('scoreModalMatchup').textContent = `${t1 ? t1.name : 'Team A'} vs ${t2 ? t2.name : 'Team B'}`;
    
    document.getElementById('s1A').value = match.s1A ?? '';
    document.getElementById('s1B').value = match.s1B ?? '';
    document.getElementById('s2A').value = match.s2A ?? '';
    document.getElementById('s2B').value = match.s2B ?? '';
    document.getElementById('s3A').value = match.s3A ?? '';
    document.getElementById('s3B').value = match.s3B ?? '';

    document.getElementById('matchCompleteCheckbox').checked = (match.status === 'completed' || match.status === 'complete');

    document.getElementById('editScoreModal').style.display = 'flex';
}

function closeScoreModal() {
    document.getElementById('editScoreModal').style.display = 'none';
}

async function handleSaveScores() {
    const matchId = document.getElementById('scoreModalMatchId').value;
    if (!matchId) return;

    const s1A = document.getElementById('s1A').value;
    const s1B = document.getElementById('s1B').value;
    const s2A = document.getElementById('s2A').value;
    const s2B = document.getElementById('s2B').value;
    const s3A = document.getElementById('s3A').value;
    const s3B = document.getElementById('s3B').value;
    const isComplete = document.getElementById('matchCompleteCheckbox').checked;

    const updateData = {
        s1A: s1A !== '' ? parseInt(s1A) : null,
        s1B: s1B !== '' ? parseInt(s1B) : null,
        s2A: s2A !== '' ? parseInt(s2A) : null,
        s2B: s2B !== '' ? parseInt(s2B) : null,
        s3A: s3A !== '' ? parseInt(s3A) : null,
        s3B: s3B !== '' ? parseInt(s3B) : null,
        status: isComplete ? 'completed' : 'scheduled'
    };

    const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

    if (error) {
        alert("Error saving scores: " + error.message);
    } else {
        closeScoreModal();
        loadPoolScores(); 
    }
}

async function handleSavePoolDetails(btn) {
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    
    const matchId = document.getElementById('poolDetailsMatchId').value;
    const time = document.getElementById('poolDetailsTime').value;
    const court = document.getElementById('poolDetailsCourt').value;
    const ref = document.getElementById('poolDetailsRef').value;
    
    const { error } = await supabase
        .from('matches')
        .update({ time, court, ref })
        .eq('id', matchId);
        
    if (error) {
        alert("Error saving details: " + error.message);
    } else {
        const allMatches = getMatches();
        const m = allMatches.find(m => m.id === matchId);
        if (m) {
            m.time = time;
            m.court = court;
            m.ref = ref;
        }
        document.getElementById('editPoolDetailsModal').style.display = 'none';
        renderAdminPools();
    }
    btn.innerText = originalText;
}
