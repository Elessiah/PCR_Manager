import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiTile } from '../KpiTile';

describe('KpiTile', () => {
  it('renders label and value', () => {
    render(<KpiTile label="Etabs" value={42} />);
    expect(screen.getByText('Etabs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders with string value', () => {
    render(<KpiTile label="Status" value="Active" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with numeric value', () => {
    render(<KpiTile label="Count" value={100} />);
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(<KpiTile label="Etabs" value={42} footer="+3" />);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('does not render footer when not provided', () => {
    render(<KpiTile label="Etabs" value={42} />);
    expect(screen.queryByText('+3')).not.toBeInTheDocument();
  });

  it('renders footer as ReactNode', () => {
    render(
      <KpiTile
        label="Growth"
        value={50}
        footer={<span data-testid="footer-node">Growth +10%</span>}
      />
    );
    expect(screen.getByTestId('footer-node')).toBeInTheDocument();
    expect(screen.getByText('Growth +10%')).toBeInTheDocument();
  });

  it('applies tile classes', () => {
    render(<KpiTile label="Test" value={1} data-testid="kpi-tile" />);
    const tile = screen.getByTestId('kpi-tile');
    expect(tile).toHaveClass('bg-surface');
    expect(tile).toHaveClass('border');
    expect(tile).toHaveClass('rounded-lg');
    expect(tile).toHaveClass('p-4');
    expect(tile).toHaveClass('px-5');
  });

  it('renders label with uppercase styling', () => {
    render(<KpiTile label="METRIC" value={99} data-testid="label" />);
    const label = screen.getByText('METRIC');
    expect(label).toHaveClass('text-xs');
    expect(label).toHaveClass('font-semibold');
  });

  it('renders value with bold styling', () => {
    render(<KpiTile label="Amount" value={1234} data-testid="value" />);
    const value = screen.getByText('1234');
    expect(value).toHaveClass('font-bold');
  });

  it('combines label, value, and footer correctly', () => {
    render(
      <KpiTile label="Sales" value={5000} footer="YoY +25%" />
    );
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('5000')).toBeInTheDocument();
    expect(screen.getByText('YoY +25%')).toBeInTheDocument();
  });
});
