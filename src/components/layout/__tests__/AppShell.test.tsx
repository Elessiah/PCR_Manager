import { describe, it, expect } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, screen } from '../../../test/test-utils';
import AppShell from '../AppShell';

describe('AppShell', () => {
  const AppShellWrapper = () => (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<div data-testid="outlet-content">Dashboard Content</div>} />
      </Route>
    </Routes>
  );

  it('should render sidebar with navigation links', () => {
    renderWithProviders(<AppShellWrapper />, { route: '/' });

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /travailleurs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /appareils/i })).toBeInTheDocument();
  });

  it('should render outlet content', () => {
    renderWithProviders(<AppShellWrapper />, { route: '/' });

    expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('should have correct grid layout', () => {
    const { container } = renderWithProviders(<AppShellWrapper />, { route: '/' });

    const mainDiv = container.querySelector('.grid');
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv).toHaveClass('grid-cols-[240px_1fr]');
  });

  it('should render brand name in sidebar', () => {
    renderWithProviders(<AppShellWrapper />, { route: '/' });

    // The sidebar displays "Gestionnaire PCR" as the brand name.
    expect(screen.getAllByText('Gestionnaire PCR').length).toBeGreaterThanOrEqual(1);
  });

  it('should display all sidebar navigation links', () => {
    renderWithProviders(<AppShellWrapper />, { route: '/' });

    expect(screen.getByRole('link', { name: /établissement/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /actions/i })).toBeInTheDocument();
  });
});
