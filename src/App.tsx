import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isFullAccess } from './lib/roles'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PendingPage from './pages/PendingPage'
import SetupPage from './pages/SetupPage'
import DashboardPage from './pages/DashboardPage'
import MuhasebePage from './pages/MuhasebePage'
import ResidentsPage from './pages/ResidentsPage'
import DuesPage from './pages/DuesPage'
import ExpensesPage from './pages/ExpensesPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-3 text-4xl" aria-hidden>
          🏢
        </div>
        <div className="text-sm font-medium text-slate-500">Yükleniyor…</div>
      </div>
    </div>
  )
}

export default function App() {
  const { session, profile, status, recovery } = useAuth()

  if (status === 'loading') return <Splash />

  if (!session) {
    return (
      <Routes>
        <Route path="/giris" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/giris" replace />} />
      </Routes>
    )
  }

  // Şifre sıfırlama bağlantısıyla gelindiyse önce yeni şifre alınır.
  if (recovery) return <ResetPasswordPage />

  if (status === 'schema-missing') return <SetupPage />
  if (status === 'profile-missing') return <PendingPage variant="profile-missing" />
  if (!profile || profile.role === 'pending') return <PendingPage variant="pending" />

  const full = isFullAccess(profile.role)

  return (
    <Layout>
      <Routes>
        <Route path="/" element={full ? <DashboardPage /> : <Navigate to="/muhasebe" replace />} />
        <Route path="/muhasebe" element={<MuhasebePage />} />
        {full && (
          <>
            <Route path="/sakinler" element={<ResidentsPage />} />
            <Route path="/aidat" element={<DuesPage />} />
            <Route path="/masraflar" element={<ExpensesPage />} />
            <Route path="/ayarlar" element={<SettingsPage />} />
            <Route path="/kullanicilar" element={<UsersPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
