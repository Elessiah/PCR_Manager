import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../test/test-utils';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  it('should render all navigation links', () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /établissement/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /travailleurs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /appareils/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /actions/i })).toBeInTheDocument();
  });

  it('should highlight the active link when on /travailleurs', () => {
    renderWithProviders(<Sidebar />, { route: '/travailleurs' });

    const travailleurLink = screen.getByRole('link', { name: /travailleurs/i });
    expect(travailleurLink).toHaveClass('bg-accentSoft');
    expect(travailleurLink).toHaveClass('text-accent');
    expect(travailleurLink).toHaveClass('border');
  });

  it('should not highlight non-active links', () => {
    renderWithProviders(<Sidebar />, { route: '/travailleurs' });

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveClass('bg-accentSoft');
    expect(dashboardLink).not.toHaveClass('text-accent');
  });

  it('should display the brand name', () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    // Sidebar rend "PCR Manager" deux fois (brand-mark abrégé + brand-name complet).
    expect(screen.getAllByText('PCR Manager').length).toBeGreaterThanOrEqual(1);
  });

  it('should display user profile in footer', () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should set correct href for each navigation link', () => {
    renderWithProviders(<Sidebar />, { route: '/' });

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /établissement/i })).toHaveAttribute('href', '/etablissement');
    expect(screen.getByRole('link', { name: /travailleurs/i })).toHaveAttribute('href', '/travailleurs');
    expect(screen.getByRole('link', { name: /appareils/i })).toHaveAttribute('href', '/appareils');
    expect(screen.getByRole('link', { name: /actions/i })).toHaveAttribute('href', '/actions');
  });
});
