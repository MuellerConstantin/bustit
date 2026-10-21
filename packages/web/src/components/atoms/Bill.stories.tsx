import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bill } from './Bill';

const meta = {
  title: 'Atoms/Bill',
  component: Bill,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Bill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {},
};

export const Large: Story = {
  args: {
    size: 'lg',
  },
};

export const NextToAnAmount: Story = {
  render: () => (
    <span className="flex items-center gap-1.5 text-sm tabular-nums">
      <Bill />
      1,000 Bucks
    </span>
  ),
};
