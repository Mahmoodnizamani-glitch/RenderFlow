// -- SRT Types & Schemas ------------------------------------------------------

export {
    SrtEntrySchema,
    SrtFileSchema,
    WordTimingSchema,
    CaptionStyleIdSchema,
    CaptionPositionSchema,
    CaptionBackgroundSchema,
    VideoAspectSchema,
    CaptionStyleConfigSchema,
    ASPECT_DIMENSIONS,
    MAX_SRT_DURATION_MS,
    MAX_SRT_ENTRIES,
} from './types';

export type {
    SrtEntry,
    SrtFile,
    WordTiming,
    CaptionStyleId,
    CaptionPosition,
    CaptionBackground,
    VideoAspect,
    CaptionStyleConfig,
} from './types';

// -- Parser -------------------------------------------------------------------

export { parseSrt, SrtParseError } from './parser';
export type { ParseSrtOptions } from './parser';

// -- Word Timing --------------------------------------------------------------

export { generateWordTimings, generateEntryWordTimings } from './wordTiming';
