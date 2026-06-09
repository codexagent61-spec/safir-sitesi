import { useAuth } from '../context/AuthContext'
import { SUPABASE_URL } from '../lib/supabase'

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]

/** Veritabanı şeması henüz kurulmamışsa gösterilen yönlendirme ekranı. */
export default function SetupPage() {
  const { signOut, refreshProfile } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-xl">
        <h1 className="text-xl font-bold">🛠️ Veritabanı Kurulumu Gerekli</h1>
        <p className="mt-2 text-sm text-slate-600">
          Uygulama çalışıyor ancak Supabase veritabanında tablolar henüz oluşturulmamış. Tek seferlik
          kurulum için:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Projedeki <code className="rounded bg-slate-100 px-1">supabase/migration.sql</code>{' '}
            dosyasının içeriğini kopyalayın.
          </li>
          <li>
            <a
              className="text-sky-700 underline"
              href={`https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`}
              target="_blank"
              rel="noreferrer"
            >
              Supabase SQL Editor
            </a>{' '}
            sayfasını açın, yapıştırın ve <strong>Run</strong> düğmesine basın.
          </li>
          <li>Bu sayfaya dönüp “Yeniden Dene”ye tıklayın.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => void refreshProfile()}>
            🔄 Yeniden Dene
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  )
}
