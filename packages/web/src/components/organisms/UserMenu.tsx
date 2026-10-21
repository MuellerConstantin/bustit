'use client';

import type { OwnUser } from '@bustit/shared';
import { LogOut, ShieldUser } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { logoutAction } from '@/actions/auth';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import {
  Menu,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/atoms/Menu';
import { Popover } from '@/components/atoms/Popover';
import { useRouter } from '@/i18n/navigation';

interface UserMenuProps {
  username: string;
  role: OwnUser['role'];
}

export function UserMenu({ username, role }: UserMenuProps) {
  const t = useTranslations('components.userMenu');
  const router = useRouter();

  const logout = async () => {
    await logoutAction();
    router.replace('/login');
  };

  return (
    <MenuTrigger>
      <Button
        variant="icon"
        aria-label={t('label')}
        className="rounded-full p-0.5"
      >
        <Avatar name={username} />
      </Button>
      <Popover placement="bottom end" className="min-w-56">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Avatar name={username} className="size-10 text-base" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{username}</span>
            <span className="text-xs text-muted-foreground">
              {t(`roles.${role}`)}
            </span>
          </div>
        </div>
        <Menu aria-label={t('label')}>
          {role === 'admin' && (
            <>
              <MenuItem id="boc" textValue={t('boc')} href="/boc">
                <ShieldUser
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                {t('boc')}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem id="logout" textValue={t('logout')} onAction={logout}>
            <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t('logout')}
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
