import './style.css'
import {Textarea} from "./ui/textarea";
import {getArticlesFromWikipedia} from "./api";
import {modelAbstractFactory} from "./models";
import {Source} from "./models/source.ts";


async function main() {
    const textarea = new Textarea(document.querySelector('#app')!)
    const model = modelAbstractFactory()
    textarea.onStartNextWord((v) => {
        const suggestions = model.predict(v)

        const res = suggestions.map((_) => _.word)
        textarea.setSuggestions(res)
    })

    textarea.onInput(() => {
        textarea.setSuggestions([])
    })

    const articles = [
        'Почему одни страны богатые, а другие бедные',
        'Великая французская революция',
        'История солнечных часов',
        'История шахмат',
    ]

    const data = await getArticlesFromWikipedia(articles)
    model.train(data, Source.WIKIPEDIA)
}


main()