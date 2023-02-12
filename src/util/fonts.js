const detector = new FontDetector();

function getFonts() {
    // const availableFonts = new Set();

    // for (const font of fontCheck.values()) {
    //     if (document.fonts.check(`12px "${font}"`)) {
    //         availableFonts.add(font);
    //     }
    // }

    return [...listFonts(), ...detector.availableFonts]
}

function listFonts() {
    let { fonts } = document;
    const it = fonts.entries();

    let arr = [];
    let done = false;

    while (!done) {
        const font = it.next();
        if (!font.done) {
            arr.push(font.value[0].family);
        } else {
            done = font.done;
        }
    }

    // converted to set then arr to filter repetitive values
    return [...new Set(arr)];
}

// https://stackoverflow.com/a/3368855
class FontDetector {
    constructor() {
        this.fontsToCheck = new Set([
            'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'HoloLens MDL2 Assets', 'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Palatino Linotype', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Historic', 'Segoe UI Emoji', 'Segoe UI Symbol', 'SimSun', 'Sitka', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic',
            'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72', 'Bodoni 72 Oldstyle', 'Bodoni 72 Smallcaps', 'Bradley Hand', 'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier', 'Courier New', 'Didot', 'DIN Alternate', 'DIN Condensed', 'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact', 'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo', 'Microsoft Sans Serif', 'Monaco', 'Noteworthy', 'Optima', 'Palatino', 'Papyrus', 'Phosphate', 'Rockwell', 'Savoye LET', 'SignPainter', 'Skia', 'Snell Roundhand', 'Tahoma', 'Times', 'Times New Roman', 'Trattatello', 'Trebuchet MS', 'Verdana', 'Zapfino',
            'Comic Sans MS', 'Comic Sans', 'Apple Chancery', 'Bradley Hand', 'Brush Script MT', 'Brush Script Std', 'Snell Roundhand', 'URW Chancery L'
        ].sort());
        this.init();
    }
    
    init() {
        this.defaultWidth = {};
        this.defaultHeight = {};
        // a font will be compared against all the three default fonts.
        // and if it doesn't match all 3 then that font is not available.
        this.baseFonts = ['monospace', 'sans-serif', 'serif', 'cursive'];
    
        // we use m or w because these two characters take up the maximum width.
        // And we use a LLi so that the same matching fonts can get separated
        const testString = "mmmmmmmmmmlli";
    
        // we test using 72px font size, we may use any size. I guess larger the better.
        const testSize = '72px';
    
        this.container = document.getElementsByTagName("body")[0];
    
        // create a SPAN in the document to get the width of the text we use to test
        this.spanTester = document.createElement("span");
        this.spanTester.style.fontSize = testSize;
        this.spanTester.innerHTML = testString;
        this.baseFonts.forEach(font => {
            //get the default width for the three base fonts
            this.spanTester.style.fontFamily = font;
            this.container.appendChild(this.spanTester);
            this.defaultWidth[font] = this.spanTester.offsetWidth; // width for the default font
            this.defaultHeight[font] = this.spanTester.offsetHeight; // height for the default font
            this.container.removeChild(this.spanTester);
        });
        this.detectFonts();
    }

    fontExists(fontName) {
        let detected = false;
        for (const font of this.baseFonts) {
            this.spanTester.style.fontFamily = fontName + ',' + font; // name of the font along with the base font for fallback.
            this.container.appendChild(this.spanTester);
            const matched = (this.spanTester.offsetWidth != this.defaultWidth[font] || this.spanTester.offsetHeight != this.defaultHeight[font]);
            this.container.removeChild(this.spanTester);
            detected = detected || matched;
        }
        return detected;
    }

    detectFonts() {
        this.availableFonts = [];
        for (const font of this.fontsToCheck.values()) {
            if (this.fontExists(font)) {
                this.availableFonts.push(font);
            }
        }
        this.availableFonts.sort();
    }

};


export { getFonts };