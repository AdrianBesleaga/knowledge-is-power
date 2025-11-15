import { getMongoDB } from '../config/mongodb';
import { TimelineAnalysis, TimelineEntry } from '../types';
import { generateSlug } from '../utils/slugify';
import { ObjectId } from 'mongodb';

export class TimelineService {
  private readonly COLLECTION_NAME = 'timelines';
  private readonly VERSIONS_COLLECTION_NAME = 'timeline_versions';

  /**
   * Save a timeline analysis to MongoDB
   */
  async saveTimeline(
    topic: string,
    valueLabel: string,
    pastEntries: TimelineEntry[],
    presentEntry: TimelineEntry,
    predictions: any[],
    userId: string | null,
    isPublic: boolean = false
  ): Promise<TimelineAnalysis> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    const slug = generateSlug(topic);
    const now = new Date();

    // Check if timeline with this slug already exists
    const existing = await collection.findOne({ slug });
    if (existing) {
      // Update existing timeline
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
        isPublic,
      };

      await collection.updateOne(
        { slug },
        { $set: updated }
      );

      const result = await collection.findOne({ slug });
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
      createdAt: now,
      updatedAt: now,
      userId,
      isPublic,
      viewCount: 0,
      version: 1,
    };

    await collection.insertOne(timelineDoc);

    // Also save as version 1 in versions collection
    const versionsCollection = db.collection(this.VERSIONS_COLLECTION_NAME);
    await versionsCollection.insertOne({
      ...timelineDoc,
      version: 1,
    });

    return this.mapToTimelineAnalysis(timelineDoc);
  }

  /**
   * Retrieve a timeline by slug (returns latest version by default)
   */
  async getTimelineBySlug(slug: string, version?: number): Promise<TimelineAnalysis | null> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // If specific version requested, get from versions collection
    if (version !== undefined) {
      const versionsCollection = db.collection(this.VERSIONS_COLLECTION_NAME);
      const versionDoc = await versionsCollection.findOne({ slug, version });
      if (versionDoc) {
        // Increment view count on main timeline
        await collection.updateOne(
          { slug },
          { $inc: { viewCount: 1 } }
        );
        return this.mapToTimelineAnalysis(versionDoc);
      }
      return null;
    }

    // Get latest version from main collection
    // Increment view count
    await collection.updateOne(
      { slug },
      { $inc: { viewCount: 1 } }
    );

    const result = await collection.findOne({ slug });
    if (!result) {
      return null;
    }

    return this.mapToTimelineAnalysis(result);
  }

  /**
   * Get all versions for a timeline
   */
  async getTimelineVersions(slug: string): Promise<Array<{ version: number; createdAt: Date; presentValue: number }>> {
    const db = await getMongoDB();
    const versionsCollection = db.collection(this.VERSIONS_COLLECTION_NAME);

    const versions = await versionsCollection
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
    isPublic: boolean
  ): Promise<{ version: number; timeline: TimelineAnalysis }> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);
    const versionsCollection = db.collection(this.VERSIONS_COLLECTION_NAME);

    // Get current max version for this slug
    const maxVersionDoc = await versionsCollection
      .findOne({ slug }, { sort: { version: -1 } });
    
    const newVersion = maxVersionDoc ? maxVersionDoc.version + 1 : 1;
    const now = new Date();

    // Create version document
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
      createdAt: now,
      updatedAt: now,
      userId,
      isPublic,
      viewCount: 0,
    };

    await versionsCollection.insertOne(versionDoc);

    // Update main timeline with latest version
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
      isPublic,
      version: newVersion,
    };

    await collection.updateOne(
      { slug },
      { $set: updated },
      { upsert: true }
    );

    const timeline = this.mapToTimelineAnalysis({ ...versionDoc, version: newVersion });
    return { version: newVersion, timeline };
  }

  /**
   * Search timelines by topic
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

    const total = await collection.countDocuments(query);

    const results = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const timelines = results.map(doc => this.mapToTimelineAnalysis(doc));

    return { timelines, total };
  }

  /**
   * Get all timelines for a user
   */
  async getUserTimelines(userId: string): Promise<TimelineAnalysis[]> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return results.map(doc => this.mapToTimelineAnalysis(doc));
  }

  /**
   * Update timeline visibility
   */
  async updateTimelineVisibility(
    slug: string,
    userId: string,
    isPublic: boolean
  ): Promise<TimelineAnalysis | null> {
    const db = await getMongoDB();
    const collection = db.collection(this.COLLECTION_NAME);

    // Verify ownership
    const existing = await collection.findOne({ slug, userId });
    if (!existing) {
      return null;
    }

    await collection.updateOne(
      { slug, userId },
      { $set: { isPublic, updatedAt: new Date() } }
    );

    const result = await collection.findOne({ slug });
    return result ? this.mapToTimelineAnalysis(result) : null;
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
      isPublic: doc.isPublic || false,
      viewCount: doc.viewCount || 0,
      version: doc.version || 1,
    };
  }
}

export const timelineService = new TimelineService();

