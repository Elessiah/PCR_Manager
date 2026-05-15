import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Tabs, TabList, Tab, TabPanel } from '../Tabs';

// Test wrapper component that manages tab state internally
const TabsWrapper = () => {
  const [activeTab, setActiveTab] = useState('tab-a');

  return (
    <Tabs>
      <TabList>
        <Tab
          active={activeTab === 'tab-a'}
          onClick={() => setActiveTab('tab-a')}
        >
          Tab A
        </Tab>
        <Tab
          active={activeTab === 'tab-b'}
          onClick={() => setActiveTab('tab-b')}
        >
          Tab B
        </Tab>
        <Tab
          active={activeTab === 'tab-c'}
          onClick={() => setActiveTab('tab-c')}
        >
          Tab C
        </Tab>
      </TabList>

      {activeTab === 'tab-a' && (
        <TabPanel>Content A</TabPanel>
      )}
      {activeTab === 'tab-b' && (
        <TabPanel>Content B</TabPanel>
      )}
      {activeTab === 'tab-c' && (
        <TabPanel>Content C</TabPanel>
      )}
    </Tabs>
  );
};

describe('Tabs', () => {
  it('renders tab buttons and panels', () => {
    render(<TabsWrapper />);

    expect(screen.getByRole('button', { name: 'Tab A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab B' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab C' })).toBeInTheDocument();
  });

  it('displays first panel by default', () => {
    render(<TabsWrapper />);

    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();
    expect(screen.queryByText('Content C')).not.toBeInTheDocument();
  });

  it('marks first tab as active by default', () => {
    render(<TabsWrapper />);

    const tabA = screen.getByRole('button', { name: 'Tab A' }) as HTMLButtonElement;
    expect(tabA).toHaveClass('text-accent');
  });

  it('switches to second panel when clicking second tab', async () => {
    render(<TabsWrapper />);

    const user = userEvent.setup();
    const tabB = screen.getByRole('button', { name: 'Tab B' });
    await user.click(tabB);

    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
    expect(screen.queryByText('Content C')).not.toBeInTheDocument();
  });

  it('marks second tab as active when clicked', async () => {
    render(<TabsWrapper />);

    const user = userEvent.setup();
    const tabA = screen.getByRole('button', { name: 'Tab A' });
    const tabB = screen.getByRole('button', { name: 'Tab B' });

    await user.click(tabB);

    expect(tabA).not.toHaveClass('text-accent');
    expect(tabB).toHaveClass('text-accent');
  });

  it('applies correct styles to inactive tabs', async () => {
    render(<TabsWrapper />);

    const user = userEvent.setup();
    const tabB = screen.getByRole('button', { name: 'Tab B' });
    await user.click(tabB);

    const tabA = screen.getByRole('button', { name: 'Tab A' });
    const tabC = screen.getByRole('button', { name: 'Tab C' });

    expect(tabA).toHaveClass('text-textMuted');
    expect(tabC).toHaveClass('text-textMuted');
    expect(tabA).not.toHaveClass('border-accent');
    expect(tabC).not.toHaveClass('border-accent');
  });

  it('switches to third panel', async () => {
    render(<TabsWrapper />);

    const user = userEvent.setup();
    const tabC = screen.getByRole('button', { name: 'Tab C' });
    await user.click(tabC);

    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.queryByText('Content B')).not.toBeInTheDocument();
    expect(screen.getByText('Content C')).toBeInTheDocument();
  });

  it('allows switching back to previous tabs', async () => {
    render(<TabsWrapper />);

    const user = userEvent.setup();
    const tabB = screen.getByRole('button', { name: 'Tab B' });
    const tabA = screen.getByRole('button', { name: 'Tab A' });

    await user.click(tabB);
    expect(screen.getByText('Content B')).toBeInTheDocument();

    await user.click(tabA);
    expect(screen.getByText('Content A')).toBeInTheDocument();
  });

  describe('TabList', () => {
    it('renders as flex container with border', () => {
      render(<TabsWrapper />);

      const tabList = screen.getByRole('button', { name: 'Tab A' }).parentElement;
      expect(tabList).toHaveClass('flex');
      expect(tabList).toHaveClass('border-b');
    });
  });

  describe('Tab', () => {
    it('renders as button element', () => {
      render(<TabsWrapper />);

      const tab = screen.getByRole('button', { name: 'Tab A' });
      expect(tab.tagName).toBe('BUTTON');
    });

    it('applies padding classes', () => {
      render(<TabsWrapper />);

      const tab = screen.getByRole('button', { name: 'Tab A' });
      expect(tab).toHaveClass('px-4');
      expect(tab).toHaveClass('py-2.5');
    });
  });
});
