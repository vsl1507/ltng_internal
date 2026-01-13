import slugify from "slugify";

/**
 * Generate slug from English text
 * Uses slugify package with optimized settings
 */
export function generateSlug(text: string): string {
  return slugify(text, {
    replacement: "-",
    remove: undefined,
    lower: true,
    strict: true,
    locale: "en",
    trim: true,
  });
}

/**
 * Generate unique slug with auto-increment suffix
 * @param text - Source text to slugify
 * @param checkExists - Function that checks if slug exists in database
 * @param maxAttempts - Maximum number of attempts before adding timestamp
 */
export async function generateUniqueSlug(
  text: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxAttempts: number = 100
): Promise<string> {
  const baseSlug = generateSlug(text);
  let slug = baseSlug;
  let counter = 1;

  while ((await checkExists(slug)) && counter <= maxAttempts) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  if (counter > maxAttempts) {
    // Fallback: add timestamp if too many attempts
    slug = `${baseSlug}-${Date.now()}`;
  }

  return slug;
}

/**
 * Generate slug from multiple fields (fallback chain)
 * Takes first non-empty value
 */
export function generateSlugFromFields(
  ...texts: (string | null | undefined)[]
): string {
  for (const text of texts) {
    if (text && text.trim()) {
      return generateSlug(text);
    }
  }

  // Fallback to timestamp if all texts are empty
  return `item-${Date.now()}`;
}

/**
 * Truncate slug to max length while preserving word boundaries
 */
export function truncateSlug(slug: string, maxLength: number = 50): string {
  if (slug.length <= maxLength) {
    return slug;
  }

  // Truncate at last hyphen before maxLength
  const truncated = slug.substring(0, maxLength);
  const lastHyphen = truncated.lastIndexOf("-");

  if (lastHyphen > 0) {
    return truncated.substring(0, lastHyphen);
  }

  return truncated;
}

/**
 * Validate slug format
 * Checks if slug contains only lowercase letters, numbers, and hyphens
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Sanitize and fix invalid slug
 */
export function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Database helper: Create a slug existence checker function
 * Returns a function that checks if a slug exists in the database
 *
 * @param pool - MySQL connection pool
 * @param tableName - Table name to check
 * @param slugColumn - Column name for slug (default: 'slug')
 * @param deletedColumn - Column name for soft delete flag (default: 'is_deleted')
 */
export function createSlugExistsChecker(
  pool: any,
  tableName: string,
  slugColumn: string = "slug",
  deletedColumn: string = "is_deleted"
) {
  return async (slug: string): Promise<boolean> => {
    const [rows]: any = await pool.query(
      `SELECT ${slugColumn} FROM ${tableName} 
       WHERE ${slugColumn} = ? AND ${deletedColumn} = 0 
       LIMIT 1`,
      [slug]
    );
    return rows.length > 0;
  };
}

/**
 * Express middleware: Auto-generate slug from a field
 *
 * @param sourceField - Field to generate slug from (default: 'name' or 'title')
 * @param targetField - Field to store slug in (default: 'slug')
 * @param overwrite - Whether to overwrite existing slug (default: false)
 */
export function autoSlugMiddleware(
  sourceField: string = "name",
  targetField: string = "slug",
  overwrite: boolean = false
) {
  return (req: any, res: any, next: any) => {
    const sourceText = req.body[sourceField];
    const existingSlug = req.body[targetField];

    // Only generate if source exists and (no slug exists or overwrite is true)
    if (sourceText && (!existingSlug || overwrite)) {
      req.body[targetField] = generateSlug(sourceText);
    }

    next();
  };
}

/**
 * Utility to extract slug from URL or path
 */
export function extractSlugFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1] || "";

  // Remove query string and hash
  return lastPart.split("?")[0].split("#")[0];
}

/**
 * Compare two slugs for similarity
 * Useful for fuzzy matching
 */
export function slugSimilarity(slug1: string, slug2: string): number {
  const longer = slug1.length > slug2.length ? slug1 : slug2;
  const shorter = slug1.length > slug2.length ? slug2 : slug1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * Helper for slugSimilarity
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
