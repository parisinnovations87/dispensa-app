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
const scanBarcodeBtn = document.getElementById('scan-barcode-btn');
const stopScannerBtn = document.getElementById('stop-scanner-btn');
const barcodeScannerContainer = document.getElementById('barcode-scanner-container');
const nameDropdownContainer = document.getElementById('name-dropdown-container');
const nameSelector = document.getElementById('name-selector');

// Variabile per gestire la modalità modifica
let editingProductId = null;
let editingInventoryId = null; // NUOVO: Traccia quale specifico lotto stiamo modificando

// Barcode Scanner Instance
let html5QrcodeScanner = null;

// Variabili per gestire i nomi custom e originali
let currentOriginalName = '';
let currentCustomName = '';

// Initialize
export function initializeProducts() {
    addProductForm.addEventListener('submit', handleAddProduct);
    fetchEanBtn.addEventListener('click', fetchProductFromEAN);
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
    locationFilter.addEventListener('change', filterProducts);

    // Auto-select category when product name matches an existing product
    productNameInput.addEventListener('blur', checkExistingProductByName);

    // Barcode Scanner
    scanBarcodeBtn.addEventListener('click', startScanner);
    stopScannerBtn.addEventListener('click', stopScanner);

    // Name selector change
    nameSelector.addEventListener('change', handleNameSelection);

    // Recurring Product Checkbox
    const isRecurringCheckbox = document.getElementById('is-recurring');
    const minThresholdGroup = document.getElementById('min-threshold-group');
    if (isRecurringCheckbox) {
        isRecurringCheckbox.addEventListener('change', () => {
            minThresholdGroup.style.display = isRecurringCheckbox.checked ? 'block' : 'none';
        });
    }

    // Recurring Search
    const recurringSearchInput = document.getElementById('recurring-search-input');
    if (recurringSearchInput) {
        recurringSearchInput.addEventListener('input', () => renderRecurringProducts());
    }
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
                        location:locations(id, name)
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
        renderRecurringProducts(); // Initial render for recurring tab

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
                    ${product.is_recurring ? `
                        <div class="info-row" style="margin-top: 5px;">
                            <span class="expiry-badge ${totalQuantity < product.min_threshold ? 'expiry-expired' : 'expiry-ok'}">
                                🔄 Ricorrente (Min: ${product.min_threshold})
                            </span>
                        </div>
                    ` : ''}
                </div>

                <div class="product-actions">
                    <button class="btn btn-secondary btn-small" onclick="editProduct('${product.id}')">Modifica Prodotto</button>
                    <button class="btn btn-primary btn-small" onclick="showProductInventoryModal('${product.id}')">Dettagli Inventario</button>
                    <button class="btn btn-danger btn-small" onclick="deleteProduct('${product.id}')">Elimina Tutto</button>
                </div>
            </div>
        `;
    }).join('');
}

// Render Recurring Products List
export function renderRecurringProducts() {
    const tableBody = document.getElementById('recurring-table-body');
    const searchInput = document.getElementById('recurring-search-input');

    if (!tableBody) return;

    let recurringProducts = getProducts().filter(p => p.is_recurring);

    // Apply search filter
    if (searchInput && searchInput.value) {
        const term = searchInput.value.toLowerCase();
        recurringProducts = recurringProducts.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.ean && p.ean.includes(term))
        );
    }

    // Sort: Low stock first
    recurringProducts.sort((a, b) => {
        const qtyA = a.inventory.reduce((sum, i) => sum + i.quantity, 0);
        const qtyB = b.inventory.reduce((sum, i) => sum + i.quantity, 0);

        // Prioritize items with 0 stock
        if (qtyA === 0 && qtyB > 0) return -1;
        if (qtyB === 0 && qtyA > 0) return 1;

        // Then prioritize items below threshold
        const gapA = qtyA - a.min_threshold;
        const gapB = qtyB - b.min_threshold;

        return gapA - gapB;
    });

    if (recurringProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px;">
                    ${searchInput && searchInput.value ? 'Nessun prodotto trovato' : 'Nessun prodotto ricorrente configurato'}
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = recurringProducts.map(product => {
        const currentQty = product.inventory.reduce((sum, item) => sum + item.quantity, 0);
        const minThreshold = product.min_threshold || 0;

        let statusClass = 'expiry-ok';
        let statusText = 'OK';

        if (currentQty === 0) {
            statusClass = 'expiry-expired';
            statusText = 'MANCANTE';
        } else if (currentQty < minThreshold) {
            statusClass = 'expiry-warning';
            statusText = 'AL DI SOTTO';
        }

        return `
            <tr class="expiry-row ${currentQty === 0 ? 'row-expired' : (currentQty < minThreshold ? 'row-warning' : '')}">
                <td>
                    <strong>${escapeHtml(product.name)}</strong>
                    ${product.category ? `<br><small>${escapeHtml(product.category.name)}</small>` : ''}
                </td>
                <td>${minThreshold}</td>
                <td><strong>${currentQty}</strong></td>
                <td><span class="expiry-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-primary btn-small" onclick="showProductInventoryModal('${product.id}')">Gestisci</button>
                     <button class="btn btn-secondary btn-small" onclick="editProductInventory('${product.id}', '${product.inventory[0]?.id || ''}')">Modifica</button>
                </td>
            </tr>
        `;
    }).join('');
}

// NUOVA FUNZIONE: Modale con dettagli inventory
export function showProductInventoryModal(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    const inventoryRows = product.inventory.map(inv => `
        <tr>
            <td>${inv.location ? escapeHtml(inv.location.name) : 'N/A'}</td>
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

    // Recuring Product Fields
    const isRecurring = document.getElementById('is-recurring').checked;
    const minThreshold = isRecurring ? parseInt(document.getElementById('min-threshold').value) : 0;

    // Validazione: accetta anche 0 come valore valido
    if (!name || !categoryId || !locationId) {
        alert('Compila tutti i campi obbligatori');
        return;
    }

    if (isNaN(quantity) || quantity < 0) {
        alert('La quantità deve essere un numero valido (0 o maggiore)');
        return;
    }

    if (isRecurring && (isNaN(minThreshold) || minThreshold < 0)) {
        alert('Se l\'articolo è ricorrente, devi specificare una soglia minima valida (0 o maggiore).');
        return;
    }

    // Leggi i nomi da data-attributes (più affidabile delle variabili globali)
    const originalNameFromData = productNameInput.dataset.originalName || '';
    const customNameFromData = productNameInput.dataset.customName || '';

    // DEBUG: Log per capire lo stato delle variabili
    console.log('=== SALVATAGGIO PRODOTTO ===');
    console.log('Nome inserito:', name);
    console.log('originalName da data-attribute:', originalNameFromData);
    console.log('customName da data-attribute:', customNameFromData);
    console.log('EAN:', ean);
    console.log('Recurring:', isRecurring, 'Threshold:', minThreshold);

    try {
        showLoading();

        if (editingProductId) {
            // MODIFICA PRODOTTO ESISTENTE
            const { error: productError } = await supabaseClient
                .from('products')
                .update({
                    ean: ean || null,
                    name: name,
                    category_id: categoryId,
                    is_recurring: isRecurring,
                    min_threshold: minThreshold
                })
                .eq('id', editingProductId);

            if (productError) throw productError;

            // FIX: GESTIONE MODIFICA INVENTARIO
            if (editingInventoryId) {
                // Stiamo modificando un lotto specifico
                if (quantity === 0) {
                    // Se la quantità è 0, ELIMINA il lotto
                    const { error: deleteError } = await supabaseClient
                        .from('inventory')
                        .delete()
                        .eq('id', editingInventoryId);

                    if (deleteError) throw deleteError;
                    alert('Lotto esaurito ed eliminato. Il prodotto è stato aggiornato.');
                } else {
                    // Altrimenti AGGIORNA
                    const { error: inventoryError } = await supabaseClient
                        .from('inventory')
                        .update({
                            quantity: quantity,
                            expiry_date: expiryDate,
                            location_id: locationId
                        })
                        .eq('id', editingInventoryId);

                    if (inventoryError) throw inventoryError;
                    alert('Lotto aggiornato con successo!');
                }
            } else {
                // Fallback / Aggiunta nuovo lotto
                if (quantity > 0) {
                    const { error: inventoryError } = await supabaseClient
                        .from('inventory')
                        .insert([{
                            product_id: editingProductId,
                            quantity: quantity,
                            expiry_date: expiryDate,
                            location_id: locationId
                        }]);

                    if (inventoryError) throw inventoryError;
                    alert('Prodotto aggiornato e nuovo lotto aggiunto!');
                } else {
                    alert('Prodotto aggiornato. Nessun lotto aggiunto (quantità 0).');
                }
            }

            editingProductId = null;
            editingInventoryId = null;
            document.querySelector('#add-tab h2').textContent = 'Aggiungi Nuovo Prodotto';
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

                // NUOVO: Aggiorna i nomi se necessario
                // Se abbiamo un original_name dall'API e il nome è stato modificato
                // E aggiorna anche lo stato ricorrente

                const updates = { is_recurring: isRecurring, min_threshold: minThreshold };

                if (originalNameFromData && name !== originalNameFromData) {
                    updates.original_name = originalNameFromData;
                    updates.custom_name = name;
                    updates.name = name;
                }

                await supabaseClient
                    .from('products')
                    .update(updates)
                    .eq('id', existingProduct.id);

            } else {
                // Crea nuovo prodotto
                // Determina original_name e custom_name
                let originalName = null;
                let customName = null;

                // Se abbiamo un nome dall'API (originalNameFromData è valorizzato)
                if (originalNameFromData) {
                    originalName = originalNameFromData;
                    // Se il nome corrente è diverso dall'original_name, allora è custom
                    if (name !== originalNameFromData) {
                        customName = name;
                    }
                } else {
                    // Inserimento completamente manuale (senza API)
                    // Salva il nome inserito come original_name
                    originalName = name;
                }

                // DEBUG: Log cosa stiamo per salvare
                console.log('--- Creazione nuovo prodotto ---');
                console.log('originalName da salvare:', originalName);
                console.log('customName da salvare:', customName);
                console.log('name da salvare:', name);

                const { data: productData, error: productError } = await supabaseClient
                    .from('products')
                    .insert([{
                        user_id: getCurrentUser().id,
                        ean: ean || null,
                        name: name,
                        category_id: categoryId,
                        original_name: originalName,
                        custom_name: customName,
                        is_recurring: isRecurring,
                        min_threshold: minThreshold
                    }])
                    .select();

                if (productError) throw productError;
                productId = productData[0].id;
            }

            // Controlla se esiste già inventory con stessa locazione e scadenza
            if (quantity > 0) {
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
            } else {
                alert('Prodotto creato con quantità 0 (nessun lotto aggiunto).');
            }
        }

        addProductForm.reset();
        hideNameDropdown();
        // Reset data attributes
        productNameInput.dataset.originalName = '';
        productNameInput.dataset.customName = '';
        // Reset recurring fields
        document.getElementById('is-recurring').checked = false;
        document.getElementById('min-threshold-group').style.display = 'none';

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
    // Nota: inventoryId potrebbe essere vuoto se chiamato dalla tabella recurring per un prodotto con 0 quantità
    const inventory = inventoryId ? product?.inventory.find(inv => inv.id === inventoryId) : null;

    if (!product) return;

    editingProductId = productId;
    editingInventoryId = inventoryId || null; // Imposta null se stiamo creando un nuovo lotto (o modificando solo il prodotto)
    document.querySelector('#add-tab h2').textContent = inventory ? 'Modifica Lotto' : 'Modifica Prodotto';

    eanInput.value = product.ean || '';
    productNameInput.value = product.name;
    productCategorySelect.value = product.category_id;

    // Recurring fields
    const isRecurringCheckbox = document.getElementById('is-recurring');
    const minThresholdGroup = document.getElementById('min-threshold-group');
    const minThresholdInput = document.getElementById('min-threshold');

    isRecurringCheckbox.checked = product.is_recurring || false;
    minThresholdInput.value = product.min_threshold || 1;
    minThresholdGroup.style.display = isRecurringCheckbox.checked ? 'block' : 'none';

    if (inventory) {
        productLocationSelect.value = inventory.location_id;
        quantityInput.value = inventory.quantity;
        expiryDateInput.value = inventory.expiry_date || '';
    } else {
        // Valori di default se stiamo modificando un prodotto senza inventory o con inventory vuoto
        quantityInput.value = 1;
        expiryDateInput.value = '';
        // Se possibile, seleziona la prima location disponibile
        if (productLocationSelect.options.length > 1) {
            productLocationSelect.selectedIndex = 1;
        }
    }

    const inventoryModal = document.getElementById('inventory-modal');
    if (inventoryModal) inventoryModal.remove();

    switchTab('add');
}

