/**
 * Tests for getInput schemas and types.
 *
 * Validates InputTypeSchema, InputOptionsSchema, and VariableDefinitionSchema
 * with all supported types, edge cases, and malformed data.
 */
import {
    InputTypeSchema,
    InputOptionsSchema,
    VariableDefinitionSchema,
} from '../getInput';

// ---------------------------------------------------------------------------
// InputTypeSchema
// ---------------------------------------------------------------------------

describe('InputTypeSchema', () => {
    const VALID_TYPES = ['string', 'number', 'color', 'boolean', 'select', 'image', 'range'] as const;

    it.each(VALID_TYPES)('accepts "%s" as a valid input type', (type) => {
        expect(InputTypeSchema.parse(type)).toBe(type);
    });

    it('rejects unknown type', () => {
        expect(() => InputTypeSchema.parse('textarea')).toThrow();
        expect(() => InputTypeSchema.parse('file')).toThrow();
        expect(() => InputTypeSchema.parse('date')).toThrow();
    });

    it('rejects empty string', () => {
        expect(() => InputTypeSchema.parse('')).toThrow();
    });

    it('rejects non-string values', () => {
        expect(() => InputTypeSchema.parse(42)).toThrow();
        expect(() => InputTypeSchema.parse(null)).toThrow();
        expect(() => InputTypeSchema.parse(undefined)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// InputOptionsSchema
// ---------------------------------------------------------------------------

describe('InputOptionsSchema', () => {
    it('accepts valid number/range options', () => {
        const result = InputOptionsSchema.parse({
            min: 0,
            max: 100,
            step: 5,
        });
        expect(result.min).toBe(0);
        expect(result.max).toBe(100);
        expect(result.step).toBe(5);
    });

    it('accepts valid select options with choices', () => {
        const result = InputOptionsSchema.parse({
            choices: ['red', 'green', 'blue'],
        });
        expect(result.choices).toEqual(['red', 'green', 'blue']);
    });

    it('accepts valid string options', () => {
        const result = InputOptionsSchema.parse({
            required: true,
            placeholder: 'Enter text...',
            maxLength: 100,
        });
        expect(result.required).toBe(true);
        expect(result.placeholder).toBe('Enter text...');
        expect(result.maxLength).toBe(100);
    });

    it('accepts empty object (all fields optional)', () => {
        const result = InputOptionsSchema.parse({});
        expect(result).toEqual({});
    });

    it('accepts negative min values', () => {
        const result = InputOptionsSchema.parse({ min: -100, max: 0 });
        expect(result.min).toBe(-100);
    });

    it('rejects non-positive step', () => {
        expect(() => InputOptionsSchema.parse({ step: 0 })).toThrow();
        expect(() => InputOptionsSchema.parse({ step: -1 })).toThrow();
    });

    it('rejects non-positive maxLength', () => {
        expect(() => InputOptionsSchema.parse({ maxLength: 0 })).toThrow();
        expect(() => InputOptionsSchema.parse({ maxLength: -5 })).toThrow();
    });

    it('rejects non-integer maxLength', () => {
        expect(() => InputOptionsSchema.parse({ maxLength: 10.5 })).toThrow();
    });

    it('accepts empty choices array', () => {
        const result = InputOptionsSchema.parse({ choices: [] });
        expect(result.choices).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// VariableDefinitionSchema
// ---------------------------------------------------------------------------

describe('VariableDefinitionSchema', () => {
    it('accepts a valid string variable', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'title',
            type: 'string',
            label: 'Video Title',
            defaultValue: 'My Video',
        });
        expect(result.name).toBe('title');
        expect(result.type).toBe('string');
        expect(result.label).toBe('Video Title');
        expect(result.defaultValue).toBe('My Video');
    });

    it('accepts a valid number variable with options', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'fontSize',
            type: 'number',
            label: 'Font Size',
            defaultValue: 48,
            options: { min: 12, max: 200, step: 1 },
        });
        expect(result.options?.min).toBe(12);
        expect(result.options?.max).toBe(200);
    });

    it('accepts a valid color variable', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'bgColor',
            type: 'color',
            label: 'Background Color',
            defaultValue: '#FF5733',
        });
        expect(result.defaultValue).toBe('#FF5733');
    });

    it('accepts a valid boolean variable', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'showLogo',
            type: 'boolean',
            label: 'Show Logo',
            defaultValue: true,
        });
        expect(result.defaultValue).toBe(true);
    });

    it('accepts a valid select variable with choices', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'theme',
            type: 'select',
            label: 'Color Theme',
            defaultValue: 'dark',
            options: { choices: ['light', 'dark', 'auto'] },
        });
        expect(result.options?.choices).toEqual(['light', 'dark', 'auto']);
    });

    it('accepts a valid range variable', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'opacity',
            type: 'range',
            label: 'Opacity',
            defaultValue: 0.8,
            options: { min: 0, max: 1, step: 0.1 },
        });
        expect(result.defaultValue).toBe(0.8);
    });

    it('accepts a valid image variable', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'logo',
            type: 'image',
            label: 'Logo Image',
            defaultValue: null,
        });
        expect(result.type).toBe('image');
    });

    it('accepts definition without defaultValue (optional)', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'subtitle',
            type: 'string',
            label: 'Subtitle',
        });
        expect(result.defaultValue).toBeUndefined();
    });

    it('accepts definition without options (optional)', () => {
        const result = VariableDefinitionSchema.parse({
            name: 'count',
            type: 'number',
            label: 'Count',
        });
        expect(result.options).toBeUndefined();
    });

    it('rejects empty name', () => {
        expect(() =>
            VariableDefinitionSchema.parse({
                name: '',
                type: 'string',
                label: 'Label',
            }),
        ).toThrow();
    });

    it('rejects empty label', () => {
        expect(() =>
            VariableDefinitionSchema.parse({
                name: 'valid',
                type: 'string',
                label: '',
            }),
        ).toThrow();
    });

    it('rejects invalid type', () => {
        expect(() =>
            VariableDefinitionSchema.parse({
                name: 'valid',
                type: 'textarea',
                label: 'Label',
            }),
        ).toThrow();
    });

    it('rejects missing required fields', () => {
        expect(() => VariableDefinitionSchema.parse({})).toThrow();
        expect(() => VariableDefinitionSchema.parse({ name: 'x' })).toThrow();
        expect(() => VariableDefinitionSchema.parse({ name: 'x', type: 'string' })).toThrow();
    });
});
