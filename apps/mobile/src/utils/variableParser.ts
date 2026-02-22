/**
 * variableParser — extracts getInput() call definitions from user code.
 *
 * Uses regex-based parsing (no eval / no AST library) to detect calls of
 * the form:
 *   getInput('name', 'type', 'label')
 *   getInput('name', 'type', 'label', defaultValue)
 *   getInput('name', 'type', 'label', defaultValue, { ...options })
 *
 * Handles formatted, minified, and multi-line code. Gracefully skips
 * malformed calls with a console.warn — never crashes.
 */
import type { InputType, InputOptions, VariableDefinition } from '@renderflow/shared';
import { InputTypeSchema } from '@renderflow/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid InputType values for quick lookup */
const _VALID_INPUT_TYPES = new Set<string>([
    'string', 'number', 'color', 'boolean', 'select', 'image', 'range',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strip surrounding quotes from a string literal.
 * Supports single quotes, double quotes, and backticks.
 */
function stripQuotes(raw: string): string {
    const trimmed = raw.trim();
    if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

/**
 * Split a top-level argument string by commas, respecting nested braces,
 * brackets, parentheses, and quoted strings.
 */
function splitArgs(argsStr: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let escaped = false;

    for (let i = 0; i < argsStr.length; i++) {
        const ch = argsStr[i]!;

        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            current += ch;
            escaped = true;
            continue;
        }

        // Toggle quote states
        if (ch === "'" && !inDoubleQuote && !inBacktick) {
            inSingleQuote = !inSingleQuote;
            current += ch;
            continue;
        }
        if (ch === '"' && !inSingleQuote && !inBacktick) {
            inDoubleQuote = !inDoubleQuote;
            current += ch;
            continue;
        }
        if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
            inBacktick = !inBacktick;
            current += ch;
            continue;
        }

        // If inside any quote, just accumulate
        if (inSingleQuote || inDoubleQuote || inBacktick) {
            current += ch;
            continue;
        }

        // Track nesting depth
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
            current += ch;
            continue;
        }
        if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            current += ch;
            continue;
        }

        // Split on top-level commas
        if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    const last = current.trim();
    if (last.length > 0) {
        args.push(last);
    }

    return args;
}

/**
 * Attempt to parse a JS literal value (string, number, boolean, null,
 * simple object, or simple array) from a raw argument string.
 * Returns undefined if parsing fails.
 */
function parseLiteralValue(raw: string): unknown {
    const trimmed = raw.trim();

    // String literals
    if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
        return stripQuotes(trimmed);
    }

    // Boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Null / undefined
    if (trimmed === 'null' || trimmed === 'undefined') return undefined;

    // Number
    const num = Number(trimmed);
    if (!Number.isNaN(num) && trimmed.length > 0) return num;

    // Simple object/array — try JSON parse (with minor fixups)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            // Replace single-quoted keys/values with double-quoted for JSON compatibility
            const jsonified = trimmed
                // Remove trailing commas before closing braces/brackets
                .replace(/,\s*([}\]])/g, '$1')
                // Replace unquoted keys: `{ foo:` → `{ "foo":`
                .replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
                // Replace single-quoted values with double-quoted
                .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ':"$1"')
                // Replace single-quoted array items
                .replace(/\[\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, '["$1"')
                .replace(/,\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ',"$1"');
            return JSON.parse(jsonified);
        } catch {
            return undefined;
        }
    }

    return undefined;
}

/**
 * Parse an options object literal from a raw argument string.
 */
function parseOptions(raw: string): InputOptions | undefined {
    const parsed = parseLiteralValue(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as InputOptions;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Main regex pattern
// ---------------------------------------------------------------------------

/**
 * Matches `getInput(...)` calls. We use a non-greedy approach and then
 * manually find the balanced closing parenthesis.
 *
 * The regex finds `getInput(` and then we do manual paren-balancing
 * to extract the full argument string, supporting nested parens.
 */
const GET_INPUT_START = /getInput\s*\(/g;

/**
 * Given the full code and a start index right after `getInput(`,
 * find the matching `)` respecting nesting and quotes.
 * Returns the argument string (without outer parens), or null if unbalanced.
 */
function extractBalancedArgs(code: string, startIdx: number): string | null {
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let escaped = false;

    for (let i = startIdx; i < code.length; i++) {
        const ch = code[i]!;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (ch === "'" && !inDoubleQuote && !inBacktick) {
            inSingleQuote = !inSingleQuote;
            continue;
        }
        if (ch === '"' && !inSingleQuote && !inBacktick) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }
        if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
            inBacktick = !inBacktick;
            continue;
        }

        if (inSingleQuote || inDoubleQuote || inBacktick) continue;

        if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth--;
            if (depth === 0) {
                return code.slice(startIdx, i);
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse all `getInput()` call definitions from the given code string.
 *
 * @param code - The full user code (Remotion TSX/JSX/JS)
 * @returns Deduplicated array of VariableDefinition objects
 */
export function parseVariableDefinitions(code: string): VariableDefinition[] {
    const definitions: VariableDefinition[] = [];
    const seenNames = new Set<string>();

    // Reset regex state
    GET_INPUT_START.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = GET_INPUT_START.exec(code)) !== null) {
        const argsStartIdx = match.index + match[0].length;
        const argsStr = extractBalancedArgs(code, argsStartIdx);

        if (argsStr === null) {
            // eslint-disable-next-line no-console
            console.warn(
                `[variableParser] Unbalanced parentheses in getInput() call at index ${match.index}. Skipping.`,
            );
            continue;
        }

        const args = splitArgs(argsStr);

        // Minimum: name, type, label (3 args)
        if (args.length < 3) {
            // eslint-disable-next-line no-console
            console.warn(
                `[variableParser] getInput() call at index ${match.index} has fewer than 3 arguments. Skipping.`,
            );
            continue;
        }

        const name = stripQuotes(args[0]!);
        const typeRaw = stripQuotes(args[1]!);
        const label = stripQuotes(args[2]!);

        // Validate name
        if (!name) {
            // eslint-disable-next-line no-console
            console.warn(
                `[variableParser] getInput() call at index ${match.index} has empty name. Skipping.`,
            );
            continue;
        }

        // Validate type
        const typeResult = InputTypeSchema.safeParse(typeRaw);
        if (!typeResult.success) {
            // eslint-disable-next-line no-console
            console.warn(
                `[variableParser] getInput() call at index ${match.index} has invalid type "${typeRaw}". Skipping.`,
            );
            continue;
        }
        const type: InputType = typeResult.data;

        // Validate label
        if (!label) {
            // eslint-disable-next-line no-console
            console.warn(
                `[variableParser] getInput() call at index ${match.index} has empty label. Skipping.`,
            );
            continue;
        }

        // Deduplicate by name — first occurrence wins
        if (seenNames.has(name)) {
            continue;
        }
        seenNames.add(name);

        // Optional: defaultValue (4th arg)
        const defaultValue = args.length >= 4 ? parseLiteralValue(args[3]!) : undefined;

        // Optional: options (5th arg)
        const options = args.length >= 5 ? parseOptions(args[4]!) : undefined;

        const definition: VariableDefinition = {
            name,
            type,
            label,
        };

        if (defaultValue !== undefined) {
            definition.defaultValue = defaultValue;
        }

        if (options !== undefined) {
            definition.options = options;
        }

        definitions.push(definition);
    }

    return definitions;
}
