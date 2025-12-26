// app.js - Orchestratore principale dell'applicazione

import { initAuth, handleGoogleLogin, handleSignOut } from './auth.js';
import { initializeCategories, deleteCategory, openCategoryModal } from './categories.js';
import { initializeLocations, deleteLocation, openLocationModal } from './locations.js';
import { initializeProducts, deleteProduct, viewProductDetails } from './products.js';
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

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize modules
    initializeTabs();
    initializeCategories();
    initializeLocations();
    initializeProducts();

    // Setup event listeners
    setupEventListeners();

    // Initialize authentication (this will load data if user is logged in)
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