// auth.js - Gestione autenticazione

import { setCurrentUser, resetState } from './state.js';
import { showLoading, hideLoading } from './utils.js';
import { loadCategories } from './categories.js';
import { loadLocations, initializeDefaultLocations } from './locations.js';
import { loadProducts } from './products.js';

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// Initialize Authentication
export async function initAuth() {
    try {
        // Controlla se l'utente è già loggato
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            await handleAuthSuccess(session.user);
        }

        // Listener per cambiamenti di autenticazione
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await handleAuthSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                handleSignOut();
            }
        });
    } catch (error) {
        console.error('Errore inizializzazione auth:', error);
    }
}

// Google Login
export async function handleGoogleLogin() {
    try {
        showLoading();
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;
    } catch (error) {
        console.error('Errore login:', error);
        alert('Errore durante il login: ' + error.message);
        hideLoading();
    }
}

// Handle Successful Authentication
async function handleAuthSuccess(user) {
    setCurrentUser(user);

    // Aggiorna UI
    loginSection.style.display = 'none';
    appSection.style.display = 'block';

    if (user.user_metadata && user.user_metadata.avatar_url) {
        userAvatar.src = user.user_metadata.avatar_url;
    }
    userName.textContent = (user.user_metadata && user.user_metadata.full_name) || user.email;

    // Carica i dati
    await loadLocations();
    await initializeDefaultLocations();
    await loadCategories();
    await loadProducts();

    hideLoading();
}

// Sign Out
export async function handleSignOut() {
    try {
        await supabaseClient.auth.signOut();
        resetState();

        loginSection.style.display = 'block';
        appSection.style.display = 'none';
    } catch (error) {
        console.error('Errore logout:', error);
        alert('Errore durante il logout');
    }
}
