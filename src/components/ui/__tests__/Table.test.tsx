import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table, THead, TBody, TR, TH, TD } from '../Table';

describe('Table', () => {
  const sampleTable = (
    <Table>
      <THead>
        <TR>
          <TH>Header 1</TH>
          <TH>Header 2</TH>
          <TH>Header 3</TH>
        </TR>
      </THead>
      <TBody>
        <TR>
          <TD>Row 1, Cell 1</TD>
          <TD>Row 1, Cell 2</TD>
          <TD>Row 1, Cell 3</TD>
        </TR>
        <TR>
          <TD>Row 2, Cell 1</TD>
          <TD>Row 2, Cell 2</TD>
          <TD>Row 2, Cell 3</TD>
        </TR>
      </TBody>
    </Table>
  );

  describe('Table structure', () => {
    it('renders table element', () => {
      const { container } = render(sampleTable);
      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
    });

    it('renders thead element', () => {
      const { container } = render(sampleTable);
      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
    });

    it('renders tbody element', () => {
      const { container } = render(sampleTable);
      const tbody = container.querySelector('tbody');
      expect(tbody).toBeInTheDocument();
    });

    it('renders table rows', () => {
      const { container } = render(sampleTable);
      const rows = container.querySelectorAll('tr');
      expect(rows.length).toBe(3); // 1 header row + 2 body rows
    });

    it('renders table headers (th elements)', () => {
      const { container } = render(sampleTable);
      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(3);
    });

    it('renders table cells (td elements)', () => {
      const { container } = render(sampleTable);
      const cells = container.querySelectorAll('td');
      expect(cells.length).toBe(6); // 2 rows × 3 cells
    });
  });

  describe('Table content', () => {
    it('displays header content', () => {
      render(sampleTable);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Header 3')).toBeInTheDocument();
    });

    it('displays body cell content', () => {
      render(sampleTable);

      expect(screen.getByText('Row 1, Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Row 1, Cell 2')).toBeInTheDocument();
      expect(screen.getByText('Row 2, Cell 3')).toBeInTheDocument();
    });

    it('renders correct header in first th', () => {
      const { container } = render(sampleTable);
      const firstHeader = container.querySelector('th');
      expect(firstHeader?.textContent).toBe('Header 1');
    });

    it('renders correct content in first td', () => {
      const { container } = render(sampleTable);
      const firstCell = container.querySelector('td');
      expect(firstCell?.textContent).toBe('Row 1, Cell 1');
    });
  });

  describe('Table styling', () => {
    it('applies table-wide styles', () => {
      render(sampleTable);
      const table = screen.getByRole('table');
      expect(table).toHaveClass('w-full');
      expect(table).toHaveClass('border-collapse');
    });

    it('applies THead background style', () => {
      const { container } = render(sampleTable);
      const thead = container.querySelector('thead');
      expect(thead).toHaveClass('bg-surface2');
    });

    it('applies TR hover style', () => {
      const { container } = render(sampleTable);
      const rows = container.querySelectorAll('tr');
      rows.forEach((row) => {
        expect(row).toHaveClass('hover:bg-surfaceHover');
      });
    });

    it('applies TH text styling', () => {
      const { container } = render(sampleTable);
      const headers = container.querySelectorAll('th');
      headers.forEach((header) => {
        expect(header).toHaveClass('text-left');
        expect(header).toHaveClass('uppercase');
        expect(header).toHaveClass('text-xs');
        expect(header).toHaveClass('font-medium');
      });
    });

    it('applies TD padding and border', () => {
      const { container } = render(sampleTable);
      const cells = container.querySelectorAll('td');
      cells.forEach((cell) => {
        expect(cell).toHaveClass('px-3');
        expect(cell).toHaveClass('py-2');
        expect(cell).toHaveClass('border-b');
      });
    });
  });

  describe('Custom className support', () => {
    it('applies custom className to Table', () => {
      const { container } = render(
        <Table className="custom-table">
          <TBody>
            <TR>
              <TD>Cell</TD>
            </TR>
          </TBody>
        </Table>
      );

      const table = container.querySelector('table');
      expect(table).toHaveClass('custom-table');
    });

    it('applies custom className to TH', () => {
      const { container } = render(
        <Table>
          <THead>
            <TR>
              <TH className="custom-header">Header</TH>
            </TR>
          </THead>
        </Table>
      );

      const header = container.querySelector('th');
      expect(header).toHaveClass('custom-header');
    });

    it('applies custom className to TD', () => {
      const { container } = render(
        <Table>
          <TBody>
            <TR>
              <TD className="custom-cell">Cell</TD>
            </TR>
          </TBody>
        </Table>
      );

      const cell = container.querySelector('td');
      expect(cell).toHaveClass('custom-cell');
    });
  });

  describe('Complex table structures', () => {
    it('handles multiple header rows', () => {
      const { container } = render(
        <Table>
          <THead>
            <TR>
              <TH>Header 1</TH>
              <TH>Header 2</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD>A</TD>
              <TD>B</TD>
            </TR>
            <TR>
              <TD>C</TD>
              <TD>D</TD>
            </TR>
            <TR>
              <TD>E</TD>
              <TD>F</TD>
            </TR>
          </TBody>
        </Table>
      );

      const rows = container.querySelectorAll('tr');
      expect(rows.length).toBe(4); // 1 header + 3 body
    });

    it('handles varying column counts per row', () => {
      const { container } = render(
        <Table>
          <THead>
            <TR>
              <TH>A</TH>
              <TH>B</TH>
              <TH>C</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD>1</TD>
              <TD>2</TD>
              <TD>3</TD>
            </TR>
            <TR>
              <TD>X</TD>
              <TD>Y</TD>
            </TR>
          </TBody>
        </Table>
      );

      const cells = container.querySelectorAll('td');
      expect(cells.length).toBe(5);
    });
  });
});
