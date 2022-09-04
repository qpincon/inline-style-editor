# inline-style-editor
Tool to graphically change CSS (on classes of inline) using a graphical interface.

See demo.

## Install


## Usage
Manual opening of editor:
```js
const editor = new InlineStyleEditor();
document.body.addEventListener('click', (e) => {
    const target = e.target;
    editor.open(target, e.pageX, e.pageY);
});
```
Or automatic (in which case it automatically listen to the <body> element for clicks):
```js
new InlineStyleEditor({
  listenOnClick: true,
});
```

### Options
| option        | type           | Description  |
| ------------- |:-------------:| -----:|
| listenOnClick      | Boolean | Default to false. If true, click events will be listened on the <body> element, and the editor opened where clicked |
| getAdditionalElems      | Function      |   A function called everytime the editor is opened. Should return a *list* of HTMLElement, that will be editable as well |

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
