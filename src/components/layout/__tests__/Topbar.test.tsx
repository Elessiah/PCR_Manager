import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../test/test-utils';
import Topbar from '../Topbar';

describe('Topbar', () => {
  it('should render search input', () => {
    renderWithProviders(<Topbar />);

    const searchInput = screen.getByPlaceholderText(/rechercher/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('type', 'text');
  });

  it('should display default breadcrumb text when no breadcrumb provided', () => {
    renderWithProviders(<Topbar />);

    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('should render breadcrumb items when provided', () => {
    const breadcrumb = [
      { label: 'Travailleurs' },
      { label: 'Détails' }
    ];
    renderWithProviders(<Topbar breadcrumb={breadcrumb} />);

    expect(screen.getByText('Travailleurs')).toBeInTheDocument();
    expect(screen.getByText('Détails')).toBeInTheDocument();
  });

  it('should render breadcrumb with clickable links', () => {
    const breadcrumb = [
      { label: 'Accueil', to: '/' },
      { label: 'Travailleurs' }
    ];
    renderWithProviders(<Topbar breadcrumb={breadcrumb} />);

    const link = screen.getByRole('link', { name: /accueil/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('should render avatar with initials', () => {
    renderWithProviders(<Topbar />);

    const avatarElements = screen.getAllByText('PM');
    expect(avatarElements.length).toBeGreaterThan(0);
  });

  it('should not display Home when breadcrumb has items', () => {
    const breadcrumb = [{ label: 'Page' }];
    renderWithProviders(<Topbar breadcrumb={breadcrumb} />);

    const homeElements = screen.queryAllByText('Home');
    expect(homeElements.length).toBe(0);
  });
});
