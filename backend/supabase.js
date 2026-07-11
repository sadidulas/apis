const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kqroiwwpmglqxodunyse.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_m3FQBS_YuFyYqOlDZCs56A_uscpxlIb';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

// Use service key for backend operations (higher privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function initTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.models (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      system_prompt TEXT DEFAULT '',
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.model_apis (
      id BIGSERIAL PRIMARY KEY,
      model_id BIGINT REFERENCES public.models(id) ON DELETE CASCADE,
      provider TEXT DEFAULT 'custom',
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_id_provider TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.api_keys (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
      active BOOLEAN DEFAULT TRUE,
      last_used TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.admin_users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.usage_logs (
      id BIGSERIAL PRIMARY KEY,
      model_id BIGINT REFERENCES public.models(id),
      model_api_id BIGINT,
      api_key_id BIGINT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      endpoint TEXT,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Execute via REST API (raw SQL)
  let rpcResult;
  try {
    rpcResult = await supabase.rpc('exec_sql', { query: sql });
  } catch (e) {
    console.log('Supabase: trying direct table creation...');
    rpcResult = { error: null };
  }
  const { error } = rpcResult;

  if (error) {
    console.log('Supabase: Tables may already exist or need manual setup:', error.message);
  } else {
    console.log('Supabase: Tables initialized');
  }

  // Seed default admin if not exists
  let existingAdmin;
  try {
    const result = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', 'admin')
      .single();
    existingAdmin = result.data;
  } catch (e) {
    existingAdmin = null;
  }

  if (!existingAdmin) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'sadidulmehal').digest('hex');
    await supabase.from('admin_users').insert({ username: 'admin', password_hash: hash });
    console.log('Supabase: Default admin created');
  }
}

// ─── Database binary backup (save/restore entire SQLite file) ────────────────

async function backupDatabase() {
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, 'free-api.db');
  try {
    if (!fs.existsSync(dbPath)) return;
    const buffer = fs.readFileSync(dbPath);
    const base64 = buffer.toString('base64');
    // Upsert into app_state table
    const { data: existing } = await supabase
      .from('app_state')
      .select('key')
      .eq('key', 'sqlite_backup')
      .single();
    if (existing) {
      await supabase.from('app_state')
        .update({ value: base64, updated_at: new Date().toISOString() })
        .eq('key', 'sqlite_backup');
    } else {
      await supabase.from('app_state')
        .insert({ key: 'sqlite_backup', value: base64 });
    }
    console.log('DB backed up to Supabase');
  } catch (e) {
    console.log('Supabase backup failed (non-critical):', e.message.substring(0, 80));
  }
}

async function restoreDatabase() {
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, 'free-api.db');
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', 'sqlite_backup')
      .single();
    if (error || !data) {
      console.log('No Supabase backup found');
      return false;
    }
    const buffer = Buffer.from(data.value, 'base64');
    fs.writeFileSync(dbPath, buffer);
    console.log('DB restored from Supabase backup');
    return true;
  } catch (e) {
    console.log('Supabase restore failed:', e.message.substring(0, 80));
    return false;
  }
}

module.exports = { supabase, initTables, backupDatabase, restoreDatabase, SUPABASE_URL };
