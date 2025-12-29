// categories.js - Gestione categorie

import { getCurrentUser, getCategories, setCategories } from './state.js';
import { showLoading, hideLoading, escapeHtml } from './utils.js';
import { loadProducts } from './products.js';
import { openModal, closeModal, setupModalCloseOnOutsideClick } from './ui.js';

// DOM Elements
const categoriesList = document.getElementById('categories-list');
const categoryFilter = document.getElementById('category-filter');
const productCategorySelect = document.getElementById('product-category');
const categoryModal = document.getElementById('category-modal');
const categoryForm = document.getElementById('category-form');
const closeModalBtn = document.querySelector('.close');

// Initialize
export function initializeCategories() {
    // Setup event listeners
    categoryForm.addEventListener('submit', handleAddCategory);
    closeModalBtn.addEventListener('click', () => closeCategoryModal());
    setupModalCloseOnOutsideClick(categoryModal);
}

// Load Categories from Supabase
export async function loadCategories() {
    try {
        showLoading();
        const { data, error } = await supabaseClient
            .from('categories')
            .select('*')
            .order('name');

        if (error) throw error;

        setCategories(data || []);
        renderCategories();
        updateCategorySelects();
        hideLoading();
    } catch (error) {
        console.error('Errore caricamento categorie:', error);
        alert('Errore nel caricamento delle categorie: ' + error.message);
        hideLoading();
    }
}

// Render Categories List
export function renderCategories() {
    const categories = getCategories();

    if (categories.length === 0) {
        categoriesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>Nessuna categoria</h3>
                <p>Crea la tua prima categoria per organizzare i prodotti</p>
            </div>
        `;
        return;
    }

    categoriesList.innerHTML = categories.map(category => `
        <div class="category-card">
            <span class="category-name">${escapeHtml(category.name)}</span>
            <button class="btn btn-danger" onclick="deleteCategory('${category.id}')">Elimina</button>
        </div>
    `).join('');
}

// Update Category Dropdowns
export function updateCategorySelects() {
    const categories = getCategories();
    const options = categories.map(cat =>
        `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`
    ).join('');

    productCategorySelect.innerHTML = `
        <option value="">Seleziona una categoria</option>
        ${options}
    `;

    categoryFilter.innerHTML = `
        <option value="">Tutte le categorie</option>
        ${options}
    `;
}

// Add New Category
async function handleAddCategory(e) {
    e.preventDefault();

    const name = document.getElementById('category-name').value.trim();

    if (!name) {
        alert('Inserisci un nome per la categoria');
        return;
    }

    try {
        showLoading();
        const { data, error } = await supabaseClient
            .from('categories')
            .insert([{
                user_id: getCurrentUser().id,
                name: name
            }])
            .select();

        if (error) throw error;

        const categories = getCategories();
        categories.push(data[0]);
        setCategories(categories);

        renderCategories();
        updateCategorySelects();
        closeCategoryModal();
        categoryForm.reset();
        hideLoading();

        // Se stiamo aggiungendo dal form prodotto, selezioniamola
        if (productCategorySelect) {
            productCategorySelect.value = data[0].id;
        }
    } catch (error) {
        console.error('Errore creazione categoria:', error);
        alert('Errore nella creazione della categoria: ' + error.message);
        hideLoading();
    }
}

// Delete Category (exposed globally for onclick)
export async function deleteCategory(categoryId) {
    if (!confirm('Sei sicuro di voler eliminare questa categoria?')) return;

    try {
        showLoading();
        const { error } = await supabaseClient
            .from('categories')
            .delete()
            .eq('id', categoryId);

        if (error) throw error;

        const categories = getCategories().filter(c => c.id !== categoryId);
        setCategories(categories);

        renderCategories();
        updateCategorySelects();
        await loadProducts(); // Ricarica i prodotti
        hideLoading();
    } catch (error) {
        console.error('Errore eliminazione categoria:', error);
        alert('Errore nell\'eliminazione della categoria: ' + error.message);
        hideLoading();
    }
}

// Modal Management
export function openCategoryModal() {
    openModal(categoryModal);
    document.getElementById('category-name').focus();
}

export function closeCategoryModal() {
    closeModal(categoryModal);
    categoryForm.reset();
}
