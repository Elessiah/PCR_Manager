import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PillFilter } from '../PillFilter';

describe('PillFilter', () => {
  const defaultOptions = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ];

  it('renders all pill options', () => {
    const onChange = vi.fn();
    render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
      />
    );

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('calls onChange when clicking a pill', async () => {
    const onChange = vi.fn();
    render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
      />
    );

    const user = userEvent.setup();
    const pillB = screen.getByText('Option B');
    await user.click(pillB);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('applies active styles to selected pill', () => {
    const onChange = vi.fn();
    render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
      />
    );

    const pillA = screen.getByText('Option A') as HTMLButtonElement;
    expect(pillA).toHaveClass('bg-surface');
    expect(pillA).toHaveClass('shadow-sm');
    expect(pillA).toHaveClass('text-text');
  });

  it('applies inactive styles to unselected pills', () => {
    const onChange = vi.fn();
    render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
      />
    );

    const pillB = screen.getByText('Option B') as HTMLButtonElement;
    const pillC = screen.getByText('Option C') as HTMLButtonElement;

    expect(pillB).toHaveClass('text-textMuted');
    expect(pillC).toHaveClass('text-textMuted');
    expect(pillB).not.toHaveClass('bg-surface');
    expect(pillC).not.toHaveClass('bg-surface');
  });

  it('updates active pill when value changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
      />
    );

    let pillA = screen.getByText('Option A') as HTMLButtonElement;
    expect(pillA).toHaveClass('bg-surface');

    rerender(
      <PillFilter
        options={defaultOptions}
        value="b"
        onChange={onChange}
      />
    );

    pillA = screen.getByText('Option A') as HTMLButtonElement;
    const pillB = screen.getByText('Option B') as HTMLButtonElement;

    expect(pillA).not.toHaveClass('bg-surface');
    expect(pillB).toHaveClass('bg-surface');
  });

  it('handles click on already selected pill', async () => {
    const onChange = vi.fn();
    render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
      />
    );

    const user = userEvent.setup();
    const pillA = screen.getByText('Option A');
    await user.click(pillA);

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders with custom className', () => {
    const onChange = vi.fn();
    render(
      <PillFilter
        options={defaultOptions}
        value="a"
        onChange={onChange}
        className="custom-class"
      />
    );

    const container = screen.getByText('Option A').parentElement;
    expect(container).toHaveClass('custom-class');
  });
});
