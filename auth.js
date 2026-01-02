// auth.js - Gestione autenticazione CORRETTA

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
        showLoading();
        
        // Pulisci l'hash dall'URL se presente
        if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        
        // Controlla se l'utente è già loggato
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            await handleAuthSuccess(session.user);
        } else {
            hideLoading();
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
        hideLoading();
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
    try {
        showLoading();
        
        setCurrentUser(user);

        // Aggiorna UI
        loginSection.style.display = 'none';
        appSection.style.display = 'block';

        if (user.user_metadata && user.user_metadata.avatar_url) {
            userAvatar.src = user.user_metadata.avatar_url;
        }
        userName.textContent = (user.user_metadata && user.user_metadata.full_name) || user.email;

        // Carica i dati in sequenza con gestione errori
        try {
            await loadLocations();
            await initializeDefaultLocations();
            await loadCategories();
            await loadProducts();
        } catch (loadError) {
            console.error('Errore caricamento dati:', loadError);
            alert('Errore nel caricamento dei dati. Riprova.');
        }

        hideLoading();
    } catch (error) {
        console.error('Errore handleAuthSuccess:', error);
        hideLoading();
    }
}

// Sign Out
export async function handleSignOut() {
    try {
        showLoading();
        await supabaseClient.auth.signOut();
        resetState();

        loginSection.style.display = 'block';
        appSection.style.display = 'none';
        
        hideLoading();
    } catch (error) {
        console.error('Errore logout:', error);
        alert('Errore durante il logout');
        hideLoading();
    }
}
