// uiBracket.js
import { getPools, getTeams, getMatches, getTournamentData } from './state.js';
import { getAllPoolStandings, isSeedLocked } from './uiMath.js';
import { formatTime, addMinutes} from './utils.js';
import { generateBracketData } from './bracketGenerator.js';

export function renderBracketView() {
    renderCanvas('bracketCanvas', 'bracketDivisionSelect', false);
    renderCanvas('adminBracketCanvas', 'adminBracketDivisionSelect', true);
}

function renderCanvas(canvasId, selectId, isAdmin) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.style.padding = '0';
    canvas.style.overflow = 'hidden';
    canvas.style.border = 'none';

    const tourneyData = getTournamentData();
    const config = tourneyData?.bracket_config || { start: '13:00', bracketDuration: 60, poolDuration: 60, divisions: '2' };
    const savedScores = tourneyData?.bracket_scores || {}; 
    const hasSeeding = config.seeding === 'Yes' || tourneyData?.has_seeding_rounds === true;
    const activeDivisions = config.divisions || '2';

    // Add this new color matcher right here!
    const getSiteColor = (siteName) => {
        if (!siteName) return '#475569';
        const s = siteName.trim();
        if (config.site1Name && s === config.site1Name.trim()) return config.site1Color || '#3b82f6';
        if (config.site2Name && s === config.site2Name.trim()) return config.site2Color || '#ef4444';
        if (config.site3Name && s === config.site3Name.trim()) return config.site3Color || '#22c55e';
        return '#3b82f6'; // Fallback
    };

    const divisionSelect = document.getElementById(selectId);
    let selectedDivision = 'gold'; 
    
    if (divisionSelect) {
        const currentVal = divisionSelect.value || 'gold';
        let html = `<option value="gold" ${currentVal === 'gold' ? 'selected' : ''}>Gold Division</option>`;
        html += `<option value="silver" ${currentVal === 'silver' ? 'selected' : ''}>Silver Division</option>`;
        
        if (activeDivisions === '3') {
            html += `<option value="bronze" ${currentVal === 'bronze' ? 'selected' : ''}>Bronze Division</option>`;
        }
        
        divisionSelect.innerHTML = html;
        selectedDivision = divisionSelect.value;

        if (selectedDivision === 'bronze' && activeDivisions !== '3') {
            selectedDivision = 'gold';
            divisionSelect.value = 'gold';
        }

        if (!divisionSelect.dataset.listenerAttached) {
            divisionSelect.addEventListener('change', () => renderBracketView());
            divisionSelect.dataset.listenerAttached = 'true';
        }
    }

    const pools = getPools();
    const standingsByPool = getAllPoolStandings();
    const allMatches = getMatches();
    const allTeams = getTeams(); // <-- Move it up here!

    const pA = pools[0]?.id || 'poolA';
    const pB = pools[1]?.id || 'poolB';
    const pC = pools[2]?.id || 'poolC';
    const pD = pools[3]?.id || 'poolD';

    let r1 = 1, r2 = 2; 
    let prefix = 'G';   
    if (selectedDivision === 'silver') {
        r1 = 3; r2 = 4; prefix = 'S';   
    } else if (selectedDivision === 'bronze') {
        r1 = 5; r2 = 6; prefix = 'B';
    }

    const bracketSets = parseInt(config.bracketSets || '1', 10);

    // Call the engine to generate the exact shape needed
    let bracketData = generateBracketData(prefix, pools, allTeams, config, hasSeeding);

    // Map the generated matches against saved overrides/scores
    bracketData = bracketData.map(m => {
        const raw = savedScores[m.id] || {};
        return {
            ...m,
            raw: raw,
            site: raw.siteOverride || null,
            court: raw.courtOverride || null,
            refOverride: raw.refOverride || null,
            time24: raw.timeOverride || m.rawTime
        };
    });

    if (isAdmin) {
        window.activeBracketState = bracketData;
    }
    
    const resolveTeam = (teamRef, matchSite) => {
        if (!teamRef) return { name: '', hint: '', travel: '', resolved: false };
        
        // Handle explicit dropouts/byes cleanly
        if (teamRef === 'BYE') return { name: 'BYE', hint: 'Automatic Advancement', travel: '', resolved: true, color: '#334155' };
        
        const foundTeam = allTeams.find(t => t.id === teamRef);
        if (foundTeam) return { name: foundTeam.name, hint: '', travel: '', resolved: true, logo: foundTeam.logo_id, color: foundTeam.color };

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
                const resolvedTeam = poolStandings[rankIndex];
                return { name: resolvedTeam.name, hint: `${rankStr} ${poolName}`, travel, resolved: true, logo: resolvedTeam.logo_id, color: resolvedTeam.color };
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
                        return { name: advancingTeam.name, hint: hint, travel, resolved: true, logo: advancingTeam.logo, color: advancingTeam.color };
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
            // Add margin for the digital renderer spacing
            boxes += `<div class="bracket-score" style="width: 22px; text-align: center;">${score || '-'}</div>`;
        }
        return boxes;
    };

    const visibleColumns = [...new Set(bracketData.map(m => m.col))];

    const createMatchCard = (match, index, colIndex, isStraight) => {
        const team1 = resolveTeam(match.t1, match.site);
        const team2 = resolveTeam(match.t2, match.site);
        const refTeam = { name: formatRef(match.refOverride || match.ref) };

        let aWins = 0, bWins = 0;
        if (match.raw) {
            if (match.raw.s1A > match.raw.s1B) aWins++; else if (match.raw.s1B > match.raw.s1A) bWins++;
            if (match.raw.s2A > match.raw.s2B) aWins++; else if (match.raw.s2B > match.raw.s2A) bWins++;
            if (match.raw.s3A > match.raw.s3B) aWins++; else if (match.raw.s3B > match.raw.s3A) bWins++;
        }

        const isT1Winner = aWins > bWins && aWins > 0;
        const isT2Winner = bWins > aWins && bWins > 0;

        const t1Text = (isT1Winner || (!isT1Winner && !isT2Winner && team1.resolved)) ? 'color: white;' : 'color: #94a3b8; font-weight: normal;';
        const t2Text = (isT2Winner || (!isT1Winner && !isT2Winner && team2.resolved)) ? 'color: white;' : 'color: #94a3b8; font-weight: normal;';
        
        // Use your existing getSiteColor logic to define the border and accent colors
        const effectiveSite = match.siteOverride || match.site || '';
        const cardBorderColor = effectiveSite ? getSiteColor(effectiveSite) : '#334155';
        const textAccent = effectiveSite ? getSiteColor(effectiveSite) : 'var(--accent-orange)';
        
        const t1RowStyle = isT1Winner ? `background: color-mix(in srgb, ${textAccent} 15%, transparent); border: 1px solid ${textAccent};` : '';
        const t2RowStyle = isT2Winner ? `background: color-mix(in srgb, ${textAccent} 15%, transparent); border: 1px solid ${textAccent};` : '';
        
        const renderTeamBadge = (team) => {
            if (!team.resolved) return '';
            if (team.logo) return `<img src="${team.logo}" style="width: 14px; height: 14px; object-fit: contain; border-radius: 50%;">`;
            return `<div style="width: 14px; height: 14px; border-radius: 50%; background: ${team.color || '#475569'};"></div>`;
        };

        let adminEditButton = '';
        if (isAdmin) {
            adminEditButton = `
            <div style="display: flex; flex-direction: column; width: 32px; flex-shrink: 0; border-left: 1px solid #334155; background: rgba(0,0,0,0.2);">
                <button class="btn edit-bracket-placements-btn" data-match-id="${match.id}" data-t1="${match.t1}" data-t2="${match.t2}" data-ref="${match.ref}" 
                style="flex: 1; padding: 0; font-size: 1.1rem; border: none; border-bottom: 1px solid #334155; cursor: pointer; border-radius: 0; background: transparent; display: flex; align-items: center; justify-content: center;" title="Edit Matchup Placements">
                🔀
                </button>
                <button class="btn edit-bracket-details-btn" data-match-id="${match.id}" data-t1="${team1.name || team1.hint}" data-t2="${team2.name || team2.hint}" data-time="${match.time24}" data-site="${match.site || ''}" data-court="${match.court || ''}" 
                style="flex: 1; padding: 0; font-size: 1.1rem; border: none; border-bottom: 1px solid #334155; cursor: pointer; border-radius: 0; background: transparent; display: flex; align-items: center; justify-content: center;" title="Edit Match Details">
                ⚙️
                </button>
                <button class="btn edit-bracket-score-btn" data-match-id="${match.id}" data-t1="${team1.name || team1.hint}" data-t2="${team2.name || team2.hint}" 
                style="flex: 1; padding: 0; font-size: 1.1rem; border: none; cursor: pointer; border-radius: 0; background: transparent; display: flex; align-items: center; justify-content: center;" title="Input Scores">
                🔢
                </button>
            </div>
            `;
        }

        let locationBadge = '';
        if (effectiveSite || match.court) {
            let courtText = '';
            if (match.court) {
                courtText = `(Court ${match.court})`;
            }
            locationBadge = `<div style="background: color-mix(in srgb, ${cardBorderColor} 15%, transparent); color: ${cardBorderColor}; font-size: 0.65rem; text-align: center; padding: 4px; border-top: 1px solid #334155; font-weight: bold; letter-spacing: 0.5px; margin-top: auto;">📍 ${effectiveSite || ''} ${courtText}</div>`;
        }

        let feederLine = '';
        if (colIndex < visibleColumns.length - 1) { 
            const startColor = effectiveSite ? getSiteColor(effectiveSite) : '#475569';
            let endColor = '#475569';
            
            const nextMatch = bracketData.find(n => n.t1 === `winner:${match.id}` || n.t2 === `winner:${match.id}`);
            if (nextMatch && nextMatch.site) {
                endColor = getSiteColor(nextMatch.site);
            }

            const lineWidth = '3';

            if (isStraight) {
                feederLine = `
                <div style="position: absolute; left: 100%; top: 50%; width: 80px; height: 100%; transform: translateY(-50%); z-index: 0; pointer-events: none;">
                    <svg width="100%" height="100%" style="overflow: visible;">
                        <defs>
                            <linearGradient id="grad_${canvasId}_${match.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="${startColor}" />
                                <stop offset="100%" stop-color="${endColor}" />
                            </linearGradient>
                        </defs>
                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="url(#grad_${canvasId}_${match.id})" stroke-width="${lineWidth}" vector-effect="non-scaling-stroke" />
                    </svg>
                </div>
                `;
            } else {
                const isTop = index % 2 === 0;
                const topCss = isTop ? 'top: 50%;' : 'bottom: 50%;';
                const d = isTop ? 'M 0,0 C 50,0 50,100 100,100' : 'M 0,100 C 50,100 50,0 100,0';

                feederLine = `
                <div style="position: absolute; left: 100%; ${topCss} width: 80px; height: 50%; z-index: 0; pointer-events: none;">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow: visible; position: absolute; top: 0; left: 0;">
                        <defs>
                            <linearGradient id="grad_${canvasId}_${match.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="${startColor}" />
                                <stop offset="100%" stop-color="${endColor}" />
                            </linearGradient>
                        </defs>
                        <path d="${d}" fill="none" stroke="url(#grad_${canvasId}_${match.id})" stroke-width="${lineWidth}" vector-effect="non-scaling-stroke" />
                    </svg>
                </div>
                `;
            }
        }

        return `
        <div class="match-slot" style="display: flex; flex-direction: column; justify-content: center; position: relative; flex: 1; width: 100%; min-height: 90px; padding: 6px 0; box-sizing: border-box;">
            <!-- Added the dynamic border-left to the bracket-card right here! -->
            <div class="bracket-card" style="border-left: 4px solid ${cardBorderColor}; overflow: hidden;">
                <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
                    <div class="bracket-header">
                        <span class="bracket-time" style="color: ${textAccent};">🕒 ${formatTime(match.time24)}</span>
                        <span class="bracket-id">Match ${match.id.replace(prefix, '')}</span>
                    </div>
                    <div class="bracket-teams-container">
                        <div class="bracket-team-row" style="${t1RowStyle}">
                            <div class="bracket-team-info" style="${t1Text}">
                                ${renderTeamBadge(team1)} ${team1.name || team1.hint}
                            </div>
                            <div style="display: flex; gap: 4px;">
                                ${generateScoreBoxes(match.raw, 'A')}
                            </div>
                        </div>
                        <div class="bracket-team-row" style="${t2RowStyle}">
                            <div class="bracket-team-info" style="${t2Text}">
                                ${renderTeamBadge(team2)} ${team2.name || team2.hint}
                            </div>
                            <div style="display: flex; gap: 4px;">
                                ${generateScoreBoxes(match.raw, 'B')}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-size: 0.65rem; color: #64748b; background: rgba(0,0,0,0.15);">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <div>Ref: <span class="bracket-ref-team" style="color: ${textAccent};">${refTeam.name}</span></div>
                        </div>
                    </div>
                    ${locationBadge}
                </div>
                ${adminEditButton}
            </div>
            ${feederLine}
        </div>
        `;
    };

    let columnsHtml = '';
    
    visibleColumns.forEach((colName, colIndex) => {
        const colMatches = bracketData.filter(m => m.col === colName);
        if (colMatches.length > 0) {
            
            const nextColName = visibleColumns[colIndex + 1];
            const nextColMatches = nextColName ? bracketData.filter(m => m.col === nextColName) : [];
            const isStraight = nextColMatches.length === colMatches.length;

            let pairsHtml = '';
            if (isStraight) {
                colMatches.forEach((m) => {
                    pairsHtml += `
                    <div style="display: flex; flex-direction: column; justify-content: center; position: relative; flex-grow: 1;">
                        ${createMatchCard(m, 0, colIndex, true)}
                    </div>
                    `;
                });
            } else {
                for (let i = 0; i < colMatches.length; i += 2) {
                    const m1 = colMatches[i];
                    const m2 = colMatches[i+1];
                    
                    if (m2) {
                        pairsHtml += `
                        <div style="display: flex; flex-direction: column; justify-content: center; position: relative; flex-grow: 1;">
                            ${createMatchCard(m1, 0, colIndex, false)}
                            ${createMatchCard(m2, 1, colIndex, false)}
                        </div>
                        `;
                    } else {
                        pairsHtml += `
                        <div style="display: flex; flex-direction: column; justify-content: center; position: relative; flex-grow: 1;">
                            ${createMatchCard(m1, 0, colIndex, false)}
                        </div>
                        `;
                    }
                }
            }

            columnsHtml += `
            <div class="bracket-column">
                <div class="bracket-col-title">${colName}</div>
                <div class="bracket-matches">
                    ${pairsHtml}
                </div>
            </div>`;
        }
    });

    canvas.innerHTML = `
        <div id="${canvasId}-viewport" class="bracket-viewport-class">
            <div id="${canvasId}-surface" class="bracket-surface-class">
                <div class="bracket-tree">
                    ${columnsHtml}
                </div>
            </div>
        </div>
    `;

    initPanAndZoom(canvasId);
}

