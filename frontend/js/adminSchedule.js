// adminSchedule.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, getTeams, getPools, setMatches } from './state.js'; 
import { renderPublicPools } from './uiPublic.js';
import { timeToMinutes } from './utils.js';
import { generatePoolSchedule } from './scheduleGenerator.js';

export function initSchedule() {
    const generateBtn = document.getElementById('generateScheduleBtn');
    const saveBtn = document.getElementById('saveScheduleBtn');

    if (generateBtn) {
        generateBtn.addEventListener('click', handleAutoGenerate);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSchedule);
        
        if (!document.getElementById('clearScheduleBtn')) {
            const clearBtn = document.createElement('button');
            clearBtn.id = 'clearScheduleBtn';
            clearBtn.className = 'btn btn-danger';
            clearBtn.innerText = 'Clear Schedule';
            clearBtn.addEventListener('click', handleClearSchedule);
            saveBtn.parentNode.insertBefore(clearBtn, saveBtn.nextSibling);
        }
    }
}

export async function loadSchedule() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('time', { ascending: true }); 

    if (error) {
        console.error("Error loading schedule:", error);
        return;
    }

    if (matches) {
        if (typeof setMatches === 'function') setMatches(matches);
        
        let retries = 0;
        while ((getTeams().length === 0 || getPools().length === 0) && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (matches.length > 0) {
            renderMatchGrid(matches);
        } else {
            const grid = document.getElementById('adminMatchGrid');
            if (grid) grid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">No matches found. Generate a schedule to begin.</p>';
        }
        
        if (typeof renderPublicPools === 'function') renderPublicPools();
    }
}

function handleAutoGenerate() {
    const teams = getTeams();
    const poolsList = getPools();
    
    if (!teams || teams.length === 0) {
        alert("Please assign teams to pools first!");
        return;
    }

    const startTimeInput = document.querySelector('input[type="time"]');
    const incrementSelect = document.querySelector('select'); 
    
    let incrementMins = 60;
    if (incrementSelect) {
        const val = parseInt(incrementSelect.value);
        if (!isNaN(val)) incrementMins = val;
    }

    const startMins = timeToMinutes(startTimeInput ? startTimeInput.value : '08:00');
    
    // Delegate the heavy lifting to the generator engine
    const generatedMatches = generatePoolSchedule(teams, poolsList, startMins, incrementMins);

    if (generatedMatches.length === 0) {
        alert("Could not generate schedule. Please ensure teams are assigned to pools and have seeds.");
        return;
    }

    renderMatchGrid(generatedMatches);
}

function renderMatchGrid(matches) {
    const grid = document.getElementById('adminMatchGrid');
    if (!grid) return;

    grid.innerHTML = ''; 
    grid.className = 'admin-grid-container';

    const allTeams = getTeams();
    const allPools = getPools(); 

    const getTeamOptions = (selectedId) => {
        return allTeams.map(t => {
            const seedText = t.seed ? `(${t.seed}) ` : '';
            return `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${seedText}${t.name}</option>`;
        }).join('');
    };

    const matchesByPool = {};
    matches.forEach(match => {
        const pid = match.pool_id || 'unassigned';
        if (!matchesByPool[pid]) matchesByPool[pid] = [];
        matchesByPool[pid].push(match);
    });

    const sortedPoolIds = Object.keys(matchesByPool).sort((idA, idB) => {
        const poolA = allPools.find(p => p.id === idA)?.name || 'Unassigned';
        const poolB = allPools.find(p => p.id === idB)?.name || 'Unassigned';
        return poolA.localeCompare(poolB);
    });

    sortedPoolIds.forEach(poolId => {
        const poolMatches = matchesByPool[poolId];
        poolMatches.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        const poolObj = allPools.find(p => p.id === poolId);
        const poolName = poolObj ? poolObj.name : 'Unassigned';

        const columnDiv = document.createElement('div');
        columnDiv.className = 'pool-column';

        const poolHeader = document.createElement('div');
        poolHeader.innerHTML = `<h3 class="pool-column-header">${poolName}</h3>`;
        columnDiv.appendChild(poolHeader);

        poolMatches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = 'admin-match-card';
            matchCard.dataset.matchId = match.id || ''; 
            matchCard.dataset.poolId = match.pool_id || ''; 

            matchCard.innerHTML = `
                <div class="admin-match-row">
                    <input type="time" class="match-time admin-input-full" value="${match.time || ''}">
                </div>

                <div class="admin-match-row">
                    <select class="team1-select admin-select">
                        <option value="">Team 1...</option>
                        ${getTeamOptions(match.teamA)}
                    </select>
                    <span class="admin-vs">vs</span>
                    <select class="team2-select admin-select">
                        <option value="">Team 2...</option>
                        ${getTeamOptions(match.teamB)}
                    </select>
                </div>

                <div class="admin-match-row" style="margin-bottom: 0;">
                    <span class="admin-ref-label">Ref:</span>
                    <select class="ref-select admin-select">
                        <option value="">Select Ref...</option>
                        ${getTeamOptions(match.ref)}
                    </select>
                </div>
            `;

            columnDiv.appendChild(matchCard);
        });

        grid.appendChild(columnDiv);
    });
}

async function saveSchedule() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const grid = document.getElementById('adminMatchGrid');
    const matchCards = grid.querySelectorAll('.admin-match-card');
    
    const updates = [];
    const activeIds = [];

    matchCards.forEach(card => {
        const t1 = card.querySelector('.team1-select').value;
        const t2 = card.querySelector('.team2-select').value;
        
        if (t1 && t2) {
            const matchData = {
                tournament_id: tournamentId,
                teamA: t1,
                teamB: t2,
                ref: card.querySelector('.ref-select').value || null,
                time: card.querySelector('.match-time').value || null, 
                pool_id: card.dataset.poolId || null 
            };

            const dbId = card.dataset.matchId;
            if (dbId && dbId.length > 10) { 
                matchData.id = dbId;
                activeIds.push(dbId);
            }

            updates.push(matchData);
        }
    });

    if (updates.length === 0) {
        alert("No matches on screen to save. Use 'Clear Schedule' to completely empty the database.");
        return;
    }

    const { data: existingMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId);
        
    if (existingMatches) {
        const toDelete = existingMatches.map(m => m.id).filter(id => !activeIds.includes(id));
        if (toDelete.length > 0) {
            await supabase.from('matches').delete().in('id', toDelete);
        }
    }

    const { error } = await supabase.from('matches').upsert(updates);

    if (error) {
        alert("Error saving schedule: " + error.message);
    } else {
        alert("Schedule saved successfully!");
        loadSchedule(); 
    }
}

async function handleClearSchedule() {
    if (!confirm("Are you sure you want to delete ALL matches for this tournament? This cannot be undone.")) return;
    
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { error } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId);

    if (error) {
        alert("Error clearing schedule: " + error.message);
    } else {
        alert("Schedule completely cleared!");
        document.getElementById('adminMatchGrid').innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">Schedule empty. Generate matches to begin.</p>';
        if (typeof setMatches === 'function') setMatches([]);
        if (typeof renderPublicPools === 'function') renderPublicPools();
    }
}