'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { realtimeSocket } from '@/lib/client/realtime';

export type RealtimeStatus =
  'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

type RealtimeContextValue = {
  socket: Socket;
  status: RealtimeStatus;
  error: Error | null;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      setStatus('connected');
      setError(null);
      console.info('Realtime connected:', realtimeSocket.id);
    };

    const handleDisconnect = (reason: string) => {
      setStatus('disconnected');
      console.info('Realtime disconnected:', reason);
    };

    const handleConnectError = (connectionError: Error) => {
      setStatus('error');
      setError(connectionError);
      console.error('Realtime connection failed:', connectionError.message);
    };

    realtimeSocket.on('connect', handleConnect);
    realtimeSocket.on('disconnect', handleDisconnect);
    realtimeSocket.on('connect_error', handleConnectError);

    realtimeSocket.connect();

    return () => {
      realtimeSocket.off('connect', handleConnect);
      realtimeSocket.off('disconnect', handleDisconnect);
      realtimeSocket.off('connect_error', handleConnectError);
      realtimeSocket.disconnect();
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        socket: realtimeSocket,
        status,
        error,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }

  return context;
}
