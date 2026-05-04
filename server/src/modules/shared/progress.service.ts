import { Response } from 'express';
import logger from '../../middlewares/logger.middleware';

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
 * Buffers events emitted before the client connects, then flushes on connect.
 * Fixes race condition: server emits events before client SSE connection is ready.
 */
export class ProgressService {
  private static clients = new Map<string, Response[]>();
  private static taskIdCounter = 0;

  /** Buffer: lưu tạm events khi chưa có client nào connect */
  private static buffers = new Map<string, string[]>();

  /** Auto-cleanup buffer sau 10 phút nếu không có client */
  private static readonly BUFFER_TTL_MS = 10 * 60 * 1000;

  /** Interval heartbeat ngăn proxy/browser drop SSE khi task chạy lâu không có event */
  private static heartbeats = new WeakMap<Response, NodeJS.Timeout>();
  private static readonly HEARTBEAT_MS = 15_000;

  private static startHeartbeat(res: Response): void {
    if (this.heartbeats.has(res)) return;
    const interval = setInterval(() => {
      try {
        // Comment line `:` — EventSource bỏ qua, nhưng giữ TCP connection alive
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        this.stopHeartbeat(res);
      }
    }, this.HEARTBEAT_MS);
    this.heartbeats.set(res, interval);
  }

  private static stopHeartbeat(res: Response): void {
    const interval = this.heartbeats.get(res);
    if (interval) {
      clearInterval(interval);
      this.heartbeats.delete(res);
    }
  }

  static generateTaskId(prefix = 'task'): string {
    this.taskIdCounter++;
    return `${prefix}_${Date.now()}_${this.taskIdCounter}`;
  }

  /** Register an SSE client — flush buffered events immediately */
  static addClient(taskId: string, res: Response): void {
    const clients = this.clients.get(taskId) || [];
    clients.push(res);
    this.clients.set(taskId, clients);

    // Flush any events emitted before this client connected
    const buffered = this.buffers.get(taskId);
    if (buffered && buffered.length > 0) {
      for (const payload of buffered) {
        try { res.write(payload); } catch { /* disconnected */ }
      }
      // Nếu buffer chứa complete/error event → đóng connection luôn
      const lastPayload = buffered[buffered.length - 1];
      if (lastPayload.startsWith('event: complete') || lastPayload.startsWith('event: error')) {
        try { res.end(); } catch { /* ignore */ }
        this.clients.delete(taskId);
        this.buffers.delete(taskId);
        return;
      }
    }

    // Start heartbeat để TCP/proxy không drop connection khi task chạy lâu im lặng
    this.startHeartbeat(res);

    logger.debug(`SSE client added for task ${taskId}, buffered: ${buffered?.length ?? 0}`);
  }

  static removeClient(taskId: string, res: Response): void {
    this.stopHeartbeat(res);
    const clients = this.clients.get(taskId);
    if (clients) {
      const idx = clients.indexOf(res);
      if (idx >= 0) clients.splice(idx, 1);
      if (clients.length === 0) this.clients.delete(taskId);
    }
  }

  /** Emit progress — buffer nếu chưa có client */
  static emit(taskId: string, data: ProgressData): void {
    const payload = `event: progress\ndata: ${JSON.stringify(data)}\n\n`;

    // Buffer luôn (để flush khi client connect muộn)
    const buf = this.buffers.get(taskId) || [];
    buf.push(payload);
    this.buffers.set(taskId, buf);

    // Gửi ngay nếu có client đang connected
    const clients = this.clients.get(taskId);
    if (clients && clients.length > 0) {
      for (const res of clients) {
        try { res.write(payload); } catch { /* disconnected */ }
      }
    }

    // Auto-cleanup buffer sau TTL
    setTimeout(() => {
      if (!this.clients.has(taskId)) this.buffers.delete(taskId);
    }, this.BUFFER_TTL_MS);
  }

  /** Complete — buffer event rồi close clients */
  static complete(taskId: string, result?: any): void {
    const payload = `event: complete\ndata: ${JSON.stringify({ step: 0, total: 0, percent: 100, message: 'Done', done: true, result })}\n\n`;

    // Buffer để flush nếu client connect sau khi complete
    const buf = this.buffers.get(taskId) || [];
    buf.push(payload);
    this.buffers.set(taskId, buf);

    const clients = this.clients.get(taskId);
    if (clients && clients.length > 0) {
      for (const res of clients) {
        this.stopHeartbeat(res);
        try { res.write(payload); res.end(); } catch { /* disconnected */ }
      }
    }
    this.clients.delete(taskId);
    logger.debug(`SSE task ${taskId} completed`);

    // Cleanup buffer sau 30s (đủ thời gian cho client connect muộn)
    setTimeout(() => this.buffers.delete(taskId), 30_000);
  }

  /** Error — buffer event rồi close clients */
  static error(taskId: string, errorMessage: string): void {
    const payload = `event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`;

    const buf = this.buffers.get(taskId) || [];
    buf.push(payload);
    this.buffers.set(taskId, buf);

    const clients = this.clients.get(taskId);
    if (clients && clients.length > 0) {
      for (const res of clients) {
        this.stopHeartbeat(res);
        try { res.write(payload); res.end(); } catch { /* disconnected */ }
      }
    }
    this.clients.delete(taskId);

    setTimeout(() => this.buffers.delete(taskId), 30_000);
  }

  static hasClients(taskId: string): boolean {
    const clients = this.clients.get(taskId);
    return !!clients && clients.length > 0;
  }
}
