// state.js - Gestione centralizzata dello stato dell'applicazione

export const state = {
    currentUser: null,
    categories: [],
    locations: [],
    products: []
};

// Getter per accesso allo state
export function getCurrentUser() {
    return state.currentUser;
}

export function setCurrentUser(user) {
    state.currentUser = user;
}

export function getCategories() {
    return state.categories;
}

export function setCategories(categories) {
    state.categories = categories;
}

export function getLocations() {
    return state.locations;
}

export function setLocations(locations) {
    state.locations = locations;
}

export function getProducts() {
    return state.products;
}

export function setProducts(products) {
    state.products = products;
}

// Helper per resettare tutto lo state (utile per logout)
export function resetState() {
    state.currentUser = null;
    state.categories = [];
    state.locations = [];
    state.products = [];
}
