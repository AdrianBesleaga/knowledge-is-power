import { Router, Response } from 'express';
import { graphService } from '../services/graphService';
import { timelineService } from '../services/timelineService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { creditService } from '../services/creditService';

const router = Router();

/**
 * GET /api/user/graphs
 * Get all graphs for the authenticated user
 */
router.get('/graphs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const graphs = await graphService.getUserGraphs(req.user.uid);

    res.json({
      success: true,
      graphs,
    });
  } catch (error) {
    console.error('Error retrieving user graphs:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user graphs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/user/timelines
 * Get all timelines for the authenticated user
 */
router.get('/timelines', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const timelines = await timelineService.getUserTimelines(req.user.uid);

    res.json({
      success: true,
      timelines,
    });
  } catch (error) {
    console.error('Error retrieving user timelines:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user timelines',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/user/profile
 * Get user profile information including credits
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Ensure user exists in database and get credit info
    const user = await creditService.getOrCreateUser(req.user.uid, req.user.email || '');

    res.json({
      success: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    res.status(500).json({
      error: 'Failed to retrieve user profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/user/credits
 * Get user's credit balance
 */
router.get('/credits', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const credits = await creditService.getCredits(req.user.uid);

    res.json({
      success: true,
      credits,
    });
  } catch (error) {
    console.error('Error retrieving credits:', error);
    res.status(500).json({
      error: 'Failed to retrieve credits',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/user/credits/history
 * Get user's credit transaction history
 */
router.get('/credits/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const history = await creditService.getCreditHistory(req.user.uid, limit);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Error retrieving credit history:', error);
    res.status(500).json({
      error: 'Failed to retrieve credit history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

