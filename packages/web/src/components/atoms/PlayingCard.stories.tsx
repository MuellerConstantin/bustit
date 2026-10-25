import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlayingCard } from './PlayingCard';

const meta = {
  title: 'Atoms/PlayingCard',
  component: PlayingCard,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof PlayingCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Black: Story = {
  args: {
    card: { rank: 'K', suit: 'spades' },
  },
};

export const Red: Story = {
  args: {
    card: { rank: '10', suit: 'hearts' },
  },
};

export const FaceDown: Story = {};
