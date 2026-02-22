/**
 * @renderflow/shared — getInput() API contract.
 *
 * Defines the variable injection system types shared by the mobile app,
 * API, and render workers. Template authors call getInput() in their
 * Remotion code; RenderFlow parses these calls to auto-generate a form UI.
 *
 * In the preview sandbox, a global `getInput` function is injected that
 * reads from the current variable values map:
 *   getInput(name, type, label, defaultValue?, options?) => values[name] ?? defaultValue
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// InputType — the set of supported variable input types
// ---------------------------------------------------------------------------

export const InputTypeSchema = z.enum([
    'string',
    'number',
    'color',
    'boolean',
    'select',
    'image',
    'range',
]);

export type InputType = z.infer<typeof InputTypeSchema>;

// ---------------------------------------------------------------------------
// InputOptions — constraints and configuration per input type
// ---------------------------------------------------------------------------

export const InputOptionsSchema = z.object({
    /** Minimum value (number / range) */
    min: z.number().optional(),
    /** Maximum value (number / range) */
    max: z.number().optional(),
    /** Step increment (number / range) */
    step: z.number().positive().optional(),
    /** Available choices (select) */
    choices: z.array(z.string()).optional(),
    /** Whether the field is required */
    required: z.boolean().optional(),
    /** Placeholder text (string) */
    placeholder: z.string().optional(),
    /** Maximum character length (string) */
    maxLength: z.number().int().positive().optional(),
});

export type InputOptions = z.infer<typeof InputOptionsSchema>;

// ---------------------------------------------------------------------------
// VariableDefinition — a single getInput() declaration extracted from code
// ---------------------------------------------------------------------------

export const VariableDefinitionSchema = z.object({
    /** Unique variable name (first arg to getInput) */
    name: z.string().min(1),
    /** Input widget type */
    type: InputTypeSchema,
    /** Human-readable label shown in the form */
    label: z.string().min(1),
    /** Default value used when no user value is set */
    defaultValue: z.unknown().optional(),
    /** Additional constraints / config */
    options: InputOptionsSchema.optional(),
});

export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;

// ---------------------------------------------------------------------------
// VariableValues — the runtime map of name → current value
// ---------------------------------------------------------------------------

export type VariableValues = Record<string, unknown>;

// ---------------------------------------------------------------------------
// getInput function signature (for reference / sandbox injection)
// ---------------------------------------------------------------------------

/**
 * Signature of the `getInput` function injected into the preview sandbox.
 *
 * @param name         - Unique variable name
 * @param type         - Input widget type
 * @param label        - Human-readable label
 * @param defaultValue - Fallback value when not set by user
 * @param options      - Additional constraints
 * @returns The current variable value, or defaultValue if unset
 */
export type GetInputFn = (
    name: string,
    type: InputType,
    label: string,
    defaultValue?: unknown,
    options?: InputOptions,
) => unknown;
