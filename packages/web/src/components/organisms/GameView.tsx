'use client';

import { useRealtimeConnection } from '@/hooks/useRealtimeConnection';

export function GameView() {
  useRealtimeConnection();

  return (
    <div className="h-[75vh] rounded-md bg-accent">
      {/* Placeholder for the game area */}
    </div>
  );
}
