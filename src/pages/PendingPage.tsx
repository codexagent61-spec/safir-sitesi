import { useAuth } from '../context/AuthContext'

export default function PendingPage({ variant }: { variant: 'pending' | 'profile-missing' }) {
  const { session, signOut, refreshProfile } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md text-center">
        <div className="text-5xl" aria-hidden>
          ⏳
        </div>
        <h1 className="mt-3 text-xl font-bold">
          {variant === 'pending' ? 'Hesabınız Onay Bekliyor' : 'Profil Bulunamadı'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {variant === 'pending' ? (
            <>
              <strong>{session?.user.email}</strong> hesabınız oluşturuldu. Site Yöneticisi size bir
              rol atadığında panele erişebileceksiniz. Yöneticinize haber verebilirsiniz.
            </>
          ) : (
            'Hesabınıza ait profil kaydı bulunamadı. Veritabanı kurulumu yeni yapıldıysa aşağıdan yeniden deneyin; sorun sürerse yöneticinize başvurun.'
          )}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" className="btn btn-primary" onClick={() => void refreshProfile()}>
            🔄 Yeniden Kontrol Et
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  )
}
