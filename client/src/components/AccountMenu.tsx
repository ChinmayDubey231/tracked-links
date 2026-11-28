import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { PublicUser } from '@tracked-links/shared';
import styles from './AccountMenu.module.css';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[words.length - 1]![0]!;
  return letters.toUpperCase();
}

/** Account button with a small disclosure menu. Account settings are not designed yet. */
export function AccountMenu({ user, onLogout }: { user: PublicUser | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatar}
        aria-label={user ? `Account menu for ${user.name}` : 'Account menu'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{user ? initials(user.name) : '…'}</span>
      </button>
      <div id={menuId} className={styles.menu} hidden={!open}>
        {user && (
          <div className={styles.who}>
            <span className={styles.name}>{user.name}</span>
            <span className={styles.email}>{user.demoExpiresAt ? 'Demo account' : user.email}</span>
          </div>
        )}
        <Link to="/help" className={styles.item} onClick={() => setOpen(false)}>
          Help
        </Link>
        <button type="button" className={styles.item} onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
