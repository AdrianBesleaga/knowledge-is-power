import { Router, Request, Response } from 'express';
import { predictionService } from '../services/predictionService';
import { timelineService } from '../services/timelineService';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';
import { GenerateTimelineRequest } from '../types';
import { creditService, InsufficientCreditsError } from '../services/creditService';

const router = Router();

/**
 * POST /api/timeline/generate
 * Generate a timeline analysis for a topic and automatically save it (requires authentication)
 * Costs 1 credit per generation
 */
router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, isPublic } = req.body as GenerateTimelineRequest & { isPublic?: boolean };

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    if (topic.length > 200) {
      res.status(400).json({ error: 'Topic is too long (max 200 characters)' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Ensure user exists in database
    await creditService.getOrCreateUser(req.user.uid, req.user.email || '');

    // Check and deduct credits (1 credit per timeline/prediction generation)
    try {
      const remainingCredits = await creditService.deductCredits(
        req.user.uid,
        1,
        `Generated timeline: "${topic.trim()}"`
      );
      console.log(`[API] Credit deducted for user ${req.user.uid}. Remaining: ${remainingCredits}`);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: error.message,
          code: 'INSUFFICIENT_CREDITS'
        });
        return;
      }
      throw error;
    }

    console.log(`[API] Timeline generation request received for topic: "${topic.trim()}" by user: ${req.user.uid}`);

    // Generate timeline analysis using AI
    const analysis = await predictionService.generateTimelineAnalysis(topic.trim());

    console.log(`[API] Timeline generation completed successfully: ${analysis.pastEntries.length} past entries, ${analysis.predictions.length} prediction intervals`);

    // Automatically save the timeline
    console.log(`[API] Automatically saving timeline for topic: "${topic.trim()}"`);
    const savedTimeline = await timelineService.saveTimeline(
      analysis.topic,
      analysis.valueLabel,
      analysis.pastEntries,
      analysis.presentEntry,
      analysis.predictions,
      req.user.uid,
      isPublic === true
    );

    console.log(`[API] Timeline saved successfully with slug: "${savedTimeline.slug}"`);

    res.json({
      success: true,
      topic: savedTimeline.topic,
      valueLabel: savedTimeline.valueLabel,
      pastEntries: savedTimeline.pastEntries,
      presentEntry: savedTimeline.presentEntry,
      predictions: savedTimeline.predictions,
      timeline: savedTimeline,
      url: `/timeline/${savedTimeline.slug}`,
    });
  } catch (error) {
    console.error('[API] Error generating timeline:', error);
    res.status(500).json({
      error: 'Failed to generate timeline analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/timeline/save
 * Save a timeline analysis (requires authentication)
 */
router.post('/save', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, valueLabel, pastEntries, presentEntry, predictions, isPublic } = req.body;

    if (!topic || !valueLabel || !pastEntries || !presentEntry || !predictions) {
      res.status(400).json({ error: 'Topic, valueLabel, pastEntries, presentEntry, and predictions are required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Save to MongoDB
    const savedTimeline = await timelineService.saveTimeline(
      topic,
      valueLabel,
      pastEntries,
      presentEntry,
      predictions,
      req.user.uid,
      isPublic === true
    );

    res.json({
      success: true,
      timeline: savedTimeline,
      url: `/timeline/${savedTimeline.slug}`,
    });
  } catch (error) {
    console.error('Error saving timeline:', error);
    res.status(500).json({
      error: 'Failed to save timeline',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/timeline/popular
 * Get popular timelines based on view count
 */
router.get('/popular', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, days } = req.query;

    const searchLimit = limit ? Math.floor(Number(limit)) || 20 : 20;
    const searchDays = days ? Math.floor(Number(days)) || 30 : 30;

    const timelines = await timelineService.getPopularTimelines(searchLimit, searchDays);

    res.json({
      success: true,
      timelines,
    });
  } catch (error) {
    console.error('Error getting popular timelines:', error);
    res.status(500).json({ 
      error: 'Failed to get popular timelines',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/timeline/topic/:topic
 * Search timelines by topic
 */
router.get('/topic/:topic', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { topic } = req.params;
    const { limit, offset } = req.query;

    if (!topic) {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    const searchLimit = limit ? Math.floor(Number(limit)) || 20 : 20;
    const searchOffset = offset ? Math.floor(Number(offset)) || 0 : 0;

    const result = await timelineService.searchTimelinesByTopic(
      topic,
      searchLimit,
      searchOffset
    );

    res.json({
      success: true,
      timelines: result.timelines,
      total: result.total,
      limit: searchLimit,
      offset: searchOffset,
    });
  } catch (error) {
    console.error('Error searching timelines:', error);
    res.status(500).json({
      error: 'Failed to search timelines',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/timeline/:slug
 * Retrieve a timeline by slug (public, optional auth)
 * Supports optional ?version= query parameter to get specific version
 */
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    console.log(`[API] Timeline retrieval request for slug: "${slug}"${version ? `, version: ${version}` : ' (latest)'}`);
    const timeline = await timelineService.getTimelineBySlug(slug, version);

    if (!timeline) {
      console.log(`[API] Timeline not found for slug: "${slug}"${version ? `, version: ${version}` : ''}`);
      res.status(404).json({ error: 'Timeline not found' });
      return;
    }

    // Check if timeline is public or belongs to the requesting user
    if (!timeline.isPublic && (!req.user || req.user.uid !== timeline.userId)) {
      res.status(403).json({ error: 'Access denied to private timeline' });
      return;
    }

    res.json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error('Error retrieving timeline:', error);
    res.status(500).json({
      error: 'Failed to retrieve timeline',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/timeline/:slug/visibility
 * Update timeline visibility (requires authentication, owner only)
 */
router.patch('/:slug/visibility', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { isPublic } = req.body;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (typeof isPublic !== 'boolean') {
      res.status(400).json({ error: 'isPublic must be a boolean' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const updatedTimeline = await timelineService.updateTimelineVisibility(
      slug,
      req.user.uid,
      isPublic
    );

    if (!updatedTimeline) {
      res.status(404).json({ error: 'Timeline not found or access denied' });
      return;
    }

    res.json({
      success: true,
      timeline: updatedTimeline,
    });
  } catch (error) {
    console.error('Error updating timeline visibility:', error);
    res.status(500).json({
      error: 'Failed to update timeline visibility',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/timeline/:slug/reprocess
 * Reprocess timeline: Get current value and regenerate predictions (requires authentication, owner only)
 * Returns the reprocessed data but does NOT save it automatically
 */
router.post('/:slug/reprocess', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    console.log(`[API] Timeline reprocess request for slug: "${slug}" by user: ${req.user.uid}`);

    // Get existing timeline
    const existingTimeline = await timelineService.getTimelineBySlug(slug);
    if (!existingTimeline) {
      res.status(404).json({ error: 'Timeline not found' });
      return;
    }

    // Check ownership
    if (existingTimeline.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied. You can only reprocess your own timelines.' });
      return;
    }

    // Reprocess: Get current value and regenerate predictions
    const { presentEntry, predictions } = await predictionService.reprocessTimeline(
      existingTimeline.topic,
      existingTimeline.valueLabel,
      existingTimeline.pastEntries,
      existingTimeline.presentEntry,
      existingTimeline.predictions
    );

    console.log(`[API] Timeline reprocess completed successfully (not saved yet)`);

    res.json({
      success: true,
      presentEntry,
      predictions,
      previousValue: existingTimeline.presentEntry.value,
      newValue: presentEntry.value,
      valueChange: presentEntry.value - existingTimeline.presentEntry.value,
    });
  } catch (error) {
    console.error('[API] Error reprocessing timeline:', error);
    res.status(500).json({
      error: 'Failed to reprocess timeline',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/timeline/:slug/save-version
 * Save reprocessed timeline as a new version (requires authentication, owner only)
 */
router.post('/:slug/save-version', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { presentEntry, predictions } = req.body;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (!presentEntry || !predictions) {
      res.status(400).json({ error: 'presentEntry and predictions are required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    console.log(`[API] Save timeline version request for slug: "${slug}" by user: ${req.user.uid}`);

    // Get existing timeline
    const existingTimeline = await timelineService.getTimelineBySlug(slug);
    if (!existingTimeline) {
      res.status(404).json({ error: 'Timeline not found' });
      return;
    }

    // Check ownership
    if (existingTimeline.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied. You can only save versions of your own timelines.' });
      return;
    }

    // Save as new version
    const { version, timeline } = await timelineService.saveTimelineVersion(
      slug,
      existingTimeline.topic,
      existingTimeline.valueLabel,
      existingTimeline.pastEntries,
      presentEntry,
      predictions,
      req.user.uid,
      existingTimeline.isPublic
    );

    console.log(`[API] Timeline version ${version} saved successfully`);

    res.json({
      success: true,
      version,
      timeline,
      previousValue: existingTimeline.presentEntry.value,
      newValue: presentEntry.value,
      valueChange: presentEntry.value - existingTimeline.presentEntry.value,
    });
  } catch (error) {
    console.error('[API] Error saving timeline version:', error);
    res.status(500).json({
      error: 'Failed to save timeline version',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/timeline/:slug/versions
 * Get all versions for a timeline (requires authentication, owner only)
 */
router.get('/:slug/versions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get existing timeline to check ownership
    const existingTimeline = await timelineService.getTimelineBySlug(slug);
    if (!existingTimeline) {
      res.status(404).json({ error: 'Timeline not found' });
      return;
    }

    // Check ownership
    if (existingTimeline.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied. You can only view versions of your own timelines.' });
      return;
    }

    const versions = await timelineService.getTimelineVersions(slug);

    res.json({
      success: true,
      versions,
    });
  } catch (error) {
    console.error('[API] Error getting timeline versions:', error);
    res.status(500).json({
      error: 'Failed to get timeline versions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/timeline/:slug
 * Delete a timeline (all versions) - requires authentication, owner only, private timelines only
 */
router.delete('/:slug', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    console.log(`[API] Timeline deletion request for slug: "${slug}" by user: ${req.user.uid}`);

    // Get existing timeline to check ownership and visibility
    const existingTimeline = await timelineService.getTimelineBySlug(slug);
    if (!existingTimeline) {
      res.status(404).json({ error: 'Timeline not found' });
      return;
    }

    // Check ownership
    if (existingTimeline.userId !== req.user.uid) {
      res.status(403).json({ error: 'Access denied. You can only delete your own timelines.' });
      return;
    }

    // Only allow deletion of private timelines
    if (existingTimeline.isPublic) {
      res.status(400).json({ error: 'Cannot delete public timelines. Make it private first.' });
      return;
    }

    // Delete the timeline (all versions)
    const deleted = await timelineService.deleteTimeline(slug, req.user.uid);

    if (!deleted) {
      res.status(404).json({ error: 'Timeline not found or could not be deleted' });
      return;
    }

    console.log(`[API] Timeline deleted successfully: "${slug}"`);

    res.json({
      success: true,
      message: 'Timeline deleted successfully',
    });
  } catch (error) {
    console.error('[API] Error deleting timeline:', error);
    res.status(500).json({
      error: 'Failed to delete timeline',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

