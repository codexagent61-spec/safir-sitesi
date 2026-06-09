// Supabase veritabanına supabase/migration.sql betiğini uygular.
// Kullanım (PowerShell):
//   $env:DATABASE_URL = "postgresql://postgres:SIFRENIZ@db.erlmkdaqnmyanajxacwg.supabase.co:5432/postgres"
//   npm run db:apply
// Alternatif: betiği Supabase Dashboard > SQL Editor'e yapıştırıp Run deyin.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('HATA: DATABASE_URL ortam değişkeni tanımlı değil.')
  console.error('Örnek: postgresql://postgres:SIFRE@db.<proje>.supabase.co:5432/postgres')
  process.exit(1)
}

const sqlPath = fileURLToPath(new URL('../supabase/migration.sql', import.meta.url))
const sql = readFileSync(sqlPath, 'utf8')

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
  await client.query(sql)
  console.log('✅ Veritabanı kurulumu tamamlandı.')
} catch (err) {
  console.error('❌ Kurulum hatası:', err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
