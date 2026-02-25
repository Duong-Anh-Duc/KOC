import { Response } from 'express';
import logger from '../middlewares/logger.middleware';

interface ProgressData {
  step: number;
  total: number;
  percent: number;
  message: string;
  done?: boolean;
  result?: any;
}

/**
 * SSE-based progress tracking service.
 * Allows long-running tasks to report progress to connected clients.
 */
export class ProgressService {
  private static clients = new Map<string, Response[]>();
  private static taskIdCounter = 0;

  /** Generate a unique task ID */
  static generateTaskId(prefix = 'task'): string {
    this.taskIdCounter++;
    return `${prefix}_${Date.now()}_${this.taskIdCounter}`;
  }

  /** Register an SSE client for a task */
  static addClient(taskId: string, res: Response): void {
    const clients = this.clients.get(taskId) || [];
    clients.push(res);
    this.clients.set(taskId, clients);
    logger.debug(`SSE client added for task ${taskId}, total clients: ${clients.length}`);
  }

  /** Remove an SSE client */
  static removeClient(taskId: string, res: Response): void {
    const clients = this.clients.get(taskId);
    if (clients) {
      const idx = clients.indexOf(res);
      if (idx >= 0) clients.splice(idx, 1);
      if (clients.length === 0) this.clients.delete(taskId);
    }
  }

  /** Send progress update to all clients of a task */
  static emit(taskId: string, data: ProgressData): void {
    const clients = this.clients.get(taskId);
    if (clients && clients.length > 0) {
      const payload = `event: progress\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) {
        try {
          res.write(payload);
        } catch {
          // Client disconnected
        }
      }
    }
  }

  /** Send final completion event and close all clients */
  static complete(taskId: string, result?: any): void {
    const clients = this.clients.get(taskId);
    if (clients && clients.length > 0) {
      const payload = `event: complete\ndata: ${JSON.stringify({ step: 0, total: 0, percent: 100, message: 'Done', done: true, result })}\n\n`;
      for (const res of clients) {
        try {
          res.write(payload);
          res.end();
        } catch {
          // Client disconnected
        }
      }
    }
    this.clients.delete(taskId);
    logger.debug(`SSE task ${taskId} completed and cleaned up`);
  }

  /** Send error event and close all clients */
  static error(taskId: string, errorMessage: string): void {
    const clients = this.clients.get(taskId);
    if (clients && clients.length > 0) {
      const payload = `event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`;
      for (const res of clients) {
        try {
          res.write(payload);
          res.end();
        } catch {
          // Client disconnected
        }
      }
    }
    this.clients.delete(taskId);
  }

  /** Check if any clients are listening to a task */
  static hasClients(taskId: string): boolean {
    const clients = this.clients.get(taskId);
    return !!clients && clients.length > 0;
  }
}
