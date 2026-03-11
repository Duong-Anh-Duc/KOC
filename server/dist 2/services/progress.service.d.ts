import { Response } from 'express';
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
export declare class ProgressService {
    private static clients;
    private static taskIdCounter;
    /** Generate a unique task ID */
    static generateTaskId(prefix?: string): string;
    /** Register an SSE client for a task */
    static addClient(taskId: string, res: Response): void;
    /** Remove an SSE client */
    static removeClient(taskId: string, res: Response): void;
    /** Send progress update to all clients of a task */
    static emit(taskId: string, data: ProgressData): void;
    /** Send final completion event and close all clients */
    static complete(taskId: string, result?: any): void;
    /** Send error event and close all clients */
    static error(taskId: string, errorMessage: string): void;
    /** Check if any clients are listening to a task */
    static hasClients(taskId: string): boolean;
}
export {};
//# sourceMappingURL=progress.service.d.ts.map