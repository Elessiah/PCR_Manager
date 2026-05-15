import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Pages (à créer)
// import Dashboard from './pages/Dashboard'
// import Etablissement from './pages/Etablissement'
// import Travailleurs from './pages/Travailleurs'
// import Appareils from './pages/Appareils'
// import Actions from './pages/Actions'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (anciennement cacheTime)
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Routes à implémenter selon le cahier des charges */}
          {/* <Route path="/" element={<Dashboard />} />
          <Route path="/etablissement" element={<Etablissement />} />
          <Route path="/travailleurs" element={<Travailleurs />} />
          <Route path="/appareils" element={<Appareils />} />
          <Route path="/actions" element={<Actions />} /> */}

          <Route path="/" element={<div className="p-8 text-center">PCR Manager - En construction</div>} />
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

export default App
