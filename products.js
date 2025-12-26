// products.js - Gestione prodotti e inventario

import { getCurrentUser, getProducts, setProducts } from './state.js';
import { showLoading, hideLoading, escapeHtml, formatDate, getExpiryClass } from './utils.js';
import { switchTab } from './ui.js';

// DOM Elements
const productsList = document.getElementById('products-list');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const locationFilter = document.getElementById('location-filter');
const addProductForm = document.getElementById('add-product-form');
const eanInput = document.getElementById('ean-input');
const fetchEanBtn = document.getElementById('fetch-ean-btn');
const productNameInput = document.getElementById('product-name');
const productCategorySelect = document.getElementById('product-category');
const productLocationSelect = document.getElementById('product-location');
const quantityInput = document.getElementById('quantity');
const expiryDateInput = document.getElementById('expiry-date');

// Initialize
export function initializeProducts() {
    // Setup event listeners
    addProductForm.addEventListener('submit', handleAddProduct);
    fetchEanBtn.addEventListener('click', fetchProductFromEAN);
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
    locationFilter.addEventListener('change', filterProducts);
}

// Load Products from Supabase
export async function loadProducts() {
    try {
        showLoading();

        // Carica prodotti con le loro categorie
        const { data: productsData, error: productsError } = await supabaseClient
            .from('products')
            .select(`
                *,
                category:categories(id, name)
            `)
            .order('created_at', { ascending: false });

        if (productsError) throw productsError;

        // Carica l'inventario per ogni prodotto
        const productsWithInventory = await Promise.all(
            (productsData || []).map(async (product) => {
                const { data: inventoryData, error: inventoryError } = await supabaseClient
                    .from('inventory')
                    .select(`
                        *,
                        location:locations(id, name, icon)
                    `)
                    .eq('product_id', product.id);

                if (inventoryError) throw inventoryError;

                return {
                    ...product,
                    inventory: inventoryData || []
                };
            })
        );

        setProducts(productsWithInventory);
        renderProducts();
        hideLoading();
    } catch (error) {
        console.error('Errore caricamento prodotti:', error);
        alert('Errore nel caricamento dei prodotti: ' + error.message);
        hideLoading();
    }
}

// Render Products List
export function renderProducts(filteredProducts = null) {
    const productsToRender = filteredProducts || getProducts();

    if (productsToRender.length === 0) {
        productsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛒</div>
                <h3>Nessun prodotto</h3>
                <p>Aggiungi il tuo primo prodotto per iniziare</p>
            </div>
        `;
        return;
    }

    productsList.innerHTML = productsToRender.map(product => {
        const totalQuantity = product.inventory.reduce((sum, item) => sum + item.quantity, 0);
        const earliestExpiry = product.inventory
            .filter(item => item.expiry_date)
            .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];

        return `
            <div class="product-card">
                <div class="product-header">
                    <div>
                        <div class="product-name">${escapeHtml(product.name)}</div>
                        ${product.ean ? `<div class="product-ean">EAN: ${product.ean}</div>` : ''}
                    </div>
                </div>
                ${product.category ? `<span class="product-category">${escapeHtml(product.category.name)}</span>` : ''}
                
                <!-- Location badges -->
                <div>
                    ${product.inventory.map(item =>
            item.location ? `<span class="product-location">${escapeHtml(item.location.icon)} ${escapeHtml(item.location.name)}</span>` : ''
        ).filter(Boolean).join('')}
                </div>
                
                <div class="product-info">
                    <div class="info-row">
                        <span>Quantità totale:</span>
                        <strong>${totalQuantity}</strong>
                    </div>
                    ${earliestExpiry ? `
                        <div class="info-row">
                            <span>Prossima scadenza:</span>
                            <span class="${getExpiryClass(earliestExpiry.expiry_date)}">
                                ${formatDate(earliestExpiry.expiry_date)}
                            </span>
                        </div>
                    ` : ''}
                </div>

                <div class="product-actions">
                    <button class="btn btn-secondary" onclick="viewProductDetails('${product.id}')">Dettagli</button>
                    <button class="btn btn-danger" onclick="deleteProduct('${product.id}')">Elimina</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filter Products
export function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedLocation = locationFilter.value;

    const filtered = getProducts().filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
            (product.ean && product.ean.includes(searchTerm));
        const matchesCategory = !selectedCategory || product.category_id === selectedCategory;

        // Controllo location a livello di inventory
        const matchesLocation = !selectedLocation ||
            product.inventory.some(item => item.location_id === selectedLocation);

        return matchesSearch && matchesCategory && matchesLocation;
    });

    renderProducts(filtered);
}

