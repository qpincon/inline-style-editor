# inline-style-editor
Lightweight (~55KB, ~22KB gzipped) tool to graphically change style and CSS (on classes or inline) using a graphical interface.

See [demo](https://qpincon.github.io/inline-style-editor/).

## Install
```
npm install inline-style-editor
```

Then, to use it:

### In a Svelte project
```svelte
<script>
  import InlineStyleEditor from "inline-style-editor";
</script>

<InlineStyleEditor />
```

### As a JS module
```js
import InlineStyleEditor from "node_modules/inline-style-editor/dist/inline-style-editor.mjs";
new InlineStyleEditor();
```
Also don't forget to import the css in: `node_modules/inline-style-editor/dist/inline-style-editor.css`.


### Using a CDN:
```html
<link rel="stylesheet" type="text/css" href="https://unpkg.com/inline-style-editor@1.0.0/dist/inline-style-editor.css" />
<script src="https://unpkg.com/inline-style-editor@1.0.0/dist/inline-style-editor.js"></script>
```

## Examples
Manual opening of editor:
```js
const editor = new InlineStyleEditor();
document.body.addEventListener('click', (e) => {
    const target = e.target;
    editor.open(target, e.pageX, e.pageY);
});
```
Or automatic (in which case it automatically listen to the `<body>` element for clicks):
```js
new InlineStyleEditor({
  listenOnClick: true,
});
```

### Options
| option        | type           | Description  |
| ------------- |:-------------:| -----:|
| listenOnClick      | Boolean | Default to false. If true, click events will be listened on the `<body>` element, and the editor opened where clicked |
| getAdditionalElems      | Function      |   A function called everytime the editor is opened. Should return a *list* of HTMLElement, that will be editable as well |
| onStyleChanged      | Function      |   A function called everytime a style is modified. The first argument is the current target element, the second the edited CSS rule, or 'inline' if inline |

### Suported css properties

- border-radius
- border-width
- border-style
- border-color
- font-family
- font-size
- font-weight
- color
- stroke-width
- stroke
- fill
- stroke-dasharray
- background-color
