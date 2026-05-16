import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiTile } from './KpiTile';
import { Badge } from './Badge';

describe('KpiTile', () => {
  it('renders without tone or chip', () => {
    render(<KpiTile label="Test Label" value={42} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const valueElement = screen.getByText('42');
    expect(valueElement).toHaveStyle({ color: 'var(--text)' });
  });

  it('renders with footer', () => {
    render(<KpiTile label="Test" value={100} footer="Footer text" />);

    expect(screen.getByText('Footer text')).toBeInTheDocument();
  });

  it('applies danger tone to value', () => {
    render(<KpiTile label="Critical" value={5} tone="danger" />);

    const valueElement = screen.getByText('5');
    expect(valueElement).toHaveStyle({ color: 'var(--danger)' });
  });

  it('applies warn tone to value', () => {
    render(<KpiTile label="Warning" value={15} tone="warn" />);

    const valueElement = screen.getByText('15');
    expect(valueElement).toHaveStyle({ color: 'var(--warn)' });
  });

  it('applies ok tone to value', () => {
    render(<KpiTile label="Good" value={95} tone="ok" />);

    const valueElement = screen.getByText('95');
    expect(valueElement).toHaveStyle({ color: 'var(--ok)' });
  });

  it('renders a Badge chip with tone=warn', () => {
    render(
      <KpiTile
        label="Expiry"
        value={90}
        tone="warn"
        chip={<Badge variant="warn">90 jours</Badge>}
      />
    );

    const badge = screen.getByText('90 jours');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-warn');
  });

  it('renders a Badge chip with tone=danger', () => {
    render(
      <KpiTile
        label="Critical"
        value={10}
        tone="danger"
        chip={<Badge variant="danger">5 days</Badge>}
      />
    );

    const badge = screen.getByText('5 days');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-danger');
  });

  it('renders a chip without nesting it inside another Badge', () => {
    // Regression test : KpiTile ne doit PAS wrapper son chip dans un Badge
    // (sinon on obtient une double bordure / double padding).
    const { container } = render(
      <KpiTile
        label="Info"
        value={50}
        chip={<Badge variant="neutral">Some info</Badge>}
      />
    );

    // Une seule occurrence du contenu (pas de Badge imbriqué qui rerend le children).
    expect(screen.getAllByText('Some info')).toHaveLength(1);

    // Exactement un seul span.badge-like (border + rounded-full) autour du texte.
    const badges = container.querySelectorAll('span.rounded-full');
    expect(badges.length).toBe(1);
  });

  it('does not render chip when chip is undefined', () => {
    render(<KpiTile label="Test" value={42} tone="ok" />);

    expect(screen.queryByText(/jours|days|info/)).not.toBeInTheDocument();
  });

  it('maintains string value', () => {
    render(<KpiTile label="Code" value="ABC123" />);

    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });
});
