import { useEffect, useState } from 'react';
import { getChatSocket } from '../lib/socket.js';

export interface LiveStatus {
  name: string;
  color: string;
  auto: boolean;
}

interface PresencePayload {
  onlineOperatorIds: string[];
  // Only carries entries for online operators with a non-default status —
  // absent from the map (but present in onlineOperatorIds) means «Онлайн».
  statuses: Record<string, LiveStatus>;
}

export function usePresence() {
  const [onlineOperatorIds, setOnlineOperatorIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, LiveStatus>>({});

  useEffect(() => {
    const socket = getChatSocket();
    const handler = (payload: PresencePayload) => {
      setOnlineOperatorIds(payload.onlineOperatorIds);
      setStatuses(payload.statuses ?? {});
    };
    socket.on('presence:operators', handler);
    return () => {
      socket.off('presence:operators', handler);
    };
  }, []);

  return { onlineOperatorIds, statuses };
}
