import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar } from './Avatar';

const meta = {
  title: 'Atoms/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithName: Story = {
  args: {
    name: 'admin',
  },
};

export const Placeholder: Story = {
  args: {},
};

export const Large: Story = {
  args: {
    name: 'admin',
    className: 'size-10 text-base',
  },
};
