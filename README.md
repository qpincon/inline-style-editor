# inline-style-editor
Lightweight (~42KB, ~16KB gzipped) tool to graphically change style and CSS (on classes or inline) using a graphical interface.

See [demo](https://qpincon.github.io/inline-style-editor/).

## Install
```
npm install inline-style-editor
```

Then, to use it:

### As a JS module
```js
import InlineStyleEditor from "node_modules/inline-style-editor/dist/inline-style-editor.mjs";
const editor = new InlineStyleEditor();
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
| onStyleChanged      | Function      |   A function called everytime a style is modified. The first argument is the current target element, the second the edited CSS rule, or 'inline' if inline, the third the CSS prop name, the fourth the prop value |
| customProps      | Object      |   An object defining custom properties to edit. See below. |

#### customProps

`customProps` is an object on the form of `propName` (as displayed in the editor) -> `definition`. 

`definition` is an object defining the property to edit and the used widget:
- `type`: One of `slider`, `select` or `color`. 
    - If `slider`, `min`, `max` and `step` must be defined (floats).
    - If `select`, `choices` must be defined. It is a function returning a list to select from
- `getter`: A function to get the property value. Takes the edited HTMLElement as first argument. If `null` is returned, the widget will not be awailable for the current element.
- `setter`: A function to set the property value. Takes the edited HTMLElement as first argument, and the new value as second argument.

_Example, to edit the pathLength of an SVG element using a slider_:
```js
new InlineStyleEditor({
    customProps: {
        'pathLength': {
            type: 'slider', min: 1, max: 500, step: 1,
            getter: (el) => {
                // disable when elem is not a SVG geometry
                if (!el.getTotalLength) return null;
                const pathLength = el.getAttribute('pathLength');
                if (!pathLength) return Math.round(el.getTotalLength());
                return parseInt(pathLength);
            },
            setter: (el, val) => {
                el.setAttribute('pathLength', val);
            }
        },
    }
});
```

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
