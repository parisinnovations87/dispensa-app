// app.js - Logica principale dell'applicazione

// State Management
let currentUser = null;
let categories = [];
let products = [];

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const loading = document.getElementById('loading');

// Tab Management
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Forms
const addProductForm = document.getElementById('add-product-form');
const categoryForm = document.getElementById('category-form');
const categoryModal = document.getElementById('category-modal');
const addCategoryBtn = document.getElementById('add-category-btn');
const quickAddCategoryBtn = document.getElementById('quick-add-category');
const closeModalBtn = document.querySelector('.close');

// Product Form Elements
const eanInput = document.getElementById('ean-input');
const fetchEanBtn = document.getElementById('fetch-ean-btn');
const productNameInput = document.getElementById('product-name');
const productCategorySelect = document.getElementById('product-category');
const quantityInput = document.getElementById('quantity');
const expiryDateInput = document.getElementById('expiry-date');

// Lists
const productsList = document.getElementById('products-list');
const categoriesList = document.getElementById('categories-list');
const categoryFilter = document.getElementById('category-filter');
const searchInput = document.getElementById('search-input');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupEventListeners();
});

// ============= AUTHENTICATION =============

async function initAuth() {
    try {
        // Controlla se l'utente è già loggato
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            handleAuthSuccess(session.user);
        }

        // Listener per cambiamenti di autenticazione
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                handleAuthSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                handleSignOut();
            }
        });
    } catch (error) {
        console.error('Errore inizializzazione auth:', error);
    }
}

async function handleGoogleLogin() {
    try {
        showLoading();
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;
    } catch (error) {
        console.error('Errore login:', error);
        alert('Errore durante il login: ' + error.message);
        hideLoading();
    }
}

async function handleAuthSuccess(user) {
    currentUser = user;
    
    // Aggiorna UI
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    
    if (user.user_metadata && user.user_metadata.avatar_url) {
        userAvatar.src = user.user_metadata.avatar_url;
    }
    userName.textContent = (user.user_metadata && user.user_metadata.full_name) || user.email;

    // Carica i dati
    await loadCategories();
    await loadProducts();
    
    hideLoading();
}

async function handleSignOut() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        categories = [];
        products = [];
        
        loginSection.style.display = 'block';
        appSection.style.display = 'none';
    } catch (error) {
        console.error('Errore logout:', error);
        alert('Errore durante il logout');
    }
}

// ============= EVENT LISTENERS =============

function setupEventListeners() {
    // Auth
    loginButton.addEventListener('click', handleGoogleLogin);
    logoutButton.addEventListener('click', handleSignOut);

    // Tabs
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // Modal
    addCategoryBtn.addEventListener('click', () => openCategoryModal());
    quickAddCategoryBtn.addEventListener('click', () => openCategoryModal());
    closeModalBtn.addEventListener('click', () => closeCategoryModal());
    window.addEventListener('click', (e) => {
        if (e.target === categoryModal) closeCategoryModal();
    });

    // Forms
    addProductForm.addEventListener('submit', handleAddProduct);
    categoryForm.addEventListener('submit', handleAddCategory);
    fetchEanBtn.addEventListener('click', fetchProductFromEAN);

    // Search & Filter
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
}

function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ============= CATEGORIES =============

async function loadCategories() {
    try {
        showLoading();
        const { data, error } = await supabaseClient
            .from('categories')
            .select('*')
            .order('name');

        if (error) throw error;

        categories = data || [];
        renderCategories();
        updateCategorySelects();
        hideLoading();
    } catch (error) {
        console.error('Errore caricamento categorie:', error);
        alert('Errore nel caricamento delle categorie: ' + error.message);
        hideLoading();
    }
}

function renderCategories() {
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

function updateCategorySelects() {
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
                user_id: currentUser.id,
                name: name 
            }])
            .select();

        if (error) throw error;

        categories.push(data[0]);
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

async function deleteCategory(categoryId) {
    if (!confirm('Sei sicuro di voler eliminare questa categoria?')) return;

    try {
        showLoading();
        const { error } = await supabaseClient
            .from('categories')
            .delete()
            .eq('id', categoryId);

        if (error) throw error;

        categories = categories.filter(c => c.id !== categoryId);
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

function openCategoryModal() {
    categoryModal.style.display = 'block';
    document.getElementById('category-name').focus();
}

function closeCategoryModal() {
    categoryModal.style.display = 'none';
    categoryForm.reset();
}

// ============= PRODUCTS =============

async function loadProducts() {
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
                    .select('*')
                    .eq('product_id', product.id);

                if (inventoryError) throw inventoryError;

                return {
                    ...product,
                    inventory: inventoryData || []
                };
            })
        );

        products = productsWithInventory;
        renderProducts();
        hideLoading();
    } catch (error) {
        console.error('Errore caricamento prodotti:', error);
        alert('Errore nel caricamento dei prodotti: ' + error.message);
        hideLoading();
    }
}

function renderProducts(filteredProducts = null) {
    const productsToRender = filteredProducts || products;

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

function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    const filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                            (product.ean && product.ean.includes(searchTerm));
        const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
        
        return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
}

async function handleAddProduct(e) {
    e.preventDefault();

    const ean = eanInput.value.trim();
    const name = productNameInput.value.trim();
    const categoryId = productCategorySelect.value;
    const quantity = parseInt(quantityInput.value);
    const expiryDate = expiryDateInput.value || null;

    if (!name || !categoryId || !quantity) {
        alert('Compila tutti i campi obbligatori');
        return;
    }

    try {
        showLoading();

        // Inserisci il prodotto
        const { data: productData, error: productError } = await supabaseClient
            .from('products')
            .insert([{
                user_id: currentUser.id,
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
                expiry_date: expiryDate
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

async function deleteProduct(productId) {
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

function viewProductDetails(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const inventoryDetails = product.inventory.map(item => 
        `Quantità: ${item.quantity}${item.expiry_date ? `, Scadenza: ${formatDate(item.expiry_date)}` : ''}`
    ).join('\n');

    alert(`
Prodotto: ${product.name}
${product.ean ? `EAN: ${product.ean}` : ''}
Categoria: ${product.category ? product.category.name : 'Nessuna'}

Inventario:
${inventoryDetails || 'Nessun inventario'}
    `);
}

// ============= OPEN FOOD FACTS API =============

async function fetchProductFromEAN() {
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

// ============= UTILITY FUNCTIONS =============

function showLoading() {
    loading.style.display = 'flex';
}

function hideLoading() {
    loading.style.display = 'none';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
}

function getExpiryClass(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expiry-badge expiry-expired';
    if (diffDays <= 7) return 'expiry-badge expiry-warning';
    return 'expiry-badge expiry-ok';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
