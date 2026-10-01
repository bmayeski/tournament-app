// uiPublic.js
import { getTournamentData, getPools, getMatches, getTeams } from './state.js';
import { getAllPoolStandings, checkMathematicalLock } from './uiMath.js';
import { getSiteColor, formatTime, lightenColor, ensureReadableColor, getOrdinalSuffix } from './utils.js';

export function renderPublicInfo() {
    const container = document.getElementById('dynamicInfoContainer');
    const data = getTournamentData();
    
    if (!container || !data) return;

    if (data.info_data && Array.isArray(data.info_data)) {
        let html = data.info_data.map(section => {
            let cleanContent = (section.content || '').replace(/(<p><br><\/p>\s*)+$/, '');

            const isDirector = section.title.toLowerCase().includes('director');
            const headerAlign = isDirector ? 'justify-content: center;' : '';
            const contentAlign = isDirector ? 'text-align: center;' : '';

            const subContentHtml = section.subContent && section.subContent !== '<p><br></p>'
                ? `<div class="sub-content-highlight">${section.subContent}</div>` : '';

            const alertContentHtml = section.alertContent && section.alertContent !== '<p><br></p>'
                ? `<div class="alert-content-box">${section.alertContent}</div>` : '';

            return `
            <div class="info-section-container">
                <h3 class="info-section-title" style="${headerAlign}">
                    <span style="font-size: 1rem;">${section.icon || ''}</span> ${section.title}
                </h3>
                <div class="info-section-body" style="${contentAlign}">
                    ${cleanContent}
                </div>
                ${subContentHtml}
                ${alertContentHtml}
            </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p style="color: var(--text-secondary);">No information has been posted for this tournament yet.</p>';
    }
}

export function renderPublicPools() {
    const container = document.getElementById('publicPoolsList');
    if (!container) return;

    const tourneyData = getTournamentData();
    let config = tourneyData?.bracket_config || {};
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch(e) {}
    }

    const filterDropdown = document.getElementById('publicSiteFilter');
    let selectedSite = 'All';

    if (filterDropdown) {
        let optionsHtml = '<option value="All">All Sites</option>';
        if (config.site1Name) optionsHtml += `<option value="${config.site1Name}">${config.site1Name}</option>`;
        if (config.site2Name) optionsHtml += `<option value="${config.site2Name}">${config.site2Name}</option>`;
        if (config.site3Name) optionsHtml += `<option value="${config.site3Name}">${config.site3Name}</option>`;

        if (filterDropdown.innerHTML !== optionsHtml) {
            const currentVal = filterDropdown.value;
            filterDropdown.innerHTML = optionsHtml;
            if (optionsHtml.includes(`value="${currentVal}"`)) filterDropdown.value = currentVal;
            else filterDropdown.value = 'All';
        }

        if (!filterDropdown.dataset.listenerAttached) {
            filterDropdown.addEventListener('change', () => renderPublicPools());
            filterDropdown.dataset.listenerAttached = 'true';
        }
        selectedSite = filterDropdown.value;
    }

    const standingsByPool = getAllPoolStandings();
    const allPools = getPools();
    const allMatches = getMatches();
    const allTeams = getTeams();
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    if (allPools.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No pools have been created yet.</p>';
        return;
    }

    const pools = selectedSite === 'All' ? allPools : allPools.filter(p => p.site === selectedSite);

    if (pools.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">No pools are currently scheduled at <strong>${selectedSite}</strong>.</p>`;
        return;
    }

    let html = '<div class="public-pools-grid">';
    
    pools.forEach(pool => {
        const standings = standingsByPool[pool.id] || [];
        const poolMatches = allMatches.filter(m => m.pool_id === pool.id).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        
        // Use .trim() to ensure site names match perfectly even if there are accidental spaces!
        const pSite = (pool.site || '').trim();
        let headerColor = 'var(--accent-orange)';
        if (pSite && pSite === (config.site1Name || '').trim()) headerColor = config.site1Color || headerColor;
        else if (pSite && pSite === (config.site2Name || '').trim()) headerColor = config.site2Color || headerColor;
        else if (pSite && pSite === (config.site3Name || '').trim()) headerColor = config.site3Color || headerColor;
        
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
                        <!-- Seed column completely removed for better spacing -->
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
                            <!-- Seed header removed -->
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
                            
                            // Only generate the placement badge if they are locked in
                            let seedDisplay = '';
                            if (isPoolComplete || isLocked) {
                                const placeClass = index < 3 ? `seed-${index + 1}` : 'seed-unlocked';
                                seedDisplay = `<span class="seed-badge ${placeClass}" style="margin-right: 6px;">${getOrdinalSuffix(index + 1)}</span>`;
                            }

                            const logoHtml = team.logo_id ? `<img src="${team.logo_id}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 4px; flex-shrink: 0;">` : `<div style="width: 20px; height: 20px; border-radius: 4px; background: ${team.color || '#3b82f6'}; flex-shrink: 0;"></div>`;
                            const nameColor = team.color ? ensureReadableColor(team.color) : 'var(--text-primary)';
                            const setSign = team.setDiff > 0 ? '+' : '';
                            const ptSign = team.pointDiff > 0 ? '+' : '';

                            const rowHtml = `
                            <tr class="standings-row">
                                <td style="text-align: left; padding-left: 8px; font-weight: bold; overflow: hidden;">
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                        <!-- Seed dynamically injected directly next to the team logo! -->
                                        ${seedDisplay}${logoHtml}
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

                <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px;">
                    <div class="match-breakdown-header">
                        <div style="display: flex; align-items: baseline; gap: 10px; min-width: 0;">
                            <span style="white-space: nowrap;">Match Breakdown</span>
                            <span style="font-size: 0.6rem; font-style: italic; color: var(--accent-orange); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">*All times are estimates</span>
                        </div>
                        <div style="display: flex; gap: 0; text-align: center; flex-shrink: 0; width: 165px;">
                            <div style="width: 55px;">Game 1</div>
                            <div style="width: 55px;">Game 2</div>
                            <div style="width: 55px;">Game 3</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${poolMatches.map((m, index) => {
                            const t1 = teamMap.get(m.teamA);
                            const t2 = teamMap.get(m.teamB);
                            const ref = teamMap.get(m.ref);
                            
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
                                        <span class="ref-badge">Ref: <span style="color: #cbd5e1; font-weight: 500;">${ref ? ref.name : 'TBD'}</span></span>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--accent-orange); font-size: 0.75rem; font-weight: bold; white-space: nowrap;">🕒 ${formatTime(m.time)}</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="color: ${tAColor}; font-weight: ${tAWeight}; font-size: 0.85rem; flex-grow: 1; padding-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t1 ? t1.name : 'TBD'}</div>
                                        <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                                            ${renderScoreBox(s1a, s1a !== '-' && parseFloat(s1a) > parseFloat(s1b))}
                                            ${renderScoreBox(s2a, s2a !== '-' && parseFloat(s2a) > parseFloat(s2b))}${renderScoreBox(s3a, s3a !== '-' && parseFloat(s3a) > parseFloat(s3b))}
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="color: ${tBColor}; font-weight: ${tBWeight}; font-size: 0.85rem; flex-grow: 1; padding-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t2 ? t2.name : 'TBD'}</div>
                                        <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                                            ${renderScoreBox(s1b, s1b !== '-' && parseFloat(s1b) > parseFloat(s1a))}
                                            ${renderScoreBox(s2b, s2b !== '-' && parseFloat(s2b) > parseFloat(s2a))}${renderScoreBox(s3b, s3b !== '-' && parseFloat(s3b) > parseFloat(s3a))}
                                        </div>
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