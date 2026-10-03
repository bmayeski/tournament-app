// app.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, setTournamentId, setTournamentData, setCurrentView } from './state.js';
import { initAuth, applyGameDayLockdown, initHiddenSuperAdmin } from './adminAuth.js';
import { initPools, loadTeams } from './adminPools.js';
import { initSchedule, loadSchedule } from './adminSchedule.js';
import { initEditor, loadTournamentInfo } from './adminInfo.js';
import { initScores } from './adminScores.js';
import { populateTeamDropdown, renderMyTeam } from './uiTeam.js';
import { renderPublicInfo, renderPublicPools } from './uiPublic.js';
import { initManagePools, loadPoolScores } from './adminManagePools.js';
import { renderBracketView } from './uiBracket.js';
import { initBracketAdmin } from './adminManageBrackets.js';

// --- VIEW NAVIGATION (ROUTER) ---
export function switchView(viewId) {
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none'; 
    });
  
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
  
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block'; 
    }

    const targetBtn = document.getElementById('btn-' + viewId);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    setCurrentView(viewId);

    if (viewId === 'bracketsView') {
        renderBracketView();
    }
}

// --- ADMIN SUB-VIEW NAVIGATION ---
export function switchAdminView(subViewId) {
    const subViews = document.querySelectorAll('.admin-sub-view');
    subViews.forEach(v => v.style.display = 'none');
    
    const adminNavBtns = document.querySelectorAll('#adminView .nav-btn:not(#btn-adminLogout)');
    adminNavBtns.forEach(btn => btn.classList.remove('active'));
    
    const target = document.getElementById(subViewId);
    if (target) target.style.display = 'block';
    
    const targetBtn = document.getElementById('btn-' + subViewId);
    if (targetBtn) targetBtn.classList.add('active');
}

// --- LOAD TOURNAMENT DIRECTORY (LANDING PAGE) ---
export async function loadTournamentDirectory() {
    const container = document.getElementById('tournamentDirectory');
    if (!container) return;

    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .in('status', ['published', 'active', 'completed']);

        if (error) throw error;

        if (!tournaments || tournaments.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No active tournaments scheduled yet.</p>';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = '';

        const groups = {
            active: { title: '🔴 Live Right Now', items: [] },
            published: { title: '🟠 Upcoming Tournaments', items: [] },
            completed: { title: '🔵 Past Results', items: [] }
        };

        tournaments.forEach(t => {
            if (groups[t.status]) groups[t.status].items.push(t);
        });

        for (const [status, group] of Object.entries(groups)) {
            if (group.items.length === 0) continue;

            // Sort ascending by date
            group.items.sort((a, b) => {
                const dateA = new Date(a.date || '2099-01-01').getTime();
                const dateB = new Date(b.date || '2099-01-01').getTime();
                return dateA - dateB;
            });

            let sectionHTML = `
                <div style="margin-bottom: 25px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0 5px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9;">
                        ${group.title}
                    </h4>
                    
                    <!-- Horizontal Scroll Container (Added padding to prevent glow clipping) -->
                    <div style="display: flex; gap: 15px; overflow-x: auto; padding: 10px 10px; scrollbar-width: thin; -webkit-overflow-scrolling: touch;">
            `;

            group.items.forEach(t => {
                const safeName = t.name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                const themeColor = t.theme_color || 'var(--accent-orange)';

                sectionHTML += `
                    <a href="?t=${encodeURIComponent(t.slug)}" class="tournament-card" style="--card-glow: ${themeColor}; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; text-decoration: none; color: inherit; width: 380px; max-width: 85vw; flex: 0 0 auto; box-sizing: border-box; transition: box-shadow 0.3s ease, border-color 0.3s ease;">
                        
                        <!-- Animated Header Accent -->
                        <div class="card-accent" style="background-color: ${themeColor};"></div>

                        <!-- Tournament Title -->
                        <div style="margin-bottom: 8px; position: relative; z-index: 1;">
                            <h4 style="margin: 0; padding-bottom: 3px; color: var(--text-primary); font-size: 1rem; line-height: 1.4; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0px 1px 3px rgba(0,0,0,0.8);" title="${safeName}">
                                ${safeName}
                            </h4>
                        </div>

                        <!-- Inline Date & Location Footer -->
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; position: relative; z-index: 1;">
                            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-shrink: 0; text-shadow: 0px 1px 2px rgba(0,0,0,0.6);">
                                <span>📅</span> ${t.date || 'TBD'}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; padding-left: 10px; text-shadow: 0px 1px 2px rgba(0,0,0,0.6);">
                                <span>📍</span> ${t.location || 'TBD'}
                            </div>
                        </div>
                    </a>
                `;
            });

            sectionHTML += `</div></div>`;
            container.innerHTML += sectionHTML;
        }
    } catch (err) {
        console.error('Error loading tournament directory:', err);
        container.innerHTML = '<p style="color: var(--text-secondary);">Unable to load live events at this time.</p>';
    }
}

