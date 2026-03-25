import { Request, Response } from 'express';
import patientContextService from '../services/patientContext';
import logger from '../utils/logger';

export const getPatientContext = async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'test-user';

  try {
    const context = await patientContextService.getContext(userId);
    return res.json({ success: true, context: context ?? '' });
  } catch (error: any) {
    logger.error('Error retrieving patient context', { error: error?.message, userId });
    return res.status(500).json({ success: false, error: 'Failed to retrieve patient context' });
  }
};

export const savePatientContext = async (req: Request, res: Response) => {
  const userId = req.body.userId || 'test-user';
  // `context` is validated and trimmed by Zod middleware before reaching here
  const context: string = req.body.context;

  try {
    await patientContextService.saveContext(userId, context);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Error saving patient context', { error: error?.message, userId });
    return res.status(500).json({ success: false, error: 'Failed to save patient context' });
  }
};
