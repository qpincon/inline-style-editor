import StyleEditor from './components/InlineStyleEditor.svelte';

export default class InlineStyleEditor {
    constructor(options) {
        return new StyleEditor({target: document.body, props: options});
    }
}