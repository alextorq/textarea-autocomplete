import {StupidBackoffModel} from "./model.ts";
import {AdvancedTokenizer} from "./tokenizer.ts";
import {NGramStore} from "./store.ts";

export const getStupidBackoffModel = () =>{
    return new StupidBackoffModel(3, new AdvancedTokenizer(), new NGramStore()); // Триграммы
};