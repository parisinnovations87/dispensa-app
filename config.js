// config.js - Configurazione Supabase

const SUPABASE_URL = 'https://gujkegfwwdgjrzwlmooz.supabase.co'; // ← INSERISCI IL TUO
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1amtlZ2Z3d2RnanJ6d2xtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTA1MTAsImV4cCI6MjA4MjI2NjUxMH0.AElv-PVzm_PP96PQ0fsUBYbkbj5G_RKNZ3aPjycXTyA'; // ← INSERISCI LA TUA CHIAVE

// Inizializza il client Supabase (CORRETTA)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configurazione Open Food Facts API
const OPENFOODFACTS_API = 'https://world.openfoodfacts.org/api/v0/product';