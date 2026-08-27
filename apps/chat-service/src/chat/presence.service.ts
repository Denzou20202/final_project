import { Injectable } from '@nestjs/common';

// In-memory presence tracking — correct for a single chat-service instance
// (current deployment target). Scaling to multiple instances would need this
// backed by Redis (e.g. a set with TTL'd heartbeats) instead of process memory.
//
// Tracks a connection count per operator, not just a boolean — an operator
// with two tabs open shouldn't flip to "offline" when only one of them closes.
@Injectable()
export class PresenceService {
  private readonly connectionsByOperator = new Map<string, number>();

  /** Returns true if this operator just transitioned online (0 -> 1 connections). */
  markConnected(operatorId: string): boolean {
    const count = this.connectionsByOperator.get(operatorId) ?? 0;
    this.connectionsByOperator.set(operatorId, count + 1);
    return count === 0;
  }

  /** Returns true if this operator just transitioned offline (their last connection closed). */
  markDisconnected(operatorId: string): boolean {
    const count = this.connectionsByOperator.get(operatorId) ?? 0;
    if (count <= 1) {
      this.connectionsByOperator.delete(operatorId);
      return count === 1;
    }
    this.connectionsByOperator.set(operatorId, count - 1);
    return false;
  }

  getOnlineOperatorIds(): string[] {
    return [...this.connectionsByOperator.keys()];
  }
}
