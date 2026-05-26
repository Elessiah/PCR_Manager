import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import Dashboard from './modules/dashboard/Dashboard';
import Etablissement from './modules/etablissement/Etablissement';
import TravailleursList from './modules/travailleurs/TravailleursList';
import TravailleurFiche from './modules/travailleurs/TravailleurFiche';
import AppareilsList from './modules/appareils/AppareilsList';
import AppareilFiche from './modules/appareils/AppareilFiche';
import Actions from './modules/actions/Actions';
import CompetencesList from './modules/competences/CompetencesList';
import LoginPage from './modules/auth/LoginPage';
import TotpSetupPage from './modules/auth/TotpSetupPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/totp-setup" element={<TotpSetupPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="etablissement" element={<Etablissement />} />
        <Route path="travailleurs" element={<TravailleursList />} />
        <Route path="travailleurs/:id" element={<TravailleurFiche />} />
        <Route path="appareils" element={<AppareilsList />} />
        <Route path="appareils/:id" element={<AppareilFiche />} />
        <Route path="competences" element={<CompetencesList />} />
        <Route path="actions" element={<Actions />} />
      </Route>
    </Routes>
  );
}

export default App;
