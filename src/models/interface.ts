import {type SourceValue} from "./source.ts";

export interface IAutoCompleter {
    train(text: string, source: SourceValue): void;
    predict(context: string, topK?: number): Suggestion[];
}

export interface Suggestion {
    word: string;
    score: number;
}