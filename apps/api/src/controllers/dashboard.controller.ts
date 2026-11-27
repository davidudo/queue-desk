import type { Request, Response } from 'express';
import { dashboardRepository } from '../repositories/dashboard.repository.js';

export const dashboardController = {
  async summary(req: Request, res: Response): Promise<void> {
    const summary = await dashboardRepository.getSummary();
    res.status(200).json({
      data: summary,
      requestId: req.requestId,
    });
  },
};
