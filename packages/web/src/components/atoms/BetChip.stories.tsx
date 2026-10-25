import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BetChip } from './BetChip';

const meta = {
  title: 'Atoms/BetChip',
  component: BetChip,
  parameters: {
    layout: 'centered',
  },
  args: {
    label: '100',
    tone: 'green',
    'aria-label': 'Raise the bet by 100',
  },
} satisfies Meta<typeof BetChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Green: Story = {};

export const Red: Story = {
  args: { label: '50', tone: 'red' },
};

export const Blue: Story = {
  args: { tone: 'blue' },
};

export const Black: Story = {
  args: { label: '500', tone: 'black' },
};

export const Purple: Story = {
  args: { label: '1K', tone: 'purple' },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

/** Out of reach, e.g. for a balance that doesn't cover it. */
export const Locked: Story = {
  args: { label: '500', tone: 'black', isLocked: true },
};
