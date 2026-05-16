import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './modules/dashboard/Dashboard';
import Etablissement from './modules/etablissement/Etablissement';
import TravailleursList from './modules/travailleurs/TravailleursList';
import TravailleurFiche from './modules/travailleurs/TravailleurFiche';
import AppareilsList from './modules/appareils/AppareilsList';
import AppareilFiche from './modules/appareils/AppareilFiche';
import Actions from './modules/actions/Actions';
import CompetencesList from './modules/competences/CompetencesList';

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
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
