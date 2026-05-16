import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiTile } from './KpiTile';

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

  it('renders chip badge with tone=warn', () => {
    render(
      <KpiTile
        label="Expiry"
        value={90}
        tone="warn"
        chip="90 jours"
      />
    );

    const badge = screen.getByText('90 jours');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-warn');
  });

  it('renders chip badge with tone=danger', () => {
    render(
      <KpiTile
        label="Critical"
        value={10}
        tone="danger"
        chip="5 days"
      />
    );

    const badge = screen.getByText('5 days');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-danger');
  });

  it('renders chip without tone (neutral variant)', () => {
    render(
      <KpiTile
        label="Info"
        value={50}
        chip="Some info"
      />
    );

    const badge = screen.getByText('Some info');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-textMuted');
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
