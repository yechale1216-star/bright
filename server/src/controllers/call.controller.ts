import { Response, NextFunction } from 'express';
import * as callService from '../services/call.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const logCall = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const call = await callService.logCall({
      ...req.body,
      userId
    });

    res.status(201).json({ success: true, data: call });
  } catch (error) {
    next(error);
  }
};

export const getCallHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const history = await callService.getCallHistory(undefined, req.query.userId as string);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

