'use client';

import { type RefObject, useCallback, useEffect, useState } from 'react';

/**
 * Lets one element take the whole screen. Where the browser has no fullscreen
 * for it, e.g. on an iPhone, the element only fills the window instead, which
 * the caller styles with `isFocused`. Escape ends either mode.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const sync = () => setIsFocused(document.fullscreenElement === ref.current);

    document.addEventListener('fullscreenchange', sync);

    return () => document.removeEventListener('fullscreenchange', sync);
  }, [ref]);

  // Native fullscreen ends on Escape by itself, the window fill needs a key handler.
  useEffect(() => {
    if (!isFocused || document.fullscreenElement) {
      return;
    }

    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFocused(false);
      }
    };

    document.addEventListener('keydown', close);

    return () => document.removeEventListener('keydown', close);
  }, [isFocused]);

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();

      return;
    }

    if (isFocused) {
      setIsFocused(false);

      return;
    }

    const element = ref.current;

    if (element && document.fullscreenEnabled) {
      // The browser may refuse, e.g. outside of a user gesture, then the window fill takes over.
      const entered = await element.requestFullscreen().then(
        () => true,
        () => false,
      );

      if (entered) {
        return;
      }
    }

    setIsFocused(true);
  }, [isFocused, ref]);

  return { isFocused, toggle };
}
