export const Source = {
    GENERAL: "GENERAL",
    USER: "USER"
} as const;

export type SourceKey = keyof typeof Source;
export type SourceValue = typeof Source[SourceKey];