// products.js - Gestione prodotti CORRETTA

import { getCurrentUser, getProducts, setProducts, getLocations } from './state.js';
import { showLoading, hideLoading, escapeHtml, formatDate, getExpiryClass } from './utils.js';
import { switchTab } from './ui.js';
import { renderLocations } from './locations.js';

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

// Variabile per gestire la modalità modifica
let editingProductId = null;

// Expose globally
window.editProduct = editProduct;
window.moveProduct = moveProduct;

// Initialize
export function initializeProducts() {
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

        const { data: productsData, error: productsError } = await supabaseClient
            .from('products')
            .select(`
                *,
                category:categories(id, name)
            `)
            .order('created_at', { ascending: false });

        if (productsError) throw productsError;

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
        
        // AGGIORNA ANCHE LE LOCAZIONI per il conteggio
        renderLocations();
        
        hideLoading();
    } catch (error) {
        console.error('Errore caricamento prodotti:', error);
        alert('Errore nel caricamento dei prodotti: ' + error.message);
        hideLoading();
    }
}

// Render Products List - VISTA RAGGRUPPATA
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

    // Raggruppa per prodotto (non espandere inventory)
    productsList.innerHTML = productsToRender.map(product => {
        const totalQuantity = product.inventory.reduce((sum, item) => sum + item.quantity, 0);
        const numLocations = product.inventory.length;
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
                
                <div class="product-info">
                    <div class="info-row">
                        <span>📍 ${numLocations} ${numLocations === 1 ? 'locazione' : 'locazioni'}</span>
                        <strong>${totalQuantity} pezzi totali</strong>
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
                    <button class="btn btn-primary btn-small" onclick="showProductInventoryModal('${product.id}')">Dettagli Inventario</button>
                    <button class="btn btn-danger btn-small" onclick="deleteProduct('${product.id}')">Elimina Tutto</button>
                </div>
            </div>
        `;
    }).join('');
}

// NUOVA FUNZIONE: Modale con dettagli inventory
export function showProductInventoryModal(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    const inventoryRows = product.inventory.map(inv => `
        <tr>
            <td>${inv.location ? escapeHtml(inv.location.icon) + ' ' + escapeHtml(inv.location.name) : 'N/A'}</td>
            <td><strong>${inv.quantity} pz</strong></td>
            <td>${inv.expiry_date ? `<span class="${getExpiryClass(inv.expiry_date)}">${formatDate(inv.expiry_date)}</span>` : '-'}</td>
            <td>
                <button class="btn btn-info btn-small" onclick="moveProductInventory('${product.id}', '${inv.id}')">Sposta</button>
                <button class="btn btn-secondary btn-small" onclick="editProductInventory('${product.id}', '${inv.id}')">Modifica</button>
                <button class="btn btn-danger btn-small" onclick="deleteInventory('${inv.id}')">Elimina</button>
            </td>
        </tr>
    `).join('');

    const modalHTML = `
        <div id="inventory-modal" class="modal" style="display: block;">
            <div class="modal-content modal-large">
                <span class="close" onclick="document.getElementById('inventory-modal').remove()">&times;</span>
                <h2>📦 Inventario: ${escapeHtml(product.name)}</h2>
                ${product.ean ? `<p class="product-ean">EAN: ${product.ean}</p>` : ''}
                
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Locazione</th>
                            <th>Quantità</th>
                            <th>Scadenza</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventoryRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Expose globally
window.showProductInventoryModal = showProductInventoryModal;

// Filter Products
export function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedLocation = locationFilter.value;

    const filtered = getProducts().filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
            (product.ean && product.ean.includes(searchTerm));
        const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
        const matchesLocation = !selectedLocation ||
            product.inventory.some(item => item.location_id === selectedLocation);

        return matchesSearch && matchesCategory && matchesLocation;
    });

    renderProducts(filtered);
}

