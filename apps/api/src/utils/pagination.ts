/**
 * Pagination utility.
 *
 * Provides Zod schemas for query parsing and a helper to build
 * the standard paginated response envelope.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Query schema
// ---------------------------------------------------------------------------

export const PaginationQuerySchema = z.object({
    page: z
        .string()
        .default(String(DEFAULT_PAGE))
        .transform(Number)
        .pipe(z.number().int().positive()),
    limit: z
        .string()
        .default(String(DEFAULT_LIMIT))
        .transform(Number)
        .pipe(z.number().int().positive().max(MAX_LIMIT)),
    search: z.string().max(255).optional(),
    sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ---------------------------------------------------------------------------
// Response meta
// ---------------------------------------------------------------------------

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

/**
 * Build a standard paginated response object.
 */
export function buildPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
        },
    };
}

/**
 * Calculate the SQL offset for a given page and limit.
 */
export function calcOffset(page: number, limit: number): number {
    return (page - 1) * limit;
}
