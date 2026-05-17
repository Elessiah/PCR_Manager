import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, RenderOptions } from '@testing-library/react'
import { AuthProvider } from '../context/AuthContext'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  /**
   * Route pattern to mount the UI at, with optional URL params (e.g. '/travailleurs/:id').
   * Defaults to '*' so any `route` is matched and `useParams` works for paramaterised paths.
   */
  path?: string
}

const renderWithProviders = (
  ui: React.ReactElement,
  { route = '/', path = '*', ...renderOptions }: RenderWithProvidersOptions = {}
) => {
  const testQueryClient = createTestQueryClient()

  // Auto-derive a sensible route pattern when the caller passes e.g. '/travailleurs/1'
  // so that useParams() resolves the id segment.
  const resolvedPath =
    path === '*' && /\/\d+(?:\/|$)/.test(route)
      ? route.replace(/\/\d+(?=\/|$)/g, '/:id')
      : path

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={resolvedPath} element={children} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

export * from '@testing-library/react'
export { renderWithProviders }
