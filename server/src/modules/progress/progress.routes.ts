import { Request, Response, Router } from 'express';
import { ProgressService } from '../shared/progress.service';

const router = Router();

/**
 * GET /api/progress/:taskId
 * SSE endpoint for receiving real-time progress updates
 */
router.get('/:taskId', (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Send initial progress event to confirm connection
  res.write(`event: progress\ndata: ${JSON.stringify({ step: 0, total: 0, percent: 0, message: 'Connected', done: false })}\n\n`);

  // Register client
  ProgressService.addClient(taskId, res);

  // Clean up on disconnect
  req.on('close', () => {
    ProgressService.removeClient(taskId, res);
  });
});

export default router;
