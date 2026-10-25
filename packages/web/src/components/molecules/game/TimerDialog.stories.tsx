import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TimerDialog } from './TimerDialog';

const meta = {
  title: 'Molecules/Game/TimerDialog',
  component: TimerDialog,
  parameters: {
    layout: 'centered',
  },
  /* The lettering sizes follow the container, so the story gives it the wide table's. */
  decorators: [
    (Story) => (
      <div className="table-cloth @container flex h-72 w-[48rem] items-center justify-center rounded-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    progress: { secondsLeft: 18, fraction: 0.6 },
  },
} satisfies Meta<typeof TimerDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Bets: Story = {
  args: { title: { text: 'Einsätze', tone: 'plain' } },
};

export const YourTurn: Story = {
  args: { title: { text: 'Du bist dran', tone: 'gold' } },
};

export const Urgent: Story = {
  args: {
    progress: { secondsLeft: 3, fraction: 0.1 },
    title: { text: 'Einsätze', tone: 'plain' },
  },
};

export const Win: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Gewonnen!', tone: 'gold' },
    isCalm: true,
  },
};

export const Blackjack: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Blackjack!', tone: 'gold' },
    isCalm: true,
  },
};

export const Lose: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Verloren!', tone: 'red' },
    isCalm: true,
  },
};

export const Push: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Unentschieden', tone: 'plain' },
    isCalm: true,
  },
};

export const RoundOver: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Rundenende', tone: 'plain' },
    isCalm: true,
  },
};