// Add New Product
async function handleAddProduct(e) {
    e.preventDefault();

    const ean = eanInput.value.trim();
    const name = productNameInput.value.trim();
    const categoryId = productCategorySelect.value;
    const locationId = productLocationSelect.value;
    const quantity = parseInt(quantityInput.value);
    const expiryDate = expiryDateInput.value || null;

    if (!name || !categoryId || !locationId || !quantity) {
        alert('Compila tutti i campi obbligatori');
        return;
    }

    try {
        showLoading();

        // Inserisci il prodotto
        const { data: productData, error: productError } = await supabaseClient
            .from('products')
            .insert([{
                user_id: getCurrentUser().id,
                ean: ean || null,
                name: name,
                category_id: categoryId
            }])
            .select();

        if (productError) throw productError;

        // Inserisci l'inventario
        const { error: inventoryError } = await supabaseClient
            .from('inventory')
            .insert([{
                product_id: productData[0].id,
                quantity: quantity,
                expiry_date: expiryDate,
                location_id: locationId
            }]);

        if (inventoryError) throw inventoryError;

        // Reset form e ricarica
        addProductForm.reset();
        await loadProducts();
        switchTab('products');
        hideLoading();

        alert('Prodotto aggiunto con successo!');
    } catch (error) {
        console.error('Errore aggiunta prodotto:', error);
        alert('Errore nell\'aggiunta del prodotto: ' + error.message);
        hideLoading();
    }
}

// Delete Product (exposed globally for onclick)
export async function deleteProduct(productId) {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return;

    try {
        showLoading();
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) throw error;

        await loadProducts();
        hideLoading();
    } catch (error) {
        console.error('Errore eliminazione prodotto:', error);
        alert('Errore nell\'eliminazione del prodotto: ' + error.message);
        hideLoading();
    }
}

// View Product Details (exposed globally for onclick)
export function viewProductDetails(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    const inventoryDetails = product.inventory.map(item => {
        const locationInfo = item.location ? ` - ${item.location.icon} ${item.location.name}` : '';
        return `Quantità: ${item.quantity}${item.expiry_date ? `, Scadenza: ${formatDate(item.expiry_date)}` : ''}${locationInfo}`;
    }).join('\n');

    alert(`
Prodotto: ${product.name}
${product.ean ? `EAN: ${product.ean}` : ''}
Categoria: ${product.category ? product.category.name : 'Nessuna'}

Inventario:
${inventoryDetails || 'Nessun inventario'}
    `);
}

// Fetch Product from EAN (Open Food Facts API)
export async function fetchProductFromEAN() {
    const ean = eanInput.value.trim();

    if (!ean) {
        alert('Inserisci un codice EAN');
        return;
    }

    try {
        showLoading();
        fetchEanBtn.disabled = true;
        fetchEanBtn.textContent = 'Ricerca...';

        const response = await fetch(`${OPENFOODFACTS_API}/${ean}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            const productName = data.product.product_name || data.product.product_name_it || '';

            if (productName) {
                productNameInput.value = productName;
                alert(`Prodotto trovato: ${productName}`);
            } else {
                alert('Prodotto trovato ma senza nome. Inseriscilo manualmente.');
            }
        } else {
            alert('Prodotto non trovato nel database Open Food Facts. Inserisci il nome manualmente.');
        }

        hideLoading();
        fetchEanBtn.disabled = false;
        fetchEanBtn.textContent = 'Cerca';
    } catch (error) {
        console.error('Errore ricerca EAN:', error);
        alert('Errore nella ricerca del prodotto: ' + error.message);
        hideLoading();
        fetchEanBtn.disabled = false;
        fetchEanBtn.textContent = 'Cerca';
    }
}
