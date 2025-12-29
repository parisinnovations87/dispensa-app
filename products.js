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

// Render Products List - OGNI INVENTORY = UNA CARD
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

    // Espandi ogni prodotto in più card, una per ogni inventory
    const expandedProducts = [];
    productsToRender.forEach(product => {
        product.inventory.forEach(inv => {
            expandedProducts.push({
                ...product,
                singleInventory: inv
            });
        });
    });

    productsList.innerHTML = expandedProducts.map(item => {
        const inv = item.singleInventory;
        
        return `
            <div class="product-card">
                <div class="product-header">
                    <div>
                        <div class="product-name">${escapeHtml(item.name)}</div>
                        ${item.ean ? `<div class="product-ean">EAN: ${item.ean}</div>` : ''}
                    </div>
                </div>
                ${item.category ? `<span class="product-category">${escapeHtml(item.category.name)}</span>` : ''}
                
                <div>
                    ${inv.location ? `<span class="product-location">${escapeHtml(inv.location.icon)} ${escapeHtml(inv.location.name)}: ${inv.quantity} pz</span>` : ''}
                </div>
                
                <div class="product-info">
                    <div class="info-row">
                        <span>Quantità:</span>
                        <strong>${inv.quantity}</strong>
                    </div>
                    ${inv.expiry_date ? `
                        <div class="info-row">
                            <span>Scadenza:</span>
                            <span class="${getExpiryClass(inv.expiry_date)}">
                                ${formatDate(inv.expiry_date)}
                            </span>
                        </div>
                    ` : ''}
                </div>

                <div class="product-actions">
                    <button class="btn btn-secondary btn-small" onclick="viewProductDetails('${item.id}')">Dettagli</button>
                    <button class="btn btn-primary btn-small" onclick="editProduct('${item.id}')">Modifica</button>
                    <button class="btn btn-info btn-small" onclick="moveProduct('${item.id}')">Sposta</button>
                    <button class="btn btn-danger btn-small" onclick="deleteProduct('${item.id}')">Elimina</button>
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

// FUNZIONE MODIFICA: Mostra TUTTI gli inventory
export function editProduct(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    if (product.inventory.length === 0) {
        alert('Questo prodotto non ha inventory associato');
        return;
    }

    // Se ha più di un inventory, chiedi quale modificare
    if (product.inventory.length > 1) {
        const inventoryList = product.inventory.map((inv, idx) => 
            `${idx + 1}. ${inv.location ? inv.location.icon + ' ' + inv.location.name : 'Senza locazione'}: ${inv.quantity} pz${inv.expiry_date ? ' (Scad: ' + formatDate(inv.expiry_date) + ')' : ''}`
        ).join('\n');

        const choice = prompt(`Questo prodotto ha più inventory:\n\n${inventoryList}\n\nQuale vuoi modificare? (Inserisci il numero)`);
        
        if (!choice || isNaN(choice) || choice < 1 || choice > product.inventory.length) {
            return;
        }

        const selectedInv = product.inventory[parseInt(choice) - 1];
        openEditForm(product, selectedInv);
    } else {
        // Un solo inventory
        openEditForm(product, product.inventory[0]);
    }
}

function openEditForm(product, inventory) {
    editingProductId = product.id;
    document.querySelector('#add-tab h2').textContent = 'Modifica Prodotto';

    eanInput.value = product.ean || '';
    productNameInput.value = product.name;
    productCategorySelect.value = product.category_id;
    productLocationSelect.value = inventory.location_id;
    quantityInput.value = inventory.quantity;
    expiryDateInput.value = inventory.expiry_date || '';

    switchTab('add');
}

// FUNZIONE SPOSTA: Con validazione quantità e refresh immediato
export function moveProduct(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product || product.inventory.length === 0) return;

    const modalHTML = `
        <div id="move-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <span class="close" onclick="document.getElementById('move-modal').remove()">&times;</span>
                <h2>Sposta: ${escapeHtml(product.name)}</h2>
                <form id="move-form">
                    <div class="form-group">
                        <label>Da quale locazione?</label>
                        <select id="move-from-location" required>
                            <option value="">Seleziona locazione di partenza</option>
                            ${product.inventory.map(inv => 
                                inv.location ? `<option value="${inv.id}" data-qty="${inv.quantity}">${escapeHtml(inv.location.icon)} ${escapeHtml(inv.location.name)} (${inv.quantity} pz disponibili)</option>` : ''
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quanti pezzi spostare? <span id="max-qty-label"></span></label>
                        <input type="number" id="move-quantity" min="1" required>
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

    const fromSelect = document.getElementById('move-from-location');
    const qtyInput = document.getElementById('move-quantity');
    const maxQtyLabel = document.getElementById('max-qty-label');

    // Aggiorna il max quando cambia la locazione di partenza
    fromSelect.addEventListener('change', () => {
        const selectedOption = fromSelect.options[fromSelect.selectedIndex];
        const maxQty = selectedOption.dataset.qty;
        if (maxQty) {
            qtyInput.max = maxQty;
            qtyInput.value = Math.min(qtyInput.value || 1, maxQty);
            maxQtyLabel.textContent = `(Max: ${maxQty})`;
        }
    });

    document.getElementById('move-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const fromInventoryId = fromSelect.value;
        const moveQty = parseInt(qtyInput.value);
        const toLocationId = document.getElementById('move-to-location').value;

        const fromInventory = product.inventory.find(inv => inv.id === fromInventoryId);

        // VALIDAZIONE QUANTITÀ
        if (!fromInventory || moveQty > fromInventory.quantity) {
            alert(`Quantità non valida! Hai solo ${fromInventory.quantity} pezzi disponibili.`);
            return;
        }

        if (fromInventory.location_id === toLocationId) {
            alert('Non puoi spostare nella stessa locazione!');
            return;
        }

        try {
            showLoading();

            // 1. Riduci quantità nella locazione di partenza
            if (moveQty === fromInventory.quantity) {
                await supabaseClient
                    .from('inventory')
                    .delete()
                    .eq('id', fromInventoryId);
            } else {
                await supabaseClient
                    .from('inventory')
                    .update({ quantity: fromInventory.quantity - moveQty })
                    .eq('id', fromInventoryId);
            }

            // 2. Aggiungi/crea nella locazione di destinazione
            const existingInv = product.inventory.find(inv => inv.location_id === toLocationId);

            if (existingInv) {
                await supabaseClient
                    .from('inventory')
                    .update({ quantity: existingInv.quantity + moveQty })
                    .eq('id', existingInv.id);
            } else {
                await supabaseClient
                    .from('inventory')
                    .insert([{
                        product_id: product.id,
                        quantity: moveQty,
                        expiry_date: fromInventory.expiry_date,
                        location_id: toLocationId
                    }]);
            }

            // 3. RICARICA I DATI IMMEDIATAMENTE
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