// Modifica un prodotto (metadati: nome, categoria, ricorrente, soglia)
export function editProduct(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    editingProductId = productId;
    editingInventoryId = null; // Non stiamo modificando un lotto specifico
    document.querySelector('#add-tab h2').textContent = 'Modifica Prodotto';

    // Popola i campi del prodotto
    eanInput.value = product.ean || '';
    productNameInput.value = product.name;
    productCategorySelect.value = product.category_id;

    // Recurring fields
    const isRecurringCheckbox = document.getElementById('is-recurring');
    const minThresholdGroup = document.getElementById('min-threshold-group');
    const minThresholdInput = document.getElementById('min-threshold');

    isRecurringCheckbox.checked = product.is_recurring || false;
    minThresholdInput.value = product.min_threshold || 1;
    minThresholdGroup.style.display = isRecurringCheckbox.checked ? 'block' : 'none';

    // Per la modifica del prodotto senza specificare inventory, mettiamo valori di default
    // L'utente può aggiungere un nuovo lotto se vuole, oppure semplicemente salvare le modifiche al prodotto
    quantityInput.value = 0; // Default a 0 (non aggiungerà inventory)
    expiryDateInput.value = '';

    // Seleziona la prima location disponibile come placeholder
    if (productLocationSelect.options.length > 1) {
        productLocationSelect.selectedIndex = 1;
    }

    switchTab('add');
}

