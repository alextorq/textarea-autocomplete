import {getStupidBackoffModel} from "./stupid-backoff";
import type {IAutoCompleter} from "./interface.ts";

export const modelAbstractFactory = (): IAutoCompleter => {
    return getStupidBackoffModel()
}