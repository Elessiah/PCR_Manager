import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Hello</Button>);
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument();
  });

  it('handles click event', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });

    const user = userEvent.setup();
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  describe('variants', () => {
    it('applies default variant classes', () => {
      render(<Button variant="default">Default</Button>);
      const button = screen.getByRole('button', { name: 'Default' });
      expect(button).toHaveClass('bg-surface');
    });

    it('applies primary variant classes', () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button', { name: 'Primary' });
      expect(button).toHaveClass('bg-accent');
    });

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button', { name: 'Ghost' });
      expect(button).toHaveClass('bg-transparent');
    });

    it('applies dangerGhost variant classes', () => {
      render(<Button variant="dangerGhost">DangerGhost</Button>);
      const button = screen.getByRole('button', { name: 'DangerGhost' });
      expect(button).toHaveClass('text-danger');
    });
  });

  describe('sizes', () => {
    it('applies default size classes', () => {
      render(<Button size="default">Default Size</Button>);
      const button = screen.getByRole('button', { name: 'Default Size' });
      expect(button).toHaveClass('h-9');
    });

    it('applies sm size classes', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button', { name: 'Small' });
      expect(button).toHaveClass('h-8');
    });

    it('applies icon size classes', () => {
      render(<Button size="icon">Icon</Button>);
      const button = screen.getByRole('button', { name: 'Icon' });
      expect(button).toHaveClass('w-9');
    });
  });

  it('combines variant and size correctly', () => {
    render(
      <Button variant="primary" size="sm">
        Primary Small
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Primary Small' });
    expect(button).toHaveClass('bg-accent');
    expect(button).toHaveClass('h-8');
  });
});