// --- ATTACH TO WINDOW FOR HTML ONCLICK ALERTS ---
window.switchView = switchView;
window.renderMyTeam = renderMyTeam;

window.attemptAdminLogin = () => {
    document.getElementById('adminLoginModal').style.display = 'flex';
};
document.getElementById('closeAdminLoginBtn')?.addEventListener('click', () => {
    document.getElementById('adminLoginModal').style.display = 'none';
});

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentSlug = urlParams.get('t');

    if (tournamentSlug) {
        document.getElementById('mainNav').style.display = 'flex';

        const { data, error } = await supabase
            .from('tournaments')
            .select('*') 
            .eq('slug', tournamentSlug)
            .single();

        if (data && !error) {
            setTournamentId(data.id);
            setTournamentData(data); 
            
            document.getElementById('app-header-title').innerText = data.name;
            if (data.theme_color) {
                document.documentElement.style.setProperty('--accent-orange', data.theme_color);
            }
            
            console.log("App Initialized. Active Tournament ID:", data.id);

            if (typeof applyGameDayLockdown === 'function') {
                applyGameDayLockdown(data.status);
            }
        } else {
            console.error("Could not locate tournament by slug.");
        }
    }

    // Wire up Admin Sub-navigation buttons
    document.getElementById('btn-adminInfo')?.addEventListener('click', () => switchAdminView('adminInfo'));
    document.getElementById('btn-adminSetup')?.addEventListener('click', () => switchAdminView('adminSetup'));
    document.getElementById('btn-adminSchedule')?.addEventListener('click', () => switchAdminView('adminSchedule'));
    document.getElementById('btn-adminStandings')?.addEventListener('click', () => {
        switchAdminView('adminStandings');
        loadPoolScores(); 
    });
    document.getElementById('btn-adminBrackets')?.addEventListener('click', () => switchAdminView('adminBrackets'));
    
    document.getElementById('btn-adminBracketScores')?.addEventListener('click', () => {
        switchAdminView('adminBracketScores');
        
        setTimeout(() => {
            if (typeof renderBracketView === 'function') {
                renderBracketView();
            }
        }, 10);
    });
    
    initAuth();
    initPools();
    initSchedule();
    initEditor();
    initScores();
    initManagePools();
    initBracketAdmin();
    
    if (typeof initHiddenSuperAdmin === 'function') {
        initHiddenSuperAdmin();
    }
    
    if (getTournamentId()) {
        switchView('infoView'); 
        await Promise.all([
            loadTeams(),
            loadSchedule(),
            loadTournamentInfo()
        ]);
        populateTeamDropdown();
        
        renderPublicInfo();
        renderPublicPools();

        // --- AUTO-REFRESH LOOP ---
        // Silently fetch new matches every 30 seconds and re-render the active views
        setInterval(async () => {
            // loadSchedule() handles fetching the db and triggering renderPublicPools()
            await loadSchedule(); 
            
            // If the user is actively looking at the bracket, give that a live refresh too
            const bracketsView = document.getElementById('bracketsView');
            if (bracketsView && bracketsView.classList.contains('active')) {
                if (typeof renderBracketView === 'function') {
                    renderBracketView();
                }
            }
        }, 30000); // 30,000 milliseconds = 30 seconds
    } else if (!tournamentSlug) {
        loadTournamentDirectory();
    }
});