// Expose globally
window.editProduct = editProduct;

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
                <p><strong>Da:</strong> ${inventory.location ? escapeHtml(inventory.location.name) : 'N/A'} (${inventory.quantity} pz disponibili)</p>
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
        `<option value="${loc.id}">${escapeHtml(loc.name)}</option>`
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
    const product = getProducts().find(p => p.id === productId);
    if (!product) return;

    // PROTECTION FOR RECURRING PRODUCTS
    if (product.is_recurring) {
        if (!confirm(`Questo è un prodotto RICORRENTE.\nVuoi azzerare le quantità in dispensa?\n(Il prodotto rimarrà nella lista dei ricorrenti)`)) {
            return;
        }

        try {
            showLoading();
            // Delete only inventory
            const { error } = await supabaseClient
                .from('inventory')
                .delete()
                .eq('product_id', productId);

            if (error) throw error;

            await loadProducts();
            hideLoading();
            alert('Quantità azzerate. Il prodotto è ancora nella lista Ricorrenti.');
        } catch (error) {
            console.error('Errore azzeramento prodotto ricorrente:', error);
            alert('Errore: ' + error.message);
            hideLoading();
        }
        return;
    }

    // STANDARD DELETION
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
        const locationInfo = item.location ? ` - ${item.location.name}` : '';
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

        // Prima controlla se abbiamo già questo prodotto localmente
        const existingProduct = getProducts().find(p => p.ean === ean);

        if (existingProduct) {
            // Prodotto già esistente nel nostro database
            if (existingProduct.category_id) {
                productCategorySelect.value = existingProduct.category_id;
            }

            // IMPORTANTE: Salva in data-attributes
            productNameInput.dataset.originalName = existingProduct.original_name || existingProduct.name;
            productNameInput.dataset.customName = existingProduct.custom_name || '';

            // Mostra dropdown se ci sono custom_name e/o original_name
            if (existingProduct.custom_name || existingProduct.original_name) {
                showNameDropdown(existingProduct.custom_name, existingProduct.original_name);
            } else {
                // Nessun nome custom/original, usa solo il nome normale  
                productNameInput.value = existingProduct.name;
                hideNameDropdown();
            }

            hideLoading();
            fetchEanBtn.disabled = false;
            fetchEanBtn.textContent = 'Cerca';
            alert(`Prodotto già presente: ${existingProduct.name}. Categoria pre-selezionata.`);
            return;
        }

        // Se non trovato localmente, cerca su Open Food Facts
        const response = await fetch(`${OPENFOODFACTS_API}/${ean}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            const productName = data.product.product_name || data.product.product_name_it || '';

            if (productName) {
                productNameInput.value = productName;
                // Salva come data-attribute per riferimento futuro (più affidabile)
                productNameInput.dataset.originalName = productName;
                productNameInput.dataset.customName = '';

                // DEBUG: Log quando impostiamo original name dall'API
                console.log('=== FETCH da API ===');
                console.log('Nome recuperato dall\'API:', productName);
                console.log('Salvato in data-attribute originalName:', productNameInput.dataset.originalName);

                hideNameDropdown();
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


// Check for existing product by name and pre-select category
function checkExistingProductByName() {
    const name = productNameInput.value.trim().toLowerCase();

    if (!name || name.length < 2) return;

    // Cerca un prodotto con lo stesso nome (case insensitive)
    const existingProduct = getProducts().find(p =>
        p.name.toLowerCase() === name
    );

    if (existingProduct && existingProduct.category_id) {
        // Solo se la categoria non è già stata selezionata manualmente
        if (!productCategorySelect.value) {
            productCategorySelect.value = existingProduct.category_id;
        }
    }
}

// ===== BARCODE SCANNER FUNCTIONS =====

// Start Barcode Scanner
function startScanner() {
    if (html5QrcodeScanner) {
        alert('Lo scanner è già attivo!');
        return;
    }

    barcodeScannerContainer.style.display = 'block';
    scanBarcodeBtn.disabled = true;

    html5QrcodeScanner = new Html5Qrcode("barcode-reader");

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, // Use back camera on mobile
        config,
        onScanSuccess,
        onScanError
    ).catch((err) => {
        console.error('Errore avvio scanner:', err);
        alert('Impossibile avviare lo scanner. Verifica i permessi della fotocamera.');
        stopScanner();
    });
}

// Stop Barcode Scanner
function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
            barcodeScannerContainer.style.display = 'none';
            scanBarcodeBtn.disabled = false;
        }).catch((err) => {
            console.error('Errore chiusura scanner:', err);
            html5QrcodeScanner = null;
            barcodeScannerContainer.style.display = 'none';
            scanBarcodeBtn.disabled = false;
        });
    }
}

// On Scan Success
function onScanSuccess(decodedText, decodedResult) {
    console.log(`Barcode scansionato: ${decodedText}`);

    // Set EAN input
    eanInput.value = decodedText;

    // Stop scanner
    stopScanner();

    // Fetch product info
    fetchProductFromEAN();
}

// On Scan Error (silent)
function onScanError(errorMessage) {
    // Non mostrare errori continui di scansione
}

// ===== CUSTOM NAMES FUNCTIONS =====

// Show Name Dropdown with custom and original names
function showNameDropdown(customName, originalName) {
    // Salva in data-attributes invece che in variabili globali
    productNameInput.dataset.customName = customName || '';
    productNameInput.dataset.originalName = originalName || '';

    if (!customName && !originalName) {
        nameDropdownContainer.style.display = 'none';
        return;
    }

    // Update the select options
    nameSelector.innerHTML = '';

    if (customName) {
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = `Personalizzato: ${customName}`;
        nameSelector.appendChild(customOption);
    }

    if (originalName) {
        const originalOption = document.createElement('option');
        originalOption.value = 'original';
        originalOption.textContent = `Originale: ${originalName}`;
        nameSelector.appendChild(originalOption);
    }

    // Select custom by default if exists
    nameSelector.value = customName ? 'custom' : 'original';

    // Set the input value
    productNameInput.value = customName || originalName;

    nameDropdownContainer.style.display = 'block';
}

// Handle Name Selection Change
function handleNameSelection() {
    const selected = nameSelector.value;
    const customName = productNameInput.dataset.customName;
    const originalName = productNameInput.dataset.originalName;

    if (selected === 'custom' && customName) {
        productNameInput.value = customName;
    } else if (selected === 'original' && originalName) {
        productNameInput.value = originalName;
    }
}

// Hide Name Dropdown
function hideNameDropdown() {
    console.log('!!! hideNameDropdown chiamato');
    // IMPORTANTE: NON cancellare i data-attributes, servono per il salvataggio!
    // Solo nascondi l'UI
    nameDropdownContainer.style.display = 'none';
}
