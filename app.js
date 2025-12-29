// app.js - Orchestratore principale (con Tab Scadenze)

import { initAuth, handleGoogleLogin, handleSignOut } from './auth.js';
import { initializeCategories, deleteCategory, openCategoryModal } from './categories.js';
import { initializeLocations, deleteLocation, openLocationModal } from './locations.js';
import { initializeProducts, deleteProduct, viewProductDetails, editProductInventory, moveProductInventory, deleteInventory, showProductInventoryModal } from './products.js';
import { initializeExpiry, renderExpiryTable } from './expiry.js';
import { initializeTabs } from './ui.js';

// DOM Elements
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const addCategoryBtn = document.getElementById('add-category-btn');
const quickAddCategoryBtn = document.getElementById('quick-add-category');
const addLocationBtn = document.getElementById('add-location-btn');
const quickAddLocationBtn = document.getElementById('quick-add-location');

// Expose functions globally for HTML onclick attributes
window.deleteCategory = deleteCategory;
window.deleteLocation = deleteLocation;
window.deleteProduct = deleteProduct;
window.viewProductDetails = viewProductDetails;
window.editProductInventory = editProductInventory;
window.moveProductInventory = moveProductInventory;
window.deleteInventory = deleteInventory;
window.showProductInventoryModal = showProductInventoryModal;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize modules
    initializeTabs(handleTabChange);
    initializeCategories();
    initializeLocations();
    initializeProducts();
    initializeExpiry();

    // Setup event listeners
    setupEventListeners();

    // Initialize authentication
    await initAuth();
});

function setupEventListeners() {
    // Auth buttons
    loginButton.addEventListener('click', handleGoogleLogin);
    logoutButton.addEventListener('click', handleSignOut);

    // Category modals
    addCategoryBtn.addEventListener('click', openCategoryModal);
    quickAddCategoryBtn.addEventListener('click', openCategoryModal);

    // Location modals
    addLocationBtn.addEventListener('click', openLocationModal);
    quickAddLocationBtn.addEventListener('click', openLocationModal);
}

// Handle tab changes
function handleTabChange(tabName) {
    if (tabName === 'expiry') {
        renderExpiryTable();
    }
}