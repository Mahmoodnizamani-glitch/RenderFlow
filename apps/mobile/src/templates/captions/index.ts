// -- Caption Templates --------------------------------------------------------

export { hormoziTemplate } from './hormozi';
export { minimalTemplate } from './minimal';
export { bounceTemplate } from './bounce';
export { karaokeTemplate } from './karaoke';

// -- Code Generator -----------------------------------------------------------

export {
    generateCaptionCode,
    getAllTemplates,
    getTemplate,
} from './codeGenerator';
export type { GenerateCaptionCodeParams } from './codeGenerator';

// -- Types & Config -----------------------------------------------------------

export type {
    CaptionTemplate,
    CaptionGeneratorInput,
} from './types';

export {
    DEFAULT_STYLE_CONFIG,
    POSITION_TOP_PERCENT,
} from './types';

// -- Utilities ----------------------------------------------------------------

export {
    generateCommonImports,
    generateSubtitleData,
    generateCompositionBlock,
    getAspectDimensions,
    calculateTotalFrames,
} from './codeGenUtils';
