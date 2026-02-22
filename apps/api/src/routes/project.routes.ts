/**
 * Project routes.
 *
 * POST   /projects            — Create
 * GET    /projects             — List (paginated, searchable)
 * GET    /projects/:id         — Get by ID
 * PUT    /projects/:id         — Update
 * DELETE /projects/:id         — Delete
 * POST   /projects/:id/duplicate — Duplicate
 *
 * All routes require authentication.
 */
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getDatabase } from '../db/connection.js';
import { authenticate } from '../middleware/authenticate.js';
import * as projectService from '../services/project.service.js';
import { writeAuditLog, extractClientIp, extractUserAgent } from '../services/audit.service.js';
import { PaginationQuerySchema } from '../utils/pagination.js';

// ---------------------------------------------------------------------------
// Zod schemas for project create/update (server-side, matches DB columns)
// ---------------------------------------------------------------------------

const CreateProjectBodySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(5000).optional(),
    code: z.string().max(512_000, 'Code must not exceed 500KB').optional(),
    thumbnailUrl: z.string().url().optional(),
    compositionSettings: z.record(z.unknown()).optional(),
    variables: z.record(z.unknown()).optional(),
    isTemplate: z.boolean().optional(),
    isPublic: z.boolean().optional(),
});

const UpdateProjectBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    code: z.string().max(512_000, 'Code must not exceed 500KB').optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
    compositionSettings: z.record(z.unknown()).optional(),
    variables: z.record(z.unknown()).optional(),
    isTemplate: z.boolean().optional(),
    isPublic: z.boolean().optional(),
});

const ProjectIdParamsSchema = z.object({
    id: z.string().uuid('Invalid project ID'),
});

// ---------------------------------------------------------------------------
// Serialiser – ensures consistent date format
// ---------------------------------------------------------------------------

function serialiseProject(row: projectService.ProjectRow) {
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
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function projectRoutes(app: FastifyInstance): Promise<void> {
    // All project routes require authentication
    app.addHook('preHandler', authenticate);

    // -----------------------------------------------------------------------
    // POST /projects
    // -----------------------------------------------------------------------

    app.post(
        '/projects',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const body = CreateProjectBodySchema.parse(request.body);
            const db = getDatabase();

            const project = await projectService.createProject(
                db,
                request.userId,
                body,
            );

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'project_create',
                resourceType: 'project',
                resourceId: project.id,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply.status(201).send({ project: serialiseProject(project) });
        },
    );

    // -----------------------------------------------------------------------
    // GET /projects
    // -----------------------------------------------------------------------

    app.get(
        '/projects',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = PaginationQuerySchema.parse(request.query);
            const db = getDatabase();

            const result = await projectService.listProjects(
                db,
                request.userId,
                query,
            );

            return reply.status(200).send({
                data: result.data.map(serialiseProject),
                meta: result.meta,
            });
        },
    );

    // -----------------------------------------------------------------------
    // GET /projects/:id
    // -----------------------------------------------------------------------

    app.get(
        '/projects/:id',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = ProjectIdParamsSchema.parse(request.params);
            const db = getDatabase();

            const project = await projectService.getProjectById(
                db,
                id,
                request.userId,
            );

            return reply.status(200).send({ project: serialiseProject(project) });
        },
    );

    // -----------------------------------------------------------------------
    // PUT /projects/:id
    // -----------------------------------------------------------------------

    app.put(
        '/projects/:id',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = ProjectIdParamsSchema.parse(request.params);
            const body = UpdateProjectBodySchema.parse(request.body);
            const db = getDatabase();

            const project = await projectService.updateProject(
                db,
                id,
                request.userId,
                body,
            );

            return reply.status(200).send({ project: serialiseProject(project) });
        },
    );

    // -----------------------------------------------------------------------
    // DELETE /projects/:id
    // -----------------------------------------------------------------------

    app.delete(
        '/projects/:id',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = ProjectIdParamsSchema.parse(request.params);
            const db = getDatabase();

            await projectService.deleteProject(db, id, request.userId);

            void writeAuditLog(db, {
                userId: request.userId,
                action: 'project_delete',
                resourceType: 'project',
                resourceId: id,
                ip: extractClientIp(request),
                userAgent: extractUserAgent(request),
            });

            return reply.status(200).send({ message: 'Project deleted successfully' });
        },
    );

    // -----------------------------------------------------------------------
    // POST /projects/:id/duplicate
    // -----------------------------------------------------------------------

    app.post(
        '/projects/:id/duplicate',
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = ProjectIdParamsSchema.parse(request.params);
            const db = getDatabase();

            const project = await projectService.duplicateProject(
                db,
                id,
                request.userId,
            );

            return reply.status(201).send({ project: serialiseProject(project) });
        },
    );
}
