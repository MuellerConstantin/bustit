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
  args: { label: 'Einsätze' },
};

export const YourTurn: Story = {
  args: { label: 'Du bist dran' },
};

export const Urgent: Story = {
  args: { progress: { secondsLeft: 3, fraction: 0.1 }, label: 'Einsätze' },
};

export const Win: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Gewonnen!', tone: 'win' },
  },
};

export const Blackjack: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Blackjack!', tone: 'win' },
  },
};

export const Lose: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Verloren!', tone: 'lose' },
  },
};

export const Push: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Unentschieden', tone: 'push' },
  },
};

export const RoundOver: Story = {
  args: {
    progress: { secondsLeft: 4, fraction: 0.8 },
    title: { text: 'Rundenende', tone: 'neutral' },
  },
};
