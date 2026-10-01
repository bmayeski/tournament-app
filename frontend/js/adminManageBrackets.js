// adminManageBrackets.js
import { supabase } from './supabaseClient.js';
import { getPools, getTeams, getMatches, getTournamentData, getTournamentId } from './state.js';
import { renderBracketView } from './uiBracket.js';
import { printBrackets } from './adminPrint.js';
import { generateBracketData } from './bracketGenerator.js'; 

export function populateBracketAdminConfig() {
    const tournamentData = getTournamentData(); 
    
    if (!tournamentData || Object.keys(tournamentData).length === 0) {
        setTimeout(populateBracketAdminConfig, 200);
        return;
    }
    
    let existingConfig = tournamentData.bracket_config || {}; 
    if (typeof existingConfig === 'string') {
        try { existingConfig = JSON.parse(existingConfig); } catch(e) {}
    }

    const startInput = document.getElementById('bracketStartTime');
    if (startInput) startInput.value = existingConfig.start || '13:00';
    
    const poolDurInput = document.getElementById('poolDuration');
    if (poolDurInput) poolDurInput.value = existingConfig.poolDuration || '60';

    const bracketDurInput = document.getElementById('bracketDuration');
    if (bracketDurInput) bracketDurInput.value = existingConfig.bracketDuration || '60';
    
    const seedingInput = document.getElementById('hasSeedingRounds');
    if (seedingInput) seedingInput.value = existingConfig.seeding || (tournamentData.has_seeding_rounds ? 'Yes' : 'No');
    
    const formatInput = document.getElementById('bracketFormat');
    if (formatInput) {
        let savedFormat = existingConfig.format || tournamentData.format || '1day';
        if (savedFormat === '1-Day') savedFormat = '1day';
        formatInput.value = savedFormat;
    }

    const divInput = document.getElementById('bracketDivisions');
    if (divInput) divInput.value = existingConfig.divisions || '2';

    const bracketSetsInput = document.getElementById('bracketSetsConfig');
    if (bracketSetsInput) bracketSetsInput.value = existingConfig.bracketSets || '1';

    const site1Name = document.getElementById('site1Name');
    if (site1Name) site1Name.value = existingConfig.site1Name || '';
    const site1Color = document.getElementById('site1Color');
    const site1Hex = document.getElementById('site1Hex');
    if (site1Color && site1Hex) {
        site1Color.value = existingConfig.site1Color || '#3b82f6';
        site1Hex.value = existingConfig.site1Color || '#3b82f6';
    }

    const site2Name = document.getElementById('site2Name');
    if (site2Name) site2Name.value = existingConfig.site2Name || '';
    const site2Color = document.getElementById('site2Color');
    const site2Hex = document.getElementById('site2Hex');
    if (site2Color && site2Hex) {
        site2Color.value = existingConfig.site2Color || '#ef4444';
        site2Hex.value = existingConfig.site2Color || '#ef4444';
    }

    const site3Name = document.getElementById('site3Name');
    if (site3Name) site3Name.value = existingConfig.site3Name || '';
    const site3Color = document.getElementById('site3Color');
    const site3Hex = document.getElementById('site3Hex');
    if (site3Color && site3Hex) {
        site3Color.value = existingConfig.site3Color || '#22c55e';
        site3Hex.value = existingConfig.site3Color || '#22c55e';
    }
}

