/**
 * Repository for Project CRUD operations.
 *
 * All methods are async, return validated types, and throw AppError on failure.
 */
import { eq, like, or, desc, asc, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type {
    Project,
    CreateProjectInput,
    UpdateProjectInput,
} from '@renderflow/shared';
import { ProjectSchema } from '@renderflow/shared';
import { getDb } from '../client';
import { projects } from '../schema';
import { AppError } from '../../errors/AppError';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
    return new Date().toISOString();
}

/**
 * Maps a raw Drizzle row to a validated Project, parsing the JSON `variables` field.
 */
function toProject(row: typeof projects.$inferSelect): Project {
    const parsed = ProjectSchema.safeParse({
        ...row,
        variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables,
    });

    if (!parsed.success) {
        throw AppError.validation(
            `Invalid project data for id "${row.id}"`,
            new Error(parsed.error.message),
        );
    }

    return parsed.data;
}

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

export type ProjectSortBy = 'name' | 'createdAt' | 'updatedAt';

export interface GetAllProjectsOptions {
    search?: string;
    favoriteOnly?: boolean;
    sortBy?: ProjectSortBy;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const ProjectRepository = {
    async create(input: CreateProjectInput): Promise<Project> {
        const db = getDb();
        const id = randomUUID();
        const timestamp = now();

        const values = {
            id,
            name: input.name,
            description: input.description ?? '',
            code: input.code ?? '',
            thumbnailUri: input.thumbnailUri ?? null,
            compositionWidth: input.compositionWidth ?? 1920,
            compositionHeight: input.compositionHeight ?? 1080,
            fps: input.fps ?? 30,
            durationInFrames: input.durationInFrames ?? 150,
            variables: JSON.stringify(input.variables ?? {}),
            isFavorite: false,
            syncStatus: 'local' as const,
            remoteId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        try {
            await db.insert(projects).values(values);
        } catch (error: unknown) {
            throw AppError.database(
                `Failed to create project "${input.name}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }

        return toProject(values);
    },

    async getById(id: string): Promise<Project> {
        const db = getDb();

        try {
            const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
            const row = rows[0];

            if (!row) {
                throw AppError.notFound('Project', id);
            }

            return toProject(row);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to fetch project "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async getAll(opts: GetAllProjectsOptions = {}): Promise<Project[]> {
        const db = getDb();

        try {
            let query = db.select().from(projects);

            // Filter: favorites only
            if (opts.favoriteOnly) {
                query = query.where(eq(projects.isFavorite, true)) as typeof query;
            }

            // Filter: search by name or description
            if (opts.search) {
                const pattern = `%${opts.search}%`;
                query = query.where(
                    or(like(projects.name, pattern), like(projects.description, pattern)),
                ) as typeof query;
            }

            // Sort
            const sortCol = opts.sortBy === 'name' ? projects.name
                : opts.sortBy === 'updatedAt' ? projects.updatedAt
                    : projects.createdAt;
            const sortFn = opts.sortOrder === 'asc' ? asc : desc;
            query = query.orderBy(sortFn(sortCol)) as typeof query;

            // Pagination
            if (opts.limit !== undefined) {
                query = query.limit(opts.limit) as typeof query;
            }
            if (opts.offset !== undefined) {
                query = query.offset(opts.offset) as typeof query;
            }

            const rows = await query;
            return rows.map(toProject);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                'Failed to fetch projects',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async update(id: string, input: UpdateProjectInput): Promise<Project> {
        const db = getDb();

        try {
            // Verify project exists first
            await ProjectRepository.getById(id);

            const updateData: Record<string, unknown> = { updatedAt: now() };

            if (input.name !== undefined) updateData.name = input.name;
            if (input.description !== undefined) updateData.description = input.description;
            if (input.code !== undefined) updateData.code = input.code;
            if (input.thumbnailUri !== undefined) updateData.thumbnailUri = input.thumbnailUri;
            if (input.compositionWidth !== undefined)
                updateData.compositionWidth = input.compositionWidth;
            if (input.compositionHeight !== undefined)
                updateData.compositionHeight = input.compositionHeight;
            if (input.fps !== undefined) updateData.fps = input.fps;
            if (input.durationInFrames !== undefined)
                updateData.durationInFrames = input.durationInFrames;
            if (input.variables !== undefined)
                updateData.variables = JSON.stringify(input.variables);
            if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
            if (input.syncStatus !== undefined) updateData.syncStatus = input.syncStatus;
            if (input.remoteId !== undefined) updateData.remoteId = input.remoteId;

            await db.update(projects).set(updateData).where(eq(projects.id, id));

            return ProjectRepository.getById(id);
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to update project "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async delete(id: string): Promise<void> {
        const db = getDb();

        try {
            // Verify project exists first
            await ProjectRepository.getById(id);
            await db.delete(projects).where(eq(projects.id, id));
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to delete project "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async duplicate(id: string): Promise<Project> {
        try {
            const original = await ProjectRepository.getById(id);

            return ProjectRepository.create({
                name: `${original.name} (Copy)`,
                description: original.description,
                code: original.code,
                thumbnailUri: original.thumbnailUri,
                compositionWidth: original.compositionWidth,
                compositionHeight: original.compositionHeight,
                fps: original.fps,
                durationInFrames: original.durationInFrames,
                variables: original.variables,
            });
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to duplicate project "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async search(query: string): Promise<Project[]> {
        return ProjectRepository.getAll({ search: query });
    },

    async toggleFavorite(id: string): Promise<Project> {
        try {
            const project = await ProjectRepository.getById(id);
            return ProjectRepository.update(id, { isFavorite: !project.isFavorite });
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                `Failed to toggle favorite for project "${id}"`,
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },

    async count(): Promise<number> {
        const db = getDb();

        try {
            const result = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(projects);
            return result[0]?.count ?? 0;
        } catch (error: unknown) {
            if (AppError.is(error)) throw error;
            throw AppError.database(
                'Failed to count projects',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    },
} as const;
