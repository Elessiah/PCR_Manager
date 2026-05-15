import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders badge with text', () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  describe('variants', () => {
    it('applies ok variant classes', () => {
      render(<Badge variant="ok">OK</Badge>);
      const badge = screen.getByText('OK');
      expect(badge).toHaveClass('bg-okBg');
    });

    it('applies warn variant classes', () => {
      render(<Badge variant="warn">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-warnBg');
    });

    it('applies danger variant classes', () => {
      render(<Badge variant="danger">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge).toHaveClass('bg-dangerBg');
    });

    it('applies neutral variant classes', () => {
      render(<Badge variant="neutral">Neutral</Badge>);
      const badge = screen.getByText('Neutral');
      expect(badge).toHaveClass('bg-neutralBg');
    });

    it('applies accent variant classes', () => {
      render(<Badge variant="accent">Accent</Badge>);
      const badge = screen.getByText('Accent');
      expect(badge).toHaveClass('bg-accentSoft');
    });

    it('uses neutral variant by default', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-neutralBg');
    });
  });

  it('renders icon when provided', () => {
    render(
      <Badge>
        Status <svg data-testid="badge-icon" />
      </Badge>
    );
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
  });

  it('renders without icon when not provided', () => {
    render(<Badge>Status</Badge>);
    expect(screen.queryByTestId('badge-icon')).not.toBeInTheDocument();
  });

  it('combines variant and content correctly', () => {
    render(<Badge variant="warn">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge).toHaveClass('bg-warnBg');
    expect(badge).toHaveClass('text-warn');
  });
});
