// expiry.js - Gestione Tab Scadenze

import { getProducts } from './state.js';
import { escapeHtml, formatDate, getExpiryClass } from './utils.js';
import { moveProductInventory, deleteInventory } from './products.js';

const expiryTable = document.getElementById('expiry-table-body');
const expiryAlerts = document.getElementById('expiry-alerts');

// Variabile per ordinamento
let currentSort = { column: 'expiry', direction: 'asc' };

// Initialize
export function initializeExpiry() {
    // Setup event listeners per header cliccabili
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            handleSort(column);
        });
    });
}

// Render Expiry Table
export function renderExpiryTable() {
    const products = getProducts();

    // Espandi tutti gli inventory in una lista piatta
    const flatInventory = [];
    products.forEach(product => {
        product.inventory.forEach(inv => {
            flatInventory.push({
                productId: product.id,
                productName: product.name,
                productEan: product.ean,
                category: product.category,
                inventoryId: inv.id,
                location: inv.location,
                quantity: inv.quantity,
                expiryDate: inv.expiry_date,
                expiryTimestamp: inv.expiry_date ? new Date(inv.expiry_date).getTime() : Infinity
            });
        });
    });

    // Ordina
    const sorted = sortInventory(flatInventory);

    // Calcola alerts
    renderAlerts(flatInventory);

    // Render tabella
    if (sorted.length === 0) {
        expiryTable.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div class="empty-state-icon">📅</div>
                    <p>Nessun prodotto nell'inventario</p>
                </td>
            </tr>
        `;
        return;
    }

    expiryTable.innerHTML = sorted.map(item => {
        const expiryStatus = getExpiryStatus(item.expiryDate);
        const expiryDisplay = item.expiryDate ?
            `<span class="${getExpiryClass(item.expiryDate)}">${formatDate(item.expiryDate)}</span>` :
            '<span class="expiry-badge">Nessuna</span>';

        return `
            <tr class="expiry-row ${expiryStatus.className}">
                <td>
                    <strong>${escapeHtml(item.productName)}</strong>
                    ${item.productEan ? `<br><small>EAN: ${item.productEan}</small>` : ''}
                </td>
                <td>${item.category ? escapeHtml(item.category.name) : '-'}</td>
                <td>${item.location ? escapeHtml(item.location.name) : '-'}</td>
                <td><strong>${item.quantity} pz</strong></td>
                <td>${expiryDisplay}</td>
                <td>
                    <span class="status-badge status-${expiryStatus.status}">${expiryStatus.label}</span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-info btn-tiny" onclick="moveProductInventory('${item.productId}', '${item.inventoryId}')" title="Sposta">
                        ↔️
                    </button>
                    <button class="btn btn-danger btn-tiny" onclick="deleteInventory('${item.inventoryId}')" title="Elimina">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Calcola stato scadenza
function getExpiryStatus(expiryDateString) {
    if (!expiryDateString) {
        return { status: 'none', label: '⚪ Nessuna', className: '' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(expiryDateString);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { status: 'expired', label: '🔴 SCADUTO', className: 'row-expired' };
    } else if (diffDays === 0) {
        return { status: 'today', label: '🔴 OGGI', className: 'row-urgent' };
    } else if (diffDays <= 3) {
        return { status: 'urgent', label: '🟠 URGENTE', className: 'row-urgent' };
    } else if (diffDays <= 7) {
        return { status: 'warning', label: '🟡 Attenzione', className: 'row-warning' };
    } else {
        return { status: 'ok', label: '🟢 OK', className: '' };
    }
}

// Render Alerts
function renderAlerts(inventory) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expired = 0;
    let expireToday = 0;
    let expireIn3Days = 0;

    inventory.forEach(item => {
        if (!item.expiryDate) return;

        const expiryDate = new Date(item.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) expired++;
        else if (diffDays === 0) expireToday++;
        else if (diffDays <= 3) expireIn3Days++;
    });

    if (expired === 0 && expireToday === 0 && expireIn3Days === 0) {
        expiryAlerts.innerHTML = `
            <div class="alert alert-success">
                ✅ Tutto OK! Nessun prodotto in scadenza nei prossimi 3 giorni
            </div>
        `;
        return;
    }

    let alerts = [];
    if (expired > 0) {
        alerts.push(`<div class="alert alert-danger">⚠️ <strong>${expired}</strong> ${expired === 1 ? 'prodotto scaduto' : 'prodotti scaduti'}</div>`);
    }
    if (expireToday > 0) {
        alerts.push(`<div class="alert alert-danger">🔴 <strong>${expireToday}</strong> ${expireToday === 1 ? 'prodotto scade' : 'prodotti scadono'} OGGI</div>`);
    }
    if (expireIn3Days > 0) {
        alerts.push(`<div class="alert alert-warning">🟠 <strong>${expireIn3Days}</strong> ${expireIn3Days === 1 ? 'prodotto scade' : 'prodotti scadono'} entro 3 giorni</div>`);
    }

    expiryAlerts.innerHTML = alerts.join('');
}

// Sorting
function sortInventory(inventory) {
    return [...inventory].sort((a, b) => {
        let compareA, compareB;

        switch (currentSort.column) {
            case 'product':
                compareA = a.productName.toLowerCase();
                compareB = b.productName.toLowerCase();
                break;
            case 'category':
                compareA = a.category?.name.toLowerCase() || '';
                compareB = b.category?.name.toLowerCase() || '';
                break;
            case 'location':
                compareA = a.location?.name.toLowerCase() || '';
                compareB = b.location?.name.toLowerCase() || '';
                break;
            case 'quantity':
                compareA = a.quantity;
                compareB = b.quantity;
                break;
            case 'expiry':
                compareA = a.expiryTimestamp;
                compareB = b.expiryTimestamp;
                break;
            default:
                return 0;
        }

        if (compareA < compareB) return currentSort.direction === 'asc' ? -1 : 1;
        if (compareA > compareB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// Handle Sort
function handleSort(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    // Aggiorna le icone
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sort === column) {
            header.classList.add(`sort-${currentSort.direction}`);
        }
    });

    renderExpiryTable();
}
