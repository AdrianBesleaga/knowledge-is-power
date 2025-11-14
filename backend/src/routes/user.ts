import { Router, Response } from 'express';
import { graphService } from '../services/graphService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

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
 * GET /api/user/profile
 * Get user profile information
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.json({
      success: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
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

export default router;

