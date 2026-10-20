import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DialogTrigger } from 'react-aria-components/Dialog';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/atoms/Modal';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Molecules/ConfirmDialog',
  component: ConfirmDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Revoke invite?',
    children: 'Its code stops working, which can’t be undone.',
    confirmLabel: 'Revoke',
    onConfirm: () => undefined,
  },
  render: (args) => (
    <DialogTrigger>
      <Button variant="destructive">Revoke</Button>
      <Modal>
        <ConfirmDialog {...args} />
      </Modal>
    </DialogTrigger>
  ),
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: 'The invite couldn’t be revoked. Try again.',
  },
};
