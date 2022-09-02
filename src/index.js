import StyleEditor from './components/StyleEditor.svelte';

export default class InlineStyleEditor {
    constructor(options) {
        return new StyleEditor({target: document.body, props: options});
    }
}