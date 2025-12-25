// config.js - Configurazione Supabase
// IMPORTANTE: Sostituisci questi valori con quelli del tuo progetto Supabase
// Li trovi su: https://app.supabase.com/project/_/settings/api

const SUPABASE_URL = 'https://gujkegfwwdgjrzwlmooz.supabase.co'; // es: 'https://xyzcompany.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1amtlZ2Z3d2RnanJ6d2xtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTA1MTAsImV4cCI6MjA4MjI2NjUxMH0.AElv-PVzm_PP96PQ0fsUBYbkbj5G_RKNZ3aPjycXTyA'; // La chiave anon/public

// Inizializza il client Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configurazione Open Food Facts API
const OPENFOODFACTS_API = 'https://world.openfoodfacts.org/api/v0/product';