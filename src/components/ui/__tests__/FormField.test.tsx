import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, Label, Input, Select, Textarea } from '../FormField';

describe('FormField', () => {
  describe('Field + Label + Input composition', () => {
    it('renders Field with Label and Input correctly', () => {
      render(
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input id="name" />
        </Field>
      );

      const input = screen.getByLabelText('Name');
      expect(input).toBeInTheDocument();
      expect(input.id).toBe('name');
    });

    it('associates label with input via htmlFor', () => {
      render(
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" />
        </Field>
      );

      const input = screen.getByLabelText('Email') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('Input', () => {
    it('renders input element', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('supports placeholder attribute', () => {
      render(<Input placeholder="Enter text..." />);
      const input = screen.getByPlaceholderText('Enter text...');
      expect(input).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
    });
  });

  describe('Select', () => {
    it('renders select element with options', () => {
      render(
        <Select>
          <option value="a">Option A</option>
          <option value="b">Option B</option>
        </Select>
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('displays options as children', () => {
      render(
        <Select>
          <option value="red">Red</option>
          <option value="blue">Blue</option>
          <option value="green">Green</option>
        </Select>
      );

      expect(screen.getByText('Red')).toBeInTheDocument();
      expect(screen.getByText('Blue')).toBeInTheDocument();
      expect(screen.getByText('Green')).toBeInTheDocument();
    });
  });

  describe('Textarea', () => {
    it('renders textarea element', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('sets initial value with defaultValue', () => {
      render(<Textarea defaultValue="Initial content" />);
      const textarea = screen.getByDisplayValue('Initial content');
      expect(textarea).toBeInTheDocument();
    });

    it('supports placeholder attribute', () => {
      render(<Textarea placeholder="Enter message..." />);
      const textarea = screen.getByPlaceholderText('Enter message...');
      expect(textarea).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Textarea className="custom-textarea" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('custom-textarea');
    });
  });

  describe('Label', () => {
    it('renders label element', () => {
      render(<Label htmlFor="field">Label Text</Label>);
      const label = screen.getByText('Label Text');
      expect(label.tagName).toBe('LABEL');
    });

    it('has correct htmlFor attribute', () => {
      render(<Label htmlFor="my-input">My Input</Label>);
      const label = screen.getByText('My Input') as HTMLLabelElement;
      expect(label.htmlFor).toBe('my-input');
    });
  });
});
