import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dot } from '../Dot';

describe('Dot', () => {
  it('renders dot element', () => {
    render(<Dot data-testid="dot" />);
    expect(screen.getByTestId('dot')).toBeInTheDocument();
  });

  it('applies base classes', () => {
    render(<Dot data-testid="dot" />);
    const dot = screen.getByTestId('dot');
    expect(dot).toHaveClass('h-2');
    expect(dot).toHaveClass('w-2');
    expect(dot).toHaveClass('rounded-full');
  });

  describe('variants', () => {
    it('applies ok variant classes', () => {
      render(<Dot variant="ok" data-testid="dot-ok" />);
      const dot = screen.getByTestId('dot-ok');
      expect(dot).toHaveClass('bg-ok');
    });

    it('applies warn variant classes', () => {
      render(<Dot variant="warn" data-testid="dot-warn" />);
      const dot = screen.getByTestId('dot-warn');
      expect(dot).toHaveClass('bg-warn');
    });

    it('applies danger variant classes', () => {
      render(<Dot variant="danger" data-testid="dot-danger" />);
      const dot = screen.getByTestId('dot-danger');
      expect(dot).toHaveClass('bg-danger');
    });

    it('applies neutral variant classes', () => {
      render(<Dot variant="neutral" data-testid="dot-neutral" />);
      const dot = screen.getByTestId('dot-neutral');
      expect(dot).toHaveClass('bg-neutral');
    });

    it('uses neutral variant by default', () => {
      render(<Dot data-testid="dot-default" />);
      const dot = screen.getByTestId('dot-default');
      expect(dot).toHaveClass('bg-neutral');
    });
  });

  it('renders as inline-block', () => {
    render(<Dot data-testid="dot" />);
    const dot = screen.getByTestId('dot');
    expect(dot).toHaveClass('inline-block');
  });
});
