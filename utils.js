// utils.js - Funzioni utility condivise CORRETTE

// DOM Elements
const loading = document.getElementById('loading');

// Loading Spinner con timeout di sicurezza
let loadingTimeout = null;

export function showLoading() {
    if (loading) {
        loading.style.display = 'flex';
        
        // SAFETY: Nasconde automaticamente dopo 30 secondi
        clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => {
            console.warn('Loading timeout raggiunto - nascondo spinner');
            hideLoading();
        }, 30000);
    }
}

export function hideLoading() {
    if (loading) {
        loading.style.display = 'none';
        clearTimeout(loadingTimeout);
    }
}

// Date Formatting
export function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
}

// Expiry Class Calculation
export function getExpiryClass(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expiry-badge expiry-expired';
    if (diffDays <= 7) return 'expiry-badge expiry-warning';
    return 'expiry-badge expiry-ok';
}

// HTML Escaping for Security
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
