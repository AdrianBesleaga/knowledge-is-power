import { nanoid } from 'nanoid';

export const generateSlug = (topic: string): string => {
  // Convert to lowercase and replace spaces with hyphens
  const baseSlug = topic
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length

  // Add unique identifier
  const uniqueId = nanoid(8);
  
  return `${baseSlug}-${uniqueId}`;
};

export const isValidSlug = (slug: string): boolean => {
  // Check if slug matches expected format
  return /^[a-z0-9-]+-[a-z0-9]{8}$/i.test(slug);
};

