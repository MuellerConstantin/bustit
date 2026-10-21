import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SearchField } from './SearchField';

const meta = {
  title: 'Atoms/SearchField',
  component: SearchField,
  parameters: {
    layout: 'centered',
  },
  args: {
    'aria-label': 'Search',
    placeholder: 'Search …',
    clearLabel: 'Clear search',
    isDisabled: false,
  },
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    'aria-label': undefined,
    label: 'Users',
  },
};

export const Filled: Story = {
  args: {
    defaultValue: 'max',
  },
};
