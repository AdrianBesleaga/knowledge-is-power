import { getMongoDB } from '../config/mongodb';
import { TimelineAnalysis, TimelineEntry, GraphVisibility } from '../types';
import { generateSlug } from '../utils/slugify';
import { ObjectId } from 'mongodb';

export class TimelineService {
  // Use only timeline_versions collection - single source of truth
  // Each document represents a version, latest version has highest version number
  private readonly COLLECTION_NAME = 'timeline_versions';

  /**
   * Save a timeline analysis to MongoDB
   * Creates version 1 if new, or updates existing timeline (replaces latest version)
   */
  async saveTimeline(
    topic: string,
    valueLabel: string,
    pastEntries: TimelineEntry[],
    presentEntry: TimelineEntry,
    predictions: any[],
    userId: string | null,
    visibility: GraphVisibility = 'private'
  ): Promise<TimelineAnalysis> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    const slug = generateSlug(topic);
    const now = new Date();

    // Check if timeline with this slug already exists
    const latestVersion = await collection.findOne(
      { slug },
      { sort: { version: -1 } }
    );

    let version = 1;
    let viewCount = 0;
    let createdAt = now;

    if (latestVersion) {
      // Use existing version number and preserve viewCount and createdAt
      version = latestVersion.version;
      viewCount = latestVersion.viewCount || 0;
      createdAt = latestVersion.createdAt instanceof Date 
        ? latestVersion.createdAt 
        : new Date(latestVersion.createdAt);
      
      // Update existing version (replace it)
      const updated = {
        topic,
        valueLabel,
        pastEntries: pastEntries.map(e => ({
          ...e,
          date: e.date instanceof Date ? e.date : new Date(e.date),
        })),
        presentEntry: {
          ...presentEntry,
          date: presentEntry.date instanceof Date ? presentEntry.date : new Date(presentEntry.date),
        },
        predictions,
        updatedAt: now,
        userId,
        visibility,
        viewCount,
        createdAt,
        version,
      };

      await collection.updateOne(
        { slug, version },
        { $set: updated }
      );

      const result = await collection.findOne({ slug, version });
      return this.mapToTimelineAnalysis(result!);
    }

    // Create new timeline (version 1)
    const timelineDoc = {
      id: new ObjectId().toString(),
      slug,
      topic,
      valueLabel,
      pastEntries: pastEntries.map(e => ({
        ...e,
        date: e.date instanceof Date ? e.date : new Date(e.date),
      })),
      presentEntry: {
        ...presentEntry,
        date: presentEntry.date instanceof Date ? presentEntry.date : new Date(presentEntry.date),
      },
      predictions,
      createdAt,
      updatedAt: now,
      userId,
      visibility,
      viewCount,
      version,
    };

    await collection.insertOne(timelineDoc);