// Add/Update Product
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

        if (editingProductId) {
            // MODIFICA PRODOTTO ESISTENTE
            const { error: productError } = await supabaseClient
                .from('products')
                .update({
                    ean: ean || null,
                    name: name,
                    category_id: categoryId
                })
                .eq('id', editingProductId);

            if (productError) throw productError;

            // Aggiorna inventory (elimina vecchi e crea nuovo)
            const { error: deleteError } = await supabaseClient
                .from('inventory')
                .delete()
                .eq('product_id', editingProductId);

            if (deleteError) throw deleteError;

            const { error: inventoryError } = await supabaseClient
                .from('inventory')
                .insert([{
                    product_id: editingProductId,
                    quantity: quantity,
                    expiry_date: expiryDate,
                    location_id: locationId
                }]);

            if (inventoryError) throw inventoryError;

            editingProductId = null;
            document.querySelector('#add-tab h2').textContent = 'Aggiungi Nuovo Prodotto';
            alert('Prodotto modificato con successo!');
        } else {
            // NUOVO PRODOTTO - Controlla se esiste già
            let productId;
            
            // Cerca prodotto esistente (per EAN o nome + categoria)
            let existingProduct = null;
            
            if (ean) {
                // Cerca per EAN
                const { data } = await supabaseClient
                    .from('products')
                    .select('id')
                    .eq('user_id', getCurrentUser().id)
                    .eq('ean', ean)
                    .single();
                existingProduct = data;
            }
            
            if (!existingProduct) {
                // Cerca per nome + categoria
                const { data } = await supabaseClient
                    .from('products')
                    .select('id')
                    .eq('user_id', getCurrentUser().id)
                    .eq('name', name)
                    .eq('category_id', categoryId)
                    .single();
                existingProduct = data;
            }

            if (existingProduct) {
                // Prodotto già esistente, usa quello
                productId = existingProduct.id;
            } else {
                // Crea nuovo prodotto
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
                productId = productData[0].id;
            }

            // Controlla se esiste già inventory con stessa locazione e scadenza
            const { data: existingInv } = await supabaseClient
                .from('inventory')
                .select('id, quantity')
                .eq('product_id', productId)
                .eq('location_id', locationId)
                .eq('expiry_date', expiryDate || null)
                .single();

            if (existingInv) {
                // Somma alla quantità esistente
                const { error: updateError } = await supabaseClient
                    .from('inventory')
                    .update({ quantity: existingInv.quantity + quantity })
                    .eq('id', existingInv.id);

                if (updateError) throw updateError;
                alert('Quantità aggiunta al lotto esistente!');
            } else {
                // Crea nuovo inventory
                const { error: inventoryError } = await supabaseClient
                    .from('inventory')
                    .insert([{
                        product_id: productId,
                        quantity: quantity,
                        expiry_date: expiryDate,
                        location_id: locationId
                    }]);

                if (inventoryError) throw inventoryError;
                alert('Prodotto aggiunto con successo!');
            }
        }

        addProductForm.reset();
        await loadProducts();
        switchTab('products');
        hideLoading();
    } catch (error) {
        console.error('Errore salvataggio prodotto:', error);
        alert('Errore nel salvataggio del prodotto: ' + error.message);
        hideLoading();
    }
}

// NUOVE FUNZIONI per azioni su inventory specifico

// Modifica un inventory specifico
export function editProductInventory(productId, inventoryId) {
    const product = getProducts().find(p => p.id === productId);
    const inventory = product?.inventory.find(inv => inv.id === inventoryId);
    if (!product || !inventory) return;

    editingProductId = productId;
    document.querySelector('#add-tab h2').textContent = 'Modifica Lotto';

    eanInput.value = product.ean || '';
    productNameInput.value = product.name;
    productCategorySelect.value = product.category_id;
    productLocationSelect.value = inventory.location_id;
    quantityInput.value = inventory.quantity;
    expiryDateInput.value = inventory.expiry_date || '';

    document.getElementById('inventory-modal').remove();
    switchTab('add');
}

