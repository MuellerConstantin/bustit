import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LogOut, Settings } from 'lucide-react';
import { Button } from './Button';
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from './Menu';
import { Popover } from './Popover';

const meta = {
  title: 'Atoms/Menu',
  component: Menu,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <MenuTrigger>
      <Button variant="secondary">Open menu</Button>
      <Popover placement="bottom end" className="min-w-48">
        <Menu aria-label="Example menu">
          <MenuItem id="settings" textValue="Settings">
            <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
            Settings
          </MenuItem>
          <MenuItem id="disabled" isDisabled>
            Disabled
          </MenuItem>
          <MenuSeparator />
          <MenuItem id="logout" textValue="Sign out">
            <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden />
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  ),
};
