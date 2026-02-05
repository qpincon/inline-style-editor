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
    if (editor.isOpened()) return;
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
| inlineDeletable      | Function | Defaults to a function always returning true. The function takes the currently selected DOM node, and should return a boolean to determine whether the element can be deleted  |
| getElems      | Function      |   A function called everytime the editor is opened. Should return a *list* of [HTMLElement, name], or HTMLElement (in which case the displayed name will be *Elem i* ). The returned elements will be editable as well. The first argument is the element on which the editor is about to be opened. |
| onStyleChanged      | Function      |   A function called everytime a style is modified. The first argument is the current target element, the second the edited CSS rule, or 'inline' if inline, the third the CSS prop name, the fourth the prop value |
| cssSelector      | Function      |   If defined, the CSS rules to edit can be filtered. The function takes an element and associated CSS selection text. If the function returns false, the current CSS rule will not appear in the popup. |
| cssRuleFilter      | Function      |   A function taking an DOM element and the css selector for the CSS rule that will be editable, that should return `false` if the rule should not display in the editor  |
| getCssRuleName      | Function      |   A function taking a CSS text selector and the element on which the editor opened, returning a new string for this selector to display in the editor   |
| customProps      | Object      |   An object defining custom properties to edit. See below. |
| ignoredProps      | Array      |   An array of CSS property names to exclude from the editor (e.g., `['border-style', 'stroke-dasharray']`). |

#### customProps

`customProps` is an object on the form of `propName` (as displayed in the editor) -> `definition`. 

`definition` is an object defining the property to edit and the used widget:
- `type`: One of `slider`, `select` or `color`.
    - If `slider`, `min`, `max` and `step` must be defined (floats).
    - If `select`, `choices` must be defined. It is a function returning a list to select from
- `getter`: A function to get the property value. Takes the edited HTMLElement as first argument. If `null` is returned, the widget will not be available for the current element.
- `setter`: A function to set the property value. Takes the edited HTMLElement as first argument, and the new value as second argument.
- `defaultValue`: (optional) The value to apply when clicking "Reset to default". If not specified, the property will simply be removed.

_Example, to edit the pathLength of an SVG element using a slider_:
```js
new InlineStyleEditor({
    customProps: {
        'pathLength': {
            type: 'slider', min: 1, max: 500, step: 1,
            defaultValue: 100,
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
- stroke-linejoin
- stroke
- fill
- stroke-dasharray
- background-color
