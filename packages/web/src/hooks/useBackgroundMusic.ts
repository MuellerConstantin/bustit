'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bustit:music';
const VOLUME = 0.25;

/**
 * Plays a looping track while the caller is mounted. The choice to turn it
 * off is remembered in the browser. Playing may be refused until the user
 * has interacted with the page, which the toggle then makes up for.
 */
export function useBackgroundMusic(src: string) {
  const [isOn, setIsOn] = useState(true);

  // Read after mount, so the server's and the first client render agree.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'off') {
        setIsOn(false);
      }
    } catch {
      // Storage can be blocked, the music then simply starts on.
    }
  }, []);

  useEffect(() => {
    if (!isOn) {
      return;
    }

    const audio = new Audio(src);

    audio.loop = true;
    audio.volume = VOLUME;
    audio.play().catch(() => {
      // Refused without a user gesture; the toggle starts it later.
    });

    return () => audio.pause();
  }, [isOn, src]);

  const toggle = useCallback(() => {
    setIsOn(!isOn);

    try {
      localStorage.setItem(STORAGE_KEY, isOn ? 'off' : 'on');
    } catch {
      // Not remembered, the toggle still works for this visit.
    }
  }, [isOn]);

  return { isOn, toggle };
}
