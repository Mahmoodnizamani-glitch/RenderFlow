/**
 * Project service.
 *
 * CRUD operations, pagination with search, and duplication.
 * All queries enforce user-ownership.
 */
import { eq, and, or, ilike, desc, asc, count } from 'drizzle-orm';

import type { Database } from '../db/connection.js';
import { projects } from '../db/schema.js';
import { AppError } from '../errors/errors.js';
import {
    type PaginationQuery,
    buildPaginatedResponse,
    calcOffset,
    type PaginatedResponse,
} from '../utils/pagination.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row shape returned to API consumers (matches DB columns). */
export interface ProjectRow {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    code: string | null;
    thumbnailUrl: string | null;
    compositionSettings: unknown;
    variables: unknown;
    isTemplate: boolean;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/** Data accepted when creating a project. */
export interface CreateProjectData {
    name: string;
    description?: string;
    code?: string;
    thumbnailUrl?: string;
    compositionSettings?: Record<string, unknown>;
    variables?: Record<string, unknown>;
    isTemplate?: boolean;
    isPublic?: boolean;
}

/** Data accepted when updating a project. */
export interface UpdateProjectData {
    name?: string;
    description?: string;
    code?: string;
    thumbnailUrl?: string | null;
    compositionSettings?: Record<string, unknown>;
    variables?: Record<string, unknown>;
    isTemplate?: boolean;
    isPublic?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toProjectRow(row: typeof projects.$inferSelect): ProjectRow {
    return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        description: row.description,
        code: row.code,
        thumbnailUrl: row.thumbnailUrl,
        compositionSettings: row.compositionSettings,
        variables: row.variables,
        isTemplate: row.isTemplate,
        isPublic: row.isPublic,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createProject(
    db: Database,
    userId: string,
    data: CreateProjectData,
): Promise<ProjectRow> {
    const [inserted] = await db
        .insert(projects)
        .values({
            userId,
            name: data.name,
            description: data.description ?? '',
            code: data.code ?? '',
            thumbnailUrl: data.thumbnailUrl,
            compositionSettings: data.compositionSettings ?? {
                width: 1920,
                height: 1080,
                fps: 30,
                durationInFrames: 150,
            },
            variables: data.variables ?? {},
            isTemplate: data.isTemplate ?? false,
            isPublic: data.isPublic ?? false,
        })
        .returning();

    if (!inserted) {
        throw AppError.internal('Failed to create project');
    }

    return toProjectRow(inserted);
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getProjectById(
    db: Database,
    projectId: string,
    userId: string,
): Promise<ProjectRow> {
    const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw AppError.notFound('Project not found');
    }

    return toProjectRow(project);
}

// ---------------------------------------------------------------------------
// List (paginated, searchable, sortable)
// ---------------------------------------------------------------------------

export async function listProjects(
    db: Database,
    userId: string,
    query: PaginationQuery,
): Promise<PaginatedResponse<ProjectRow>> {
    const { page, limit, search, sortBy, sortOrder } = query;

    // Base condition: user owns the project
    let whereCondition = eq(projects.userId, userId);

    // Add search filter (case-insensitive on name and description)
    if (search) {
        const searchPattern = `%${search}%`;
        const searchCondition = or(
            ilike(projects.name, searchPattern),
            ilike(projects.description, searchPattern),
        );
        if (searchCondition) {
            whereCondition = and(whereCondition, searchCondition)!;
        }
    }

    // Get total count
    const [countResult] = await db
        .select({ value: count() })
        .from(projects)
        .where(whereCondition);

    const total = countResult?.value ?? 0;

    // Determine sort column
    const sortColumn =
        sortBy === 'name'
            ? projects.name
            : sortBy === 'createdAt'
                ? projects.createdAt
                : projects.updatedAt;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get paginated data
    const rows = await db
        .select()
        .from(projects)
        .where(whereCondition)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(calcOffset(page, limit));

    return buildPaginatedResponse(rows.map(toProjectRow), total, page, limit);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProject(
    db: Database,
    projectId: string,
    userId: string,
    data: UpdateProjectData,
): Promise<ProjectRow> {
    // Verify ownership first
    await getProjectById(db, projectId, userId);

    const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.description !== undefined) updateData['description'] = data.description;
    if (data.code !== undefined) updateData['code'] = data.code;
    if (data.thumbnailUrl !== undefined) updateData['thumbnailUrl'] = data.thumbnailUrl;
    if (data.compositionSettings !== undefined) updateData['compositionSettings'] = data.compositionSettings;
    if (data.variables !== undefined) updateData['variables'] = data.variables;
    if (data.isTemplate !== undefined) updateData['isTemplate'] = data.isTemplate;
    if (data.isPublic !== undefined) updateData['isPublic'] = data.isPublic;

    const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .returning();

    if (!updated) {
        throw AppError.internal('Failed to update project');
    }

    return toProjectRow(updated);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProject(
    db: Database,
    projectId: string,
    userId: string,
): Promise<void> {
    // Verify ownership first
    await getProjectById(db, projectId, userId);

    await db
        .delete(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

export async function duplicateProject(
    db: Database,
    projectId: string,
    userId: string,
): Promise<ProjectRow> {
    const original = await getProjectById(db, projectId, userId);

    const [duplicated] = await db
        .insert(projects)
        .values({
            userId,
            name: `${original.name} (copy)`,
            description: original.description ?? '',
            code: original.code ?? '',
            thumbnailUrl: original.thumbnailUrl,
            compositionSettings: original.compositionSettings as Record<string, unknown>,
            variables: original.variables as Record<string, unknown>,
            isTemplate: original.isTemplate,
            isPublic: false, // duplicates start as private
        })
        .returning();

    if (!duplicated) {
        throw AppError.internal('Failed to duplicate project');
    }

    return toProjectRow(duplicated);
}
