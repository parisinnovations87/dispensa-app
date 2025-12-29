// locations.js - Gestione locazioni (CORRETTO)

import { getCurrentUser, getLocations, setLocations, getProducts } from './state.js';
import { showLoading, hideLoading, escapeHtml } from './utils.js';
import { loadProducts } from './products.js';
import { openModal, closeModal, setupModalCloseOnOutsideClick } from './ui.js';

// DOM Elements
const locationsList = document.getElementById('locations-list');
const locationFilter = document.getElementById('location-filter');
const productLocationSelect = document.getElementById('product-location');
const locationModal = document.getElementById('location-modal');
const locationForm = document.getElementById('location-form');
const closeLocationModalBtn = document.querySelector('.close-location');

// Initialize
export function initializeLocations() {
    locationForm.addEventListener('submit', handleAddLocation);
    closeLocationModalBtn.addEventListener('click', () => closeLocationModal());
    setupModalCloseOnOutsideClick(locationModal);
}

// Initialize Default Locations
export async function initializeDefaultLocations() {
    if (getLocations().length > 0) return;

    const defaultLocations = [
        { name: 'Frigorifero', icon: '🧊' },
        { name: 'Dispensa', icon: '🥫' },
        { name: 'Freezer', icon: '❄️' },
        { name: 'Cantina', icon: '🍷' },
        { name: 'Ripostiglio', icon: '📦' }
    ];

    try {
        for (const location of defaultLocations) {
            const { error } = await supabaseClient
                .from('locations')
                .insert([{
                    user_id: getCurrentUser().id,
                    name: location.name,
                    icon: location.icon
                }]);

            if (error) throw error;
        }

        await loadLocations();
    } catch (error) {
        console.error('Errore creazione locations di default:', error);
    }
}

// Load Locations from Supabase
export async function loadLocations() {
    try {
        showLoading();
        const { data, error } = await supabaseClient
            .from('locations')
            .select('*')
            .order('name');

        if (error) throw error;

        setLocations(data || []);
        renderLocations();
        updateLocationSelects();
        hideLoading();
    } catch (error) {
        console.error('Errore caricamento locations:', error);
        alert('Errore nel caricamento delle locazioni: ' + error.message);
        hideLoading();
    }
}

// Render Locations List (CORRETTO IL CONTEGGIO)
export function renderLocations() {
    const locations = getLocations();

    if (locations.length === 0) {
        locationsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📍</div>
                <h3>Nessuna locazione</h3>
                <p>Crea la tua prima locazione per organizzare i prodotti</p>
            </div>
        `;
        return;
    }

    // CORRETTO: Calcola statistiche per ogni location contando la quantità
    const locationStats = {};
    const products = getProducts();
    
    products.forEach(product => {
        product.inventory.forEach(item => {
            if (item.location_id) {
                // Somma le QUANTITÀ, non solo il numero di entry
                locationStats[item.location_id] = (locationStats[item.location_id] || 0) + item.quantity;
            }
        });
    });

    locationsList.innerHTML = locations.map(location => `
        <div class="location-card">
            <div class="location-header">
                <span class="location-icon">${escapeHtml(location.icon)}</span>
                <span class="location-name">${escapeHtml(location.name)}</span>
            </div>
            <div class="location-actions">
                <span class="location-stats">${locationStats[location.id] || 0} pezzi</span>
                <button class="btn btn-danger btn-small" onclick="deleteLocation('${location.id}')">Elimina</button>
            </div>
        </div>
    `).join('');
}

// Update Location Dropdowns
export function updateLocationSelects() {
    const locations = getLocations();
    const options = locations.map(loc =>
        `<option value="${loc.id}">${escapeHtml(loc.icon)} ${escapeHtml(loc.name)}</option>`
    ).join('');

    productLocationSelect.innerHTML = `
        <option value="">Seleziona una locazione</option>
        ${options}
    `;

    locationFilter.innerHTML = `
        <option value="">Tutte le locazioni</option>
        ${options}
    `;
}

// Add New Location
async function handleAddLocation(e) {
    e.preventDefault();

    const name = document.getElementById('location-name').value.trim();
    const icon = document.getElementById('location-icon').value.trim();

    if (!name || !icon) {
        alert('Inserisci un nome e un\'icona per la locazione');
        return;
    }

    try {
        showLoading();
        const { data, error } = await supabaseClient
            .from('locations')
            .insert([{
                user_id: getCurrentUser().id,
                name: name,
                icon: icon
            }])
            .select();

        if (error) throw error;

        const locations = getLocations();
        locations.push(data[0]);
        setLocations(locations);

        renderLocations();
        updateLocationSelects();
        closeLocationModal();
        locationForm.reset();
        hideLoading();

        if (productLocationSelect) {
            productLocationSelect.value = data[0].id;
        }
    } catch (error) {
        console.error('Errore creazione locazione:', error);
        alert('Errore nella creazione della locazione: ' + error.message);
        hideLoading();
    }
}

// Delete Location
export async function deleteLocation(locationId) {
    if (!confirm('Sei sicuro di voler eliminare questa locazione?')) return;

    try {
        showLoading();
        const { error } = await supabaseClient
            .from('locations')
            .delete()
            .eq('id', locationId);

        if (error) throw error;

        const locations = getLocations().filter(l => l.id !== locationId);
        setLocations(locations);

        renderLocations();
        updateLocationSelects();
        await loadProducts();
        hideLoading();
    } catch (error) {
        console.error('Errore eliminazione locazione:', error);
        alert('Errore nell\'eliminazione della locazione: ' + error.message);
        hideLoading();
    }
}

// Modal Management
export function openLocationModal() {
    openModal(locationModal);
    document.getElementById('location-name').focus();
}

export function closeLocationModal() {
    closeModal(locationModal);
    locationForm.reset();
}