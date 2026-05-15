import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHead, CardBody, CardTitle } from '../Card';

describe('Card', () => {
  it('renders card container', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('bg-surface');
  });

  it('applies card classes', () => {
    render(<Card data-testid="card" />);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('border-border');
    expect(card).toHaveClass('rounded-lg');
  });
});

describe('CardHead', () => {
  it('renders card head with content', () => {
    render(<CardHead>Header</CardHead>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('applies card head classes', () => {
    render(<CardHead data-testid="card-head" />);
    const head = screen.getByTestId('card-head');
    expect(head).toHaveClass('border-b');
    expect(head).toHaveClass('flex');
  });
});

describe('CardBody', () => {
  it('renders card body with content', () => {
    render(<CardBody>Body content</CardBody>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('applies card body classes', () => {
    render(<CardBody data-testid="card-body" />);
    const body = screen.getByTestId('card-body');
    expect(body).toHaveClass('p-5');
  });
});

describe('CardTitle', () => {
  it('renders card title with text', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('applies card title classes', () => {
    render(<CardTitle data-testid="card-title" />);
    const title = screen.getByTestId('card-title');
    expect(title).toHaveClass('font-semibold');
    expect(title).toHaveClass('text-sm');
  });
});

describe('Card composition', () => {
  it('renders complete card structure', () => {
    render(
      <Card>
        <CardHead>
          <CardTitle>My Title</CardTitle>
        </CardHead>
        <CardBody>Body content</CardBody>
      </Card>
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('supports custom content in head and body', () => {
    render(
      <Card>
        <CardHead>
          <CardTitle>Settings</CardTitle>
        </CardHead>
        <CardBody>
          <p>Configure your preferences here</p>
        </CardBody>
      </Card>
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Configure your preferences here')).toBeInTheDocument();
  });
});
