import './style.css'
import {Textarea} from "./ui/textarea";
import {getArticlesFromWikipedia} from "./api";
import {modelAbstractFactory} from "./models";


async function main() {
    const textarea = new Textarea(document.querySelector('#app')!)

    const articles = [
        'Почему одни страны богатые, а другие бедные',
        'Великая французская революция',
        'История солнечных часов',
        'История шахмат',
    ]
    const data = await getArticlesFromWikipedia(articles).then((articles) => {
        return Array.from(articles.values()).join('\n\n')
    })

    const model = modelAbstractFactory()
    model.train(data)

    console.log(model)

    textarea.onInput((v) => {
        const suggestions = model
            .predict(v)

        const res = suggestions.map((_) => _.word)
        textarea.setSuggestions(res)
    })
}


main()