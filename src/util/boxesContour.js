import { contours } from 'd3-contour';

function pointInBox(p, box) {
    return !(p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top)
}

function pointInBoxes(point, boxes) {
    for (const box of boxes){
        if (pointInBox(point, box)) return true;
    }
    return false;
}

function defineRectangleClockWise({width, height, top = 0, left = 0}) {
    return `M${left} ${top} h${width} v${height} h-${width}z`
}

function defineRectangleAntiClockWise({width, height, top = 0, left = 0}) {
    return `M${left} ${top} v${height} h${width} v-${height}z`
}

function boxOverlap(box1, box2) {
    return (box1.right >= box2.left && box2.right >= box1.left) 
        && (box1.bottom >= box2.top && box2.bottom >= box1.top)
}

function boxesHaveOverlap(boundingBoxes) {
    for (let i = 0; i < boundingBoxes.length - 1; ++i) {
        const ref = boundingBoxes[i];
        for (let j = i + 1; j < boundingBoxes.length; ++j) {
            if (boxOverlap(ref, boundingBoxes[j])) return true;
        }
    }
    return false;
}

function computeContours(boundingBoxes, pageDimensions) {
    let _pathWithHoles = defineRectangleAntiClockWise({width: pageDimensions.width, height: pageDimensions.height});
    if (boundingBoxes.length < 10 && !boxesHaveOverlap(boundingBoxes)) {
        for (const bbox of boundingBoxes) {
            _pathWithHoles = `${_pathWithHoles} ${defineRectangleClockWise(bbox)}`;
        }
        return _pathWithHoles;
    }
    const minX = Math.min(...boundingBoxes.map(rect => rect.left));
    const minY = Math.min(...boundingBoxes.map(rect => rect.top));
    const offsetBoxes = boundingBoxes.map(rect => {
        rect.left = rect.left - minX;
        rect.right = rect.right - minX;
        rect.top = rect.top - minY;
        rect.bottom = rect.bottom - minY;
        return rect;
    });
    offsetBoxes.sort((a, b) => {
        if (a.left > b.left) return 1;
        if (a.left < b.left) return -1;
        return 0;
    });
    const maxX = Math.ceil(Math.max(...offsetBoxes.map(rect => rect.right)));
    const maxY = Math.ceil(Math.max(...offsetBoxes.map(rect => rect.bottom)));
    const maxNbPixels = 20000;
    const downscaleFactor = (maxX * maxY) / maxNbPixels;
    const widthArrayX = Math.ceil(maxX / downscaleFactor);
    const widthArrayY = Math.ceil(maxY / downscaleFactor);
    const pixelsByStepX = (maxX) / widthArrayX; 
    const pixelsByStepY = (maxY) / widthArrayY; 
    const values = new Array(widthArrayX * widthArrayY); // one coordinate per pixel
    for (let j = 0, k = 0; j < widthArrayY; ++j) {
        for (let i = 0; i < widthArrayX; ++i, ++k) {
            values[k] = pointInBoxes({x: i * downscaleFactor, y: j * downscaleFactor}, offsetBoxes) ? 1 : 0;
        }
    }

    const computedContours = contours().size([widthArrayX, widthArrayY]).thresholds([1])(values)[0];
    let holes = '';
    for (let polygon of computedContours.coordinates) {
        for (let ring of polygon) {
            for (let i = 0; i < ring.length; ++i) {
                const point = ring[i];
                const x = point[0] * pixelsByStepX + minX;
                const y = point[1] * pixelsByStepY + minY;
                if (!i) holes += `M${x} ${y}`;
                else holes += `L ${x} ${y}`;
            }
            holes += 'Z'
        }
    }
    return `${_pathWithHoles} ${holes}`;
}

export { computeContours };