// Sposta un inventory specifico
export function moveProductInventory(productId, inventoryId) {
    document.getElementById('inventory-modal').remove();
    
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    // Filtra solo l'inventory specifico
    const inventory = product.inventory.find(inv => inv.id === inventoryId);
    if (!inventory) return;

    const modalHTML = `
        <div id="move-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <span class="close" onclick="document.getElementById('move-modal').remove()">&times;</span>
                <h2>Sposta: ${escapeHtml(product.name)}</h2>
                <p><strong>Da:</strong> ${inventory.location ? escapeHtml(inventory.location.icon) + ' ' + escapeHtml(inventory.location.name) : 'N/A'} (${inventory.quantity} pz disponibili)</p>
                <form id="move-form">
                    <input type="hidden" id="move-from-inventory" value="${inventoryId}">
                    <div class="form-group">
                        <label>Quanti pezzi spostare? <span id="max-qty-label">(Max: ${inventory.quantity})</span></label>
                        <input type="number" id="move-quantity" min="1" max="${inventory.quantity}" value="1" required>
                    </div>
                    <div class="form-group">
                        <label>Verso quale locazione?</label>
                        <select id="move-to-location" required>
                            <option value="">Seleziona locazione di destinazione</option>
                            ${getLocations().map(loc => 
                                `<option value="${loc.id}">${escapeHtml(loc.icon)} ${escapeHtml(loc.name)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Sposta</button>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('move-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const moveQty = parseInt(document.getElementById('move-quantity').value);
        const toLocationId = document.getElementById('move-to-location').value;

        if (moveQty > inventory.quantity) {
            alert(`Quantità non valida! Hai solo ${inventory.quantity} pezzi disponibili.`);
            return;
        }

        if (inventory.location_id === toLocationId) {
            alert('Non puoi spostare nella stessa locazione!');
            return;
        }

        try {
            showLoading();

            if (moveQty === inventory.quantity) {
                await supabaseClient
                    .from('inventory')
                    .delete()
                    .eq('id', inventoryId);
            } else {
                await supabaseClient
                    .from('inventory')
                    .update({ quantity: inventory.quantity - moveQty })
                    .eq('id', inventoryId);
            }

            const existingInv = product.inventory.find(inv => inv.location_id === toLocationId && inv.expiry_date === inventory.expiry_date);

            if (existingInv) {
                await supabaseClient
                    .from('inventory')
                    .update({ quantity: existingInv.quantity + moveQty })
                    .eq('id', existingInv.id);
            } else {
                await supabaseClient
                    .from('inventory')
                    .insert([{
                        product_id: productId,
                        quantity: moveQty,
                        expiry_date: inventory.expiry_date,
                        location_id: toLocationId
                    }]);
            }

            document.getElementById('move-modal').remove();
            await loadProducts();
            hideLoading();
            alert('Prodotto spostato con successo!');
        } catch (error) {
            console.error('Errore spostamento:', error);
            alert('Errore nello spostamento: ' + error.message);
            hideLoading();
        }
    });
}

// Elimina un inventory specifico
export async function deleteInventory(inventoryId) {
    if (!confirm('Sei sicuro di voler eliminare questo lotto?')) return;

    try {
        showLoading();
        const { error } = await supabaseClient
            .from('inventory')
            .delete()
            .eq('id', inventoryId);

        if (error) throw error;

        document.getElementById('inventory-modal').remove();
        await loadProducts();
        hideLoading();
    } catch (error) {
        console.error('Errore eliminazione inventory:', error);
        alert('Errore nell\'eliminazione: ' + error.message);
        hideLoading();
    }
}

// Expose globally
window.editProductInventory = editProductInventory;
window.moveProductInventory = moveProductInventory;
window.deleteInventory = deleteInventory;

// Delete Product
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

// View Product Details
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

// Fetch Product from EAN
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