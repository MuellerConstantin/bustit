import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DialogTrigger } from 'react-aria-components/Dialog';
import { Button } from './Button';
import { Dialog, DialogHeading } from './Dialog';
import { Modal } from './Modal';

const meta = {
  title: 'Atoms/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithDialog: Story = {
  render: () => (
    <DialogTrigger>
      <Button>Open dialog</Button>
      <Modal>
        <Dialog>
          {({ close }) => (
            <>
              <DialogHeading>Dialog title</DialogHeading>
              <p className="text-sm text-muted-foreground">
                Some text that explains what the dialog is about.
              </p>
              <Button className="self-end" onPress={close}>
                Done
              </Button>
            </>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  ),
};
