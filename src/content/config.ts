import { defineCollection, z } from "astro:content";
import classifiedsData from "./classifieds/classifieds.json";
import ephemeraData from "./ephemera/ephemera.json";

// Classifieds
const classifiedsCollection = defineCollection({
  loader: async () => {
    // Read from a single JSON file containing an array of entries
    return (classifiedsData as Array<Record<string, unknown>>).map(
      (entry, index) => ({
        id: (entry.id as string | undefined) || `entry-${index}`,
        title: entry.title as string,
        url: entry.url as string,
        description: entry.description as string | undefined,
        tags: entry.tags as string[] | undefined,
      })
    );
  },
  schema: z.object({
    title: z.string(),
    url: z.string().url(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

// Ephemera
// Data is pre-transformed: tags are arrays, images combined into single array
// First image is the ID, second is back (2 images) or inside (3 images), third is back
const ephemeraCollection = defineCollection({
  loader: async () => {
    return (ephemeraData as Array<Record<string, unknown>>).map((entry) => ({
      id: (entry.images as string[])[0], // Derive ID from first image
      name: entry.name as string,
      date: entry.date as string,
      venue: entry.venue as string | undefined,
      location: entry.location as string | undefined,
      country: entry.country as string | undefined,
      tags: entry.tags as string[],
      images: entry.images as string[],
      notes: entry.notes as string | undefined,
    }));
  },
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(), // Coerce ISO string to Date object
    venue: z.string().optional(),
    location: z.string().optional(),
    country: z.string().optional(),
    tags: z.array(z.string()),
    images: z.array(z.string()).min(1), // At least one image required
    notes: z.string().optional(),
  }),
});

export const collections = {
  classifieds: classifiedsCollection,
  ephemera: ephemeraCollection,
};
