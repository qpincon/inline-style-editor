import { mount } from 'svelte';
import StyleEditor from './components/InlineStyleEditor.svelte';

export default class InlineStyleEditor {
    constructor(options) {
        const { target = document.body, ...props } = options;
        return mount(StyleEditor, { target, props });
    }
}