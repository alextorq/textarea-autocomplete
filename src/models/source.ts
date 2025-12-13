export const Source = {
    WIKIPEDIA: "wikipedia",
    CUSTOM_TEXT: "custom_text"
} as const;

export type SourceKey = keyof typeof Source;
export type SourceValue = typeof Source[SourceKey];