function initPanAndZoom(canvasId) {
    const viewport = document.getElementById(`${canvasId}-viewport`);
    const surface = document.getElementById(`${canvasId}-surface`);
    if (!viewport || !surface) return;

    let scale = 1, translateX = 0, translateY = 0;
    let isDragging = false, startX, startY;
    let initialPinchDistance = null, initialScale = scale;

    const applyTransform = () => {
        surface.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        const newScale = Math.min(Math.max(0.4, scale + ((e.deltaY < 0 ? 1 : -1) * 0.1)), 2.0); 
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        translateX = mouseX - (mouseX - translateX) * (newScale / scale);
        translateY = mouseY - (mouseY - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
    }, { passive: false });

    viewport.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        surface.style.transition = 'none'; 
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    const stopDragging = () => {
        if (isDragging) {
            isDragging = false;
            surface.style.transition = 'transform 0.1s ease-out'; 
        }
    };

    viewport.addEventListener('mouseup', stopDragging);
    viewport.addEventListener('mouseleave', stopDragging);

    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
            surface.style.transition = 'none';
        } else if (e.touches.length === 2) {
            isDragging = false; 
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialScale = scale;
            surface.style.transition = 'none';
        }
    }, { passive: false });

    viewport.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        
        if (e.touches.length === 1 && isDragging) {
            translateX = e.touches[0].clientX - startX;
            translateY = e.touches[0].clientY - startY;
            applyTransform();
        } else if (e.touches.length === 2 && initialPinchDistance) {
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            const newScale = Math.min(Math.max(0.4, initialScale * (currentDistance / initialPinchDistance)), 2.0);
            
            const rect = viewport.getBoundingClientRect();
            const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
            const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

            translateX = midX - (midX - translateX) * (newScale / scale);
            translateY = midY - (midY - translateY) * (newScale / scale);
            scale = newScale;
            applyTransform();
        }
    }, { passive: false });

    viewport.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null; 
        }
        if (e.touches.length === 0) {
            stopDragging(); 
        }
    });
}