    return this.mapToTimelineAnalysis(timelineDoc);
  }

  /**
   * Retrieve a timeline by slug (returns latest version by default)
   */
  async getTimelineBySlug(slug: string, version?: number): Promise<TimelineAnalysis | null> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    let result;
    
    if (version !== undefined) {
      // Get specific version
      result = await collection.findOne({ slug, version });
    } else {
      // Get latest version
      result = await collection.findOne(
        { slug },
        { sort: { version: -1 } }
      );
    }

    if (!result) {
      return null;
    }

    // Increment view count (on the version we're viewing)
    await collection.updateOne(
      { slug, version: result.version },
      { $inc: { viewCount: 1 } }
    );

    // Update viewCount in result for return value
    result.viewCount = (result.viewCount || 0) + 1;

    return this.mapToTimelineAnalysis(result);
  }

  /**
   * Get all versions for a timeline
   */
  async getTimelineVersions(slug: string): Promise<Array<{ version: number; createdAt: Date; presentValue: number }>> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    const versions = await collection
      .find({ slug })
      .sort({ version: -1 })
      .toArray();

    return versions.map(v => ({
      version: v.version,
      createdAt: v.createdAt instanceof Date ? v.createdAt : new Date(v.createdAt),
      presentValue: v.presentEntry?.value || 0,
    }));
  }

  /**
   * Save a new version of a timeline
   */
  async saveTimelineVersion(
    slug: string,
    topic: string,
    valueLabel: string,
    pastEntries: TimelineEntry[],
    presentEntry: TimelineEntry,
    predictions: any[],
    userId: string | null,
    visibility: GraphVisibility
  ): Promise<{ version: number; timeline: TimelineAnalysis }> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // Get current max version for this slug
    const maxVersionDoc = await collection
      .findOne({ slug }, { sort: { version: -1 } });
    
    const newVersion = maxVersionDoc ? maxVersionDoc.version + 1 : 1;
    const now = new Date();

    // Get original createdAt from first version
    const firstVersion = await collection.findOne(
      { slug },
      { sort: { version: 1 } }
    );
    const createdAt = firstVersion?.createdAt instanceof Date
      ? firstVersion.createdAt
      : firstVersion?.createdAt
        ? new Date(firstVersion.createdAt)
        : now;

    // Create new version document
    const versionDoc = {
      id: new ObjectId().toString(),
      slug,
      version: newVersion,
      topic,
      valueLabel,
      pastEntries: pastEntries.map(e => ({
        ...e,
        date: e.date instanceof Date ? e.date : new Date(e.date),
      })),
      presentEntry: {
        ...presentEntry,
        date: presentEntry.date instanceof Date ? presentEntry.date : new Date(presentEntry.date),
      },
      predictions,
      createdAt, // Preserve original creation date
      updatedAt: now,
      userId,
      visibility,
      viewCount: 0, // New version starts with 0 views
    };

    await collection.insertOne(versionDoc);

    const timeline = this.mapToTimelineAnalysis(versionDoc);
    return { version: newVersion, timeline };
  }

  /**
   * Search timelines by topic
   * Returns only the latest version of each timeline (deduplicated by slug)
   */
  async searchTimelinesByTopic(
    topic: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ timelines: TimelineAnalysis[]; total: number }> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    const query = {
      $or: [
        { topic: { $regex: topic, $options: 'i' } },
        { slug: { $regex: topic, $options: 'i' } },
      ],
    };

    // Use aggregation to group by slug and get the latest version
    const pipeline = [
      { $match: query },
      {
        $sort: { 
          slug: 1,
          version: -1, // Sort by version descending to get latest first
          updatedAt: -1 // Then by updatedAt as tiebreaker
        }
      },
      {
        $group: {
          _id: '$slug',
          doc: { $first: '$$ROOT' } // Get the first (latest) document for each slug
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' } // Replace root with the document
      },
      {
        $sort: { updatedAt: -1 } // Sort final results by updatedAt
      },
      { $skip: offset },
      { $limit: limit }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    // Get total count of unique slugs
    const totalPipeline = [
      { $match: query },
      {
        $sort: { 
          slug: 1,
          version: -1,
          updatedAt: -1
        }
      },
      {
        $group: {
          _id: '$slug',
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $count: 'total'
      }
    ];

    const totalResult = await collection.aggregate(totalPipeline).toArray();
    const total = totalResult[0]?.total || 0;

    const timelines = results.map(doc => this.mapToTimelineAnalysis(doc));

    return { timelines, total };
  }

  /**
   * Get all timelines for a user
   * Returns only the latest version of each timeline (deduplicated by slug)
   */
  async getUserTimelines(userId: string): Promise<TimelineAnalysis[]> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // Use aggregation to group by slug and get the latest version
    const pipeline = [
      { $match: { userId } },
      {
        $sort: { 
          slug: 1,
          version: -1, // Sort by version descending to get latest first
          updatedAt: -1 // Then by updatedAt as tiebreaker
        }
      },
      {
        $group: {
          _id: '$slug',
          doc: { $first: '$$ROOT' } // Get the first (latest) document for each slug
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' } // Replace root with the document
      },
      {
        $sort: { updatedAt: -1 } // Sort final results by updatedAt
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    return results.map(doc => this.mapToTimelineAnalysis(doc));
  }

  /**
   * Update timeline visibility
   * Updates all versions of the timeline to maintain consistency
   */
  async updateTimelineVisibility(
    slug: string,
    userId: string,
    visibility: GraphVisibility
  ): Promise<TimelineAnalysis | null> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // Verify ownership by checking latest version
    const latestVersion = await collection.findOne(
      { slug, userId },
      { sort: { version: -1 } }
    );
    
    if (!latestVersion) {
      return null;
    }

    // Update all versions to maintain consistency
    await collection.updateMany(
      { slug, userId },
      { $set: { visibility, updatedAt: new Date() } }
    );

    // Return the latest version
    const result = await collection.findOne(
      { slug },
      { sort: { version: -1 } }
    );
    return result ? this.mapToTimelineAnalysis(result) : null;
  }

  /**
   * Get popular timelines based on view count
   * Returns only the latest version of each timeline (deduplicated by slug)
   */
  async getPopularTimelines(
    limit: number = 20,
    days: number = 30
  ): Promise<TimelineAnalysis[]> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // Use aggregation to get latest version of each timeline, filtered by public status
    // Note: We don't filter by date since timelines are a newer feature and there may be fewer of them
    const pipeline = [
      {
        $match: {
          visibility: { $in: ['public', 'premium'] }
        }
      },
      {
        $sort: { 
          slug: 1,
          version: -1, // Sort by version descending to get latest first
          updatedAt: -1
        }
      },
      {
        $group: {
          _id: '$slug',
          doc: { $first: '$$ROOT' } // Get the first (latest) document for each slug
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' } // Replace root with the document
      },
      {
        $addFields: {
          viewCount: { $ifNull: ['$viewCount', 0] } // Ensure viewCount is never null
        }
      },
      {
        $sort: { viewCount: -1, updatedAt: -1 } // Sort by view count, then by updatedAt
      },
      { $limit: limit }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    return results.map(doc => this.mapToTimelineAnalysis(doc));
  }

  /**
   * Check if a timeline exists
   */
  async timelineExists(slug: string): Promise<boolean> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    const count = await collection.countDocuments({ slug });
    return count > 0;
  }

  /**
   * Delete a timeline (all versions)
   * Only the owner can delete their timeline
   */
  async deleteTimeline(slug: string, userId: string): Promise<boolean> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // Verify ownership by checking if any version exists with this userId
    const existingTimeline = await collection.findOne(
      { slug, userId },
      { sort: { version: -1 } }
    );

    if (!existingTimeline) {
      return false; // Timeline doesn't exist or user doesn't own it
    }

    // Delete all versions of the timeline
    const result = await collection.deleteMany({ slug, userId });

    return result.deletedCount > 0;
  }

  /**
   * Map MongoDB document to TimelineAnalysis
   */
  private mapToTimelineAnalysis(doc: any): TimelineAnalysis {
    return {
      id: doc.id || doc._id?.toString() || '',
      slug: doc.slug,
      topic: doc.topic,
      valueLabel: doc.valueLabel,
      pastEntries: (doc.pastEntries || []).map((e: any) => ({
        ...e,
        date: e.date instanceof Date ? e.date : new Date(e.date),
      })),
      presentEntry: {
        ...doc.presentEntry,
        date: doc.presentEntry.date instanceof Date
          ? doc.presentEntry.date
          : new Date(doc.presentEntry.date),
      },
      predictions: doc.predictions || [],
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
      userId: doc.userId || null,
      visibility: doc.visibility || 'private',
      viewCount: doc.viewCount || 0,
      version: doc.version || 1,
    };
  }
}

export const timelineService = new TimelineService();

