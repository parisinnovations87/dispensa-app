// ui.js - Gestione interfaccia utente (tabs, modals)

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Tab Management
export function initializeTabs(onTabChange) {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
            if (onTabChange) onTabChange(tabName);
        });
    });
}

export function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-tab`);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
}

// Generic Modal Management
export function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'block';
    }
}

export function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

// Setup modal close on outside click
export function setupModalCloseOnOutsideClick(modalElement) {
    window.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            closeModal(modalElement);
        }
    });
}