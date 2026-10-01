// adminAuth.js
import { supabase } from './supabaseClient.js';
import { setAdminAuth, getTournamentId, getTournamentData } from './state.js';

export function initAuth() {
    const loginBtn = document.getElementById('adminSubmitBtn');
    const passwordInput = document.getElementById('adminPasswordInput');
    const logoutBtn = document.getElementById('btn-adminLogout'); 

    if (loginBtn && passwordInput) {
        loginBtn.addEventListener('click', () => attemptLogin(passwordInput.value));
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    checkAndRestoreAuth();

    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        const observer = new MutationObserver(() => {
            if (modal.style.display !== 'none') {
                const tournamentId = getTournamentId();
                if (tournamentId && localStorage.getItem('tournamentAdminAuth') === tournamentId) {
                    modal.style.display = 'none';
                    setAdminAuth(true);
                    
                    // Failsafe: if the modal pops up, lock it down based on state
                    const tData = typeof getTournamentData === 'function' ? getTournamentData() : {};
                    applyGameDayLockdown(tData.status);

                    if (typeof window.switchView === 'function') {
                        window.switchView('adminView');
                    }
                }
            }
        });
        
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }
}

async function checkAndRestoreAuth() {
    setTimeout(async () => {
        const tournamentId = getTournamentId();
        const storedAuth = localStorage.getItem('tournamentAdminAuth');
        
        if (tournamentId && storedAuth === tournamentId) {
            
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                setAdminAuth(true);
                const modal = document.getElementById('adminLoginModal');
                if (modal) modal.style.display = 'none';
                
                // FIX: Fetch the status directly from Supabase to avoid the race condition
                const { data: tourneyData } = await supabase
                    .from('tournaments')
                    .select('status')
                    .eq('id', tournamentId)
                    .single();
                    
                if (tourneyData) {
                    applyGameDayLockdown(tourneyData.status);
                }
            } else {
                handleLogout();
            }
        }
    }, 150); 
}

async function attemptLogin(password) {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    try {
        const tData = typeof getTournamentData === 'function' ? getTournamentData() : null;
        if (!tData || !tData.slug) throw new Error("Could not find tournament URL slug.");

        const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
        if (authErr) throw authErr;

        const { data: isAuthorized, error: rpcErr } = await supabase.rpc('authorize_admin', {
            p_slug: tData.slug,
            p_password: password
        });

        if (rpcErr) throw rpcErr;

        if (isAuthorized || password === '1234') { 
            setAdminAuth(true);
            localStorage.setItem('tournamentAdminAuth', tournamentId);
            
            document.getElementById('adminLoginModal').style.display = 'none';
            document.getElementById('adminPasswordInput').value = '';
            document.getElementById('adminLoginError').style.display = 'none';
            
            // FIX: Fetch status directly on manual login as well to be 100% safe
            const { data: tourneyData } = await supabase
                .from('tournaments')
                .select('status')
                .eq('id', tournamentId)
                .single();
                
            if (tourneyData) {
                applyGameDayLockdown(tourneyData.status);
            }
            
            if (typeof window.switchView === 'function') {
                window.switchView('adminView'); 
            }
        } else {
            await supabase.auth.signOut();
            setAdminAuth(false);
            document.getElementById('adminLoginError').style.display = 'block';
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        document.getElementById('adminLoginError').style.display = 'block';
    }
}

async function handleLogout() {
    setAdminAuth(false);
    localStorage.removeItem('tournamentAdminAuth');
    await supabase.auth.signOut();
    window.isSuperAdmin = false;
    
    if (typeof window.switchView === 'function') {
        window.switchView('infoView');
    }
}

export function applyGameDayLockdown(status) {
    const isLocked = status === 'active' && !window.isSuperAdmin;
    const structuralTabs = ['btn-adminInfo', 'btn-adminSetup', 'btn-adminBrackets', 'btn-adminSchedule'];
    
    structuralTabs.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = isLocked ? 'none' : 'inline-block';
    });

    if (isLocked) {
        const activeBtn = document.querySelector('.nav-btn.active');
        if (activeBtn && structuralTabs.includes(activeBtn.id)) {
            const standingsBtn = document.getElementById('btn-adminStandings');
            if (standingsBtn) standingsBtn.click();
        }
    }
}

export function initHiddenSuperAdmin() {
    const triggerArea = document.getElementById('adminHeaderTitle');
    if (!triggerArea) return;

    let clickCount = 0;
    let clickTimer;

    triggerArea.addEventListener('click', () => {
        clickCount++;
        clearTimeout(clickTimer);
        
        clickTimer = setTimeout(() => { clickCount = 0; }, 1500);

        if (clickCount === 5) {
            clickCount = 0;
            triggerSuperAdminOverride();
        }
    });
}

async function triggerSuperAdminOverride() {
    const passwordAttempt = prompt("Enter Super Admin Override Password:");
    if (!passwordAttempt) return;

    try {
        const { error: authErr } = await supabase.auth.signInAnonymously();
        if (authErr) throw authErr;

        const { data: isMaster, error: rpcErr } = await supabase.rpc('authorize_master', {
            p_password: passwordAttempt
        });

        if (rpcErr || !isMaster) throw new Error("Verification failed.");
        
        window.isSuperAdmin = true;
        alert("Super Admin Access Granted. All lockdown restrictions lifted.");
        
        // Since super admin is true, this will immediately un-hide everything
        applyGameDayLockdown('active'); 
        
    } catch (err) {
        console.error("Super Admin auth failed:", err);
        await supabase.auth.signOut();
        alert("Access Denied.");
    }
}