// --- NEW TEMPLATE BUILDER LOGIC ---
function openTemplateBuilder(prefix = 'G') {
    const tournamentData = getTournamentData();
    const config = tournamentData?.bracket_config || {};
    const pools = getPools();
    const allTeams = getTeams();
    const hasSeeding = config.seeding === 'Yes' || tournamentData?.has_seeding_rounds === true;

    // Fetch existing custom template, or generate the default shape to start with
    let template = config.customTemplates?.[prefix] || generateBracketData(prefix, pools, allTeams, config, hasSeeding);

    // Build the dynamic UI
    let modal = document.getElementById('customTemplateModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customTemplateModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;';
        document.body.appendChild(modal);
    }

    const getTeamDropdown = (selectedVal, matchIds, matchIdToExclude) => {
        let opts = `<option value="">-- Select Placeholder --</option>`;
        opts += `<option value="BYE" ${selectedVal === 'BYE' ? 'selected' : ''}>BYE</option>`;
        
        opts += `<optgroup label="Pool Placements">`;
        pools.forEach(p => {
            [1, 2, 3, 4].forEach(rank => {
                const val = `seed:${p.id}:${rank}`;
                const label = `${rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'} ${p.name}`;
                opts += `<option value="${val}" ${selectedVal === val ? 'selected' : ''}>${label}</option>`;
            });
        });
        opts += `</optgroup>`;

        opts += `<optgroup label="Bracket Outcomes">`;
        matchIds.forEach(id => {
            if (id !== matchIdToExclude) {
                opts += `<option value="winner:${id}" ${selectedVal === `winner:${id}` ? 'selected' : ''}>Winner Match ${id.replace(prefix, '')}</option>`;
                opts += `<option value="loser:${id}" ${selectedVal === `loser:${id}` ? 'selected' : ''}>Loser Match ${id.replace(prefix, '')}</option>`;
            }
        });
        opts += `</optgroup>`;

        return opts;
    };

    const renderRows = () => {
        const matchIds = template.map(m => m.id);
        const columns = ['Seeding Round', 'Quarterfinals', 'Semifinals', 'Finals', 'Championship'];
        
        return template.map((m, index) => {
            return `
            <div class="template-row" style="display: flex; gap: 10px; margin-bottom: 10px; background: #1e293b; padding: 10px; border-radius: 6px; align-items: center;" data-index="${index}">
                <input type="text" class="tpl-id" value="${m.id}" style="width: 50px; text-align: center; font-weight: bold; padding: 6px;" placeholder="ID">
                <select class="tpl-col" style="padding: 6px;">
                    ${columns.map(c => `<option value="${c}" ${m.col === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <select class="tpl-t1" style="flex: 1; padding: 6px;">${getTeamDropdown(m.t1, matchIds, m.id)}</select>
                <span style="color: white; font-weight: bold;">vs</span>
                <select class="tpl-t2" style="flex: 1; padding: 6px;">${getTeamDropdown(m.t2, matchIds, m.id)}</select>
                <span style="color: white; margin-left: 10px;">Ref:</span>
                <select class="tpl-ref" style="flex: 1; padding: 6px;">${getTeamDropdown(m.ref, matchIds, m.id)}</select>
                <button class="btn btn-danger delete-row-btn" style="padding: 6px 10px;">X</button>
            </div>
            `;
        }).join('');
    };

    const updateHtml = () => {
        modal.innerHTML = `
            <div style="background: #0f172a; border: 1px solid #334155; padding: 25px; border-radius: 12px; width: 90%; max-width: 1100px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: white; margin: 0;">🛠️ Custom Bracket Builder</h2>
                    <select id="tplDivisionSelect" style="padding: 8px; font-weight: bold; font-size: 1.1rem;">
                        <option value="G" ${prefix === 'G' ? 'selected' : ''}>Gold Division</option>
                        <option value="S" ${prefix === 'S' ? 'selected' : ''}>Silver Division</option>
                        <option value="B" ${prefix === 'B' ? 'selected' : ''}>Bronze Division</option>
                    </select>
                </div>
                
                <p style="color: var(--text-secondary); margin-bottom: 15px;">Build your matchups dynamically. Set custom identifiers (e.g., G1, G2), choose the visual column, and slot in dynamic placeholders.</p>
                
                <div id="templateRowsContainer">
                    ${renderRows()}
                </div>
                
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button id="addTemplateMatchBtn" class="btn" style="background: #334155;">+ Add Match</button>
                </div>
                
                <div style="margin-top: 25px; border-top: 1px solid #334155; padding-top: 15px; display: flex; justify-content: flex-end; gap: 15px;">
                    <button id="closeTemplateBtn" class="btn" style="background: transparent; border: 1px solid #64748b;">Cancel</button>
                    <button id="saveTemplateBtn" class="btn" style="background: var(--accent-orange);">Save Custom Placements</button>
                </div>
            </div>
        `;

        document.getElementById('addTemplateMatchBtn').onclick = () => {
            const nextNum = template.length + 1;
            template.push({ col: 'Quarterfinals', id: `${prefix}${nextNum}`, t1: '', t2: '', ref: '' });
            updateHtml();
        };

        document.querySelectorAll('.delete-row-btn').forEach(btn => {
            btn.onclick = (e) => {
                const index = e.target.closest('.template-row').dataset.index;
                template.splice(index, 1);
                updateHtml();
            };
        });

        document.getElementById('tplDivisionSelect').onchange = (e) => {
            openTemplateBuilder(e.target.value);
        };

        document.getElementById('closeTemplateBtn').onclick = () => {
            modal.style.display = 'none';
        };

        document.getElementById('saveTemplateBtn').onclick = async () => {
            const saveBtn = document.getElementById('saveTemplateBtn');
            saveBtn.innerText = 'Saving...';
            
            // Rebuild the template array from the DOM inputs
            const updatedTemplate = Array.from(document.querySelectorAll('.template-row')).map((row, i) => ({
                col: row.querySelector('.tpl-col').value,
                id: row.querySelector('.tpl-id').value,
                t1: row.querySelector('.tpl-t1').value,
                t2: row.querySelector('.tpl-t2').value,
                ref: row.querySelector('.tpl-ref').value,
                timeOffset: i // Automatically offsets time based on row order
            }));

            const tourneyId = getTournamentId();
            if (!config.customTemplates) config.customTemplates = {};
            config.customTemplates[prefix] = updatedTemplate;

            const { error } = await supabase.from('tournaments').update({ bracket_config: config }).eq('id', tourneyId);
            
            if (error) {
                alert("Failed to save template: " + error.message);
                saveBtn.innerText = 'Save Custom Placements';
                return;
            }

            if (tournamentData) tournamentData.bracket_config = config;
            modal.style.display = 'none';
            renderBracketView(); // Instantly update the visual bracket!
        };
    };

    modal.style.display = 'flex';
    updateHtml();
}

export function initBracketAdmin() {
    populateBracketAdminConfig();

    const saveConfigBtn = document.getElementById('saveBracketConfigBtn');
    
    // We removed the entire block that injected the old builderBtn here!
    
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
            const start = document.getElementById('bracketStartTime').value;
            const format = document.getElementById('bracketFormat')?.value || '1day';
            const seeding = document.getElementById('hasSeedingRounds')?.value || 'No';
            const divisions = document.getElementById('bracketDivisions')?.value || '2';
            
            const poolDuration = parseInt(document.getElementById('poolDuration').value, 10) || 60;
            const bracketDuration = parseInt(document.getElementById('bracketDuration').value, 10) || 60;

            const site1Name = document.getElementById('site1Name').value.trim();
            const site1Color = document.getElementById('site1Color').value;
            const site2Name = document.getElementById('site2Name').value.trim();
            const site2Color = document.getElementById('site2Color').value;
            const site3Name = document.getElementById('site3Name').value.trim();
            const site3Color = document.getElementById('site3Color').value;
            const bracketSets = document.getElementById('bracketSetsConfig')?.value || '1';

            // Preserve existing customTemplates when saving standard settings!
            const existingConfig = getTournamentData()?.bracket_config || {};
            const customTemplates = existingConfig.customTemplates || {};

            const configObj = { 
                start, poolDuration, bracketDuration, format, seeding, divisions, bracketSets,
                site1Name, site1Color, site2Name, site2Color, site3Name, site3Color, customTemplates
            };
            
            const tournamentId = getTournamentId();
            if (!tournamentId) return;

            const originalText = saveConfigBtn.innerText;
            saveConfigBtn.innerText = 'Saving to Database...';

            const { error } = await supabase.from('tournaments').update({ bracket_config: configObj }).eq('id', tournamentId);
                
            if (error) {
                alert("Error saving settings: " + error.message);
                saveConfigBtn.innerText = originalText;
                return;
            }
            
            const tournamentData = getTournamentData();
            if (tournamentData) tournamentData.bracket_config = configObj;

            saveConfigBtn.innerText = '✅ Configuration Saved!';
            saveConfigBtn.style.backgroundColor = '#22c55e'; 
            setTimeout(() => {
                saveConfigBtn.innerText = 'Save Defaults';
                saveConfigBtn.style.backgroundColor = 'var(--accent-orange)';
            }, 2000);
            
            renderBracketView();
        });
    }

    document.addEventListener('click', async (e) => {
        // --- 0. PLACEMENTS MODAL (VISUAL BUILDER) ---
        const placementsBtn = e.target.closest('.edit-bracket-placements-btn');
        if (placementsBtn) {
            const matchId = placementsBtn.dataset.matchId;
            const currentT1 = placementsBtn.dataset.t1;
            const currentT2 = placementsBtn.dataset.t2;
            const currentRef = placementsBtn.dataset.ref;
            const prefix = matchId.charAt(0);
            
            // Generate the modal HTML dynamically if it doesn't exist
            let modal = document.getElementById('editBracketPlacementsModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'editBracketPlacementsModal';
                modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;';
                document.body.appendChild(modal);
            }
            
            const pools = getPools();
            const getTeamDropdown = (selectedVal) => {
                let opts = `<option value="">-- Select Placeholder --</option>`;
                opts += `<option value="BYE" ${selectedVal === 'BYE' ? 'selected' : ''}>BYE</option>`;
                opts += `<optgroup label="Pool Placements">`;
                pools.forEach(p => {
                    [1, 2, 3, 4].forEach(rank => {
                        const val = `seed:${p.id}:${rank}`;
                        const label = `${rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'} ${p.name}`;
                        opts += `<option value="${val}" ${selectedVal === val ? 'selected' : ''}>${label}</option>`;
                    });
                });
                opts += `</optgroup>`;
                opts += `<optgroup label="Bracket Outcomes">`;
                ['1','2','3','4','5','6','7','S1','S2','S3','S4'].forEach(num => {
                    const id = `${prefix}${num}`;
                    if (id !== matchId) {
                        opts += `<option value="winner:${id}" ${selectedVal === `winner:${id}` ? 'selected' : ''}>Winner Match ${num}</option>`;
                        opts += `<option value="loser:${id}" ${selectedVal === `loser:${id}` ? 'selected' : ''}>Loser Match ${num}</option>`;
                    }
                });
                opts += `</optgroup>`;
                return opts;
            };

            modal.innerHTML = `
                <div style="background: #0f172a; border: 1px solid #334155; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <h2 style="color: white; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px;">🔀 Edit Match ${matchId.replace(prefix, '')} Placements</h2>
                    <input type="hidden" id="placementMatchId" value="${matchId}">
                    
                    <div style="margin-bottom: 15px;">
                        <label style="color: var(--text-secondary); font-size: 0.8rem; display: block; margin-bottom: 5px; text-transform: uppercase;">Team 1 Slot</label>
                        <select id="placementT1" style="width: 100%; padding: 8px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 4px;">${getTeamDropdown(currentT1)}</select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="color: var(--text-secondary); font-size: 0.8rem; display: block; margin-bottom: 5px; text-transform: uppercase;">Team 2 Slot</label>
                        <select id="placementT2" style="width: 100%; padding: 8px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 4px;">${getTeamDropdown(currentT2)}</select>
                    </div>
                    <div style="margin-bottom: 25px;">
                        <label style="color: var(--text-secondary); font-size: 0.8rem; display: block; margin-bottom: 5px; text-transform: uppercase;">Referee Slot</label>
                        <select id="placementRef" style="width: 100%; padding: 8px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 4px;">${getTeamDropdown(currentRef)}</select>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="cancelPlacementsBtn" class="btn" style="background: transparent; border: 1px solid #64748b;">Cancel</button>
                        <button id="savePlacementsBtn" class="btn" style="background: var(--accent-orange);">Save Placements</button>
                    </div>
                </div>
            `;
            
            modal.style.display = 'flex';
            
            document.getElementById('cancelPlacementsBtn').onclick = () => modal.style.display = 'none';
            
            document.getElementById('savePlacementsBtn').onclick = async () => {
                const saveBtn = document.getElementById('savePlacementsBtn');
                saveBtn.innerText = 'Saving...';
                
                const mId = document.getElementById('placementMatchId').value;
                const mPrefix = mId.charAt(0);
                
                const tournamentData = getTournamentData();
                const config = tournamentData?.bracket_config || {};
                if (!config.customTemplates) config.customTemplates = {};
                
                // If they haven't customized this division yet, grab the pure default shape array
                if (!config.customTemplates[mPrefix]) {
                    const allTeams = getTeams();
                    const hasSeeding = config.seeding === 'Yes' || tournamentData?.has_seeding_rounds === true;
                    // Bypass the custom check momentarily to get the raw default layout
                    const tempConfig = { ...config, customTemplates: {} }; 
                    config.customTemplates[mPrefix] = generateBracketData(mPrefix, pools, allTeams, tempConfig, hasSeeding);
                }
                
                // Apply their new dropdown choices to that specific match array object
                const matchIndex = config.customTemplates[mPrefix].findIndex(m => m.id === mId);
                if (matchIndex !== -1) {
                    config.customTemplates[mPrefix][matchIndex].t1 = document.getElementById('placementT1').value;
                    config.customTemplates[mPrefix][matchIndex].t2 = document.getElementById('placementT2').value;
                    config.customTemplates[mPrefix][matchIndex].ref = document.getElementById('placementRef').value;
                }
                
                const tournamentId = getTournamentId();
                const { error } = await supabase.from('tournaments').update({ bracket_config: config }).eq('id', tournamentId);
                
                if (error) {
                    alert("Failed to save placement: " + error.message);
                    saveBtn.innerText = 'Save Placements';
                    return;
                }
                
                if (tournamentData) tournamentData.bracket_config = config;
                modal.style.display = 'none';
                renderBracketView();
            };
        }

        // --- 1. SCORES MODAL ---
        const scoreBtn = e.target.closest('.edit-bracket-score-btn');
        if (scoreBtn) {
            const matchId = scoreBtn.dataset.matchId;
            document.getElementById('bracketScoreMatchId').value = matchId;
            document.getElementById('bracketScoreModalMatchup').innerText = `${scoreBtn.dataset.t1} vs ${scoreBtn.dataset.t2}`;
            
            const tourneyData = getTournamentData();
            const savedScores = tourneyData?.bracket_scores || {};
            const existing = savedScores[matchId] || {};
            
            document.getElementById('bs1A').value = existing.s1A ?? '';
            document.getElementById('bs1B').value = existing.s1B ?? '';
            document.getElementById('bs2A').value = existing.s2A ?? '';
            document.getElementById('bs2B').value = existing.s2B ?? '';
            document.getElementById('bs3A').value = existing.s3A ?? '';
            document.getElementById('bs3B').value = existing.s3B ?? '';

            document.getElementById('editBracketScoreModal').style.display = 'flex';
        }

        // --- 2. DETAILS MODAL ---
        const detailsBtn = e.target.closest('.edit-bracket-details-btn');
        if (detailsBtn) {
            const matchId = detailsBtn.dataset.matchId;
            
            document.getElementById('detailsMatchId').value = matchId;
            document.getElementById('bracketDetailsModalMatchup').innerText = `${detailsBtn.dataset.t1} vs ${detailsBtn.dataset.t2}`;
            
            const tourneyData = getTournamentData();
            const tourneyConfig = tourneyData?.bracket_config || {};
            const savedScores = tourneyData?.bracket_scores || {};
            const raw = savedScores[matchId] || {};
            
            document.getElementById('detailsTime').value = detailsBtn.dataset.time || '';
            document.getElementById('detailsCourt').value = raw.courtOverride || '';
            
            // Build Dynamic Site Dropdown
            const siteSelect = document.getElementById('detailsSite');
            let siteOpts = '<option value="">-- Select Site --</option>';
            [tourneyConfig.site1Name, tourneyConfig.site2Name, tourneyConfig.site3Name].forEach(s => {
                if (s) {
                    const isSiteSelected = raw.siteOverride === s ? 'selected' : '';
                    siteOpts += `<option value="${s}" ${isSiteSelected}>${s}</option>`;
                }
            });
            siteSelect.innerHTML = siteOpts;

            // Build dynamic Referee Dropdown
            const refSelect = document.getElementById('detailsRef');
            const teams = getTeams();
            const pools = getPools();
            const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
            
            let refOptions = '<option value="">-- Auto-Calculated Default --</option>';
            refOptions += '<optgroup label="Placeholder Seeds">';
            pools.forEach(pool => {
                for (let r = 1; r <= 4; r++) {
                    const seedVal = `seed:${pool.id}:${r}`;
                    const isSelected = raw.refOverride === seedVal ? 'selected' : '';
                    const rankStr = r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : '4th';
                    refOptions += `<option value="${seedVal}" ${isSelected}>${rankStr} ${pool.name}</option>`;
                }
            });
            refOptions += '</optgroup>';

            const activeDivisions = tourneyConfig.divisions || '2';
            const divisions = [
                { name: 'Gold', prefix: 'G' },
                { name: 'Silver', prefix: 'S' }
            ];
            if (activeDivisions === '3') divisions.push({ name: 'Bronze', prefix: 'B' });
            
            const hasSeeding = tourneyConfig.seeding === 'Yes' || tourneyData?.has_seeding_rounds === true;
            let loserMatchIds = ['1', '2', '3', '4', '5', '6', '7'];
            if (hasSeeding) loserMatchIds = ['S1', 'S2', 'S3', 'S4', ...loserMatchIds];

            divisions.forEach(div => {
                refOptions += `<optgroup label="${div.name} Division Losers">`;
                loserMatchIds.forEach(num => {
                    const refVal = `loser:${div.prefix}${num}`;
                    const isSelected = raw.refOverride === refVal ? 'selected' : '';
                    refOptions += `<option value="${refVal}" ${isSelected}>Loser of Match ${num} (${div.name})</option>`;
                });
                refOptions += `</optgroup>`;
            });

            refOptions += '<optgroup label="Specific Teams">';
            sortedTeams.forEach(t => {
                const isSelected = raw.refOverride === t.id ? 'selected' : '';
                refOptions += `<option value="${t.id}" ${isSelected}>${t.name}</option>`;
            });
            refOptions += '</optgroup>';
            
            refSelect.innerHTML = refOptions;
            document.getElementById('editBracketDetailsModal').style.display = 'flex';
        }

        // --- CLOSING MODALS ---
        if (e.target.closest('#closeBracketScoreModalBtn')) {
            document.getElementById('editBracketScoreModal').style.display = 'none';
        }
        if (e.target.closest('#closeBracketDetailsModalBtn')) {
            document.getElementById('editBracketDetailsModal').style.display = 'none';
        }

        // --- SAVING SCORES ---
        if (e.target.closest('#saveBracketScoresBtn')) {
            const saveBtn = e.target.closest('#saveBracketScoresBtn');
            const originalText = saveBtn.innerText;
            saveBtn.innerText = 'Saving...';

            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const matchId = document.getElementById('bracketScoreMatchId').value;
            const getVal = (id) => { const v = parseInt(document.getElementById(id).value, 10); return isNaN(v) ? null : v; };
            
            const s1A = getVal('bs1A'); const s1B = getVal('bs1B');
            const s2A = getVal('bs2A'); const s2B = getVal('bs2B');
            const s3A = getVal('bs3A'); const s3B = getVal('bs3B');

            let setsA = 0; let setsB = 0;
            if (s1A !== null && s1B !== null) { if (s1A > s1B) setsA++; else if (s1B > s1A) setsB++; }
            if (s2A !== null && s2B !== null) { if (s2A > s2B) setsA++; else if (s2B > s2A) setsB++; }
            if (s3A !== null && s3B !== null) { if (s3A > s3B) setsA++; else if (s3B > s3A) setsB++; }

            const savedScores = tourneyData.bracket_scores || {};
            if (!savedScores[matchId]) savedScores[matchId] = {};
            
            savedScores[matchId] = { 
                ...savedScores[matchId], 
                s1A, s1B, s2A, s2B, s3A, s3B, setsA, setsB 
            };

            const { error } = await supabase.from('tournaments').update({ bracket_scores: savedScores }).eq('id', tournamentId);

            if (error) {
                alert("Error saving score: " + error.message);
                saveBtn.innerText = originalText;
                return;
            }

            tourneyData.bracket_scores = savedScores;
            saveBtn.innerText = originalText;
            document.getElementById('editBracketScoreModal').style.display = 'none';
            renderBracketView();
        }

        // --- SAVING DETAILS ---
        if (e.target.closest('#saveBracketDetailsBtn')) {
            const saveBtn = e.target.closest('#saveBracketDetailsBtn');
            const matchId = document.getElementById('detailsMatchId').value;
            const timeVal = document.getElementById('detailsTime').value;
            const siteVal = document.getElementById('detailsSite').value.trim();
            const courtVal = document.getElementById('detailsCourt').value.trim();
            const refVal = document.getElementById('detailsRef').value;
            
            let warningMsg = '';

            if (refVal) {
                const poolMatches = getMatches();
                const refConflictPool = poolMatches.find(m => m.time === timeVal && (m.teamA === refVal || m.teamB === refVal || m.ref === refVal));
                if (refConflictPool) {
                    warningMsg += '⚠️️ The selected referee is already scheduled for a pool match at this time.\n';
                }
            }

            if (siteVal && courtVal) {
                const bracketMatches = window.activeBracketState || [];
                const courtConflict = bracketMatches.find(m => m.id !== matchId && m.time24 === timeVal && (m.site || '') === siteVal && (m.court || '') === courtVal);
                if (courtConflict) {
                    warningMsg += `⚠️ Court ${courtVal} at ${siteVal} is already booked for Bracket Match ${courtConflict.id.replace(/[A-Za-z]/g, '')} at this time.\n`;
                }
            }

            if (warningMsg) {
                warningMsg += '\nDo you still want to save these details?';
                if (!confirm(warningMsg)) return;
            }

            const originalText = saveBtn.innerText;
            saveBtn.innerText = 'Saving...';
            
            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const savedScores = tourneyData.bracket_scores || {};
            if (!savedScores[matchId]) savedScores[matchId] = {};
            
            if (timeVal) savedScores[matchId].timeOverride = timeVal; else delete savedScores[matchId].timeOverride;
            if (siteVal) savedScores[matchId].siteOverride = siteVal; else delete savedScores[matchId].siteOverride;
            if (courtVal) savedScores[matchId].courtOverride = courtVal; else delete savedScores[matchId].courtOverride;
            if (refVal) savedScores[matchId].refOverride = refVal; else delete savedScores[matchId].refOverride;

            const { error } = await supabase.from('tournaments').update({ bracket_scores: savedScores }).eq('id', tournamentId);
            
            if (error) {
                alert("Error saving details: " + error.message);
                saveBtn.innerText = originalText;
                return;
            }

            tourneyData.bracket_scores = savedScores;
            saveBtn.innerText = originalText;
            document.getElementById('editBracketDetailsModal').style.display = 'none';
            renderBracketView();
        }

        // --- CLEAR SCORES ---
        if (e.target.closest('#deleteBracketScoresBtn')) {
            if (!confirm("Clear scores for this bracket match? (This will not delete your Time/Location overrides).")) return;
            
            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const matchId = document.getElementById('bracketScoreMatchId').value;
            const savedScores = tourneyData.bracket_scores || {};
            
            if (savedScores[matchId]) {
                delete savedScores[matchId].s1A;
                delete savedScores[matchId].s1B;
                delete savedScores[matchId].s2A;
                delete savedScores[matchId].s2B;
                delete savedScores[matchId].s3A;
                delete savedScores[matchId].s3B;
                delete savedScores[matchId].setsA;
                delete savedScores[matchId].setsB;
            }

            const { error } = await supabase.from('tournaments').update({ bracket_scores: savedScores }).eq('id', tournamentId);

            if (error) {
                alert("Error deleting score: " + error.message);
                return;
            }

            tourneyData.bracket_scores = savedScores;
            document.getElementById('editBracketScoreModal').style.display = 'none';
            renderBracketView();
        }

        if (e.target.closest('#printBracketsBtn')) {
            printBrackets();
        }
    });
}