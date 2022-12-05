function noop$1() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_style(node, key, value, important) {
    if (value === null) {
        node.style.removeProperty(key);
    }
    else {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function tick() {
    schedule_update();
    return resolved_promise;
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        while (flushidx < dirty_components.length) {
            const component = dirty_components[flushidx];
            flushidx++;
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
    else if (callback) {
        callback();
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop$1,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop$1;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function pick(obj, keys) {
    return keys.reduce((picked, curKey) => {
        picked[curKey] = obj[curKey];
        return picked;
    }, {});
}

function debounce(func, wait, immediate = false) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

function ascending$1(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function descending(a, b) {
  return a == null || b == null ? NaN
    : b < a ? -1
    : b > a ? 1
    : b >= a ? 0
    : NaN;
}

function bisector(f) {
  let compare1, compare2, delta;

  // If an accessor is specified, promote it to a comparator. In this case we
  // can test whether the search value is (self-) comparable. We can’t do this
  // for a comparator (except for specific, known comparators) because we can’t
  // tell if the comparator is symmetric, and an asymmetric comparator can’t be
  // used to test whether a single value is comparable.
  if (f.length !== 2) {
    compare1 = ascending$1;
    compare2 = (d, x) => ascending$1(f(d), x);
    delta = (d, x) => f(d) - x;
  } else {
    compare1 = f === ascending$1 || f === descending ? f : zero;
    compare2 = f;
    delta = f;
  }

  function left(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function right(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function center(a, x, lo = 0, hi = a.length) {
    const i = left(a, x, lo, hi - 1);
    return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
  }

  return {left, center, right};
}

function zero() {
  return 0;
}

function number(x) {
  return x === null ? NaN : +x;
}

bisector(ascending$1);
bisector(number).center;

function count(values, valueof) {
  let count = 0;
  if (valueof === undefined) {
    for (let value of values) {
      if (value != null && (value = +value) >= value) {
        ++count;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null && (value = +value) >= value) {
        ++count;
      }
    }
  }
  return count;
}

function extent(values, valueof) {
  let min;
  let max;
  if (valueof === undefined) {
    for (const value of values) {
      if (value != null) {
        if (min === undefined) {
          if (value >= value) min = max = value;
        } else {
          if (min > value) min = value;
          if (max < value) max = value;
        }
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null) {
        if (min === undefined) {
          if (value >= value) min = max = value;
        } else {
          if (min > value) min = value;
          if (max < value) max = value;
        }
      }
    }
  }
  return [min, max];
}

var e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function ticks(start, stop, count) {
  var reverse,
      i = -1,
      n,
      ticks,
      step;

  stop = +stop, start = +start, count = +count;
  if (start === stop && count > 0) return [start];
  if (reverse = stop < start) n = start, start = stop, stop = n;
  if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

  if (step > 0) {
    let r0 = Math.round(start / step), r1 = Math.round(stop / step);
    if (r0 * step < start) ++r0;
    if (r1 * step > stop) --r1;
    ticks = new Array(n = r1 - r0 + 1);
    while (++i < n) ticks[i] = (r0 + i) * step;
  } else {
    step = -step;
    let r0 = Math.round(start * step), r1 = Math.round(stop * step);
    if (r0 / step < start) ++r0;
    if (r1 / step > stop) --r1;
    ticks = new Array(n = r1 - r0 + 1);
    while (++i < n) ticks[i] = (r0 + i) / step;
  }

  if (reverse) ticks.reverse();

  return ticks;
}

function tickIncrement(start, stop, count) {
  var step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log(step) / Math.LN10),
      error = step / Math.pow(10, power);
  return power >= 0
      ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power)
      : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
}

function tickStep(start, stop, count) {
  var step0 = Math.abs(stop - start) / Math.max(0, count),
      step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
      error = step0 / step1;
  if (error >= e10) step1 *= 10;
  else if (error >= e5) step1 *= 5;
  else if (error >= e2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

function thresholdSturges(values) {
  return Math.ceil(Math.log(count(values)) / Math.LN2) + 1;
}

var array = Array.prototype;

var slice = array.slice;

function ascending(a, b) {
  return a - b;
}

function area(ring) {
  var i = 0, n = ring.length, area = ring[n - 1][1] * ring[0][0] - ring[n - 1][0] * ring[0][1];
  while (++i < n) area += ring[i - 1][1] * ring[i][0] - ring[i - 1][0] * ring[i][1];
  return area;
}

var constant = x => () => x;

function contains(ring, hole) {
  var i = -1, n = hole.length, c;
  while (++i < n) if (c = ringContains(ring, hole[i])) return c;
  return 0;
}

function ringContains(ring, point) {
  var x = point[0], y = point[1], contains = -1;
  for (var i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    var pi = ring[i], xi = pi[0], yi = pi[1], pj = ring[j], xj = pj[0], yj = pj[1];
    if (segmentContains(pi, pj, point)) return 0;
    if (((yi > y) !== (yj > y)) && ((x < (xj - xi) * (y - yi) / (yj - yi) + xi))) contains = -contains;
  }
  return contains;
}

function segmentContains(a, b, c) {
  var i; return collinear(a, b, c) && within(a[i = +(a[0] === b[0])], c[i], b[i]);
}

function collinear(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) === (c[0] - a[0]) * (b[1] - a[1]);
}

function within(p, q, r) {
  return p <= q && q <= r || r <= q && q <= p;
}

function noop() {}

var cases = [
  [],
  [[[1.0, 1.5], [0.5, 1.0]]],
  [[[1.5, 1.0], [1.0, 1.5]]],
  [[[1.5, 1.0], [0.5, 1.0]]],
  [[[1.0, 0.5], [1.5, 1.0]]],
  [[[1.0, 1.5], [0.5, 1.0]], [[1.0, 0.5], [1.5, 1.0]]],
  [[[1.0, 0.5], [1.0, 1.5]]],
  [[[1.0, 0.5], [0.5, 1.0]]],
  [[[0.5, 1.0], [1.0, 0.5]]],
  [[[1.0, 1.5], [1.0, 0.5]]],
  [[[0.5, 1.0], [1.0, 0.5]], [[1.5, 1.0], [1.0, 1.5]]],
  [[[1.5, 1.0], [1.0, 0.5]]],
  [[[0.5, 1.0], [1.5, 1.0]]],
  [[[1.0, 1.5], [1.5, 1.0]]],
  [[[0.5, 1.0], [1.0, 1.5]]],
  []
];

function contours() {
  var dx = 1,
      dy = 1,
      threshold = thresholdSturges,
      smooth = smoothLinear;

  function contours(values) {
    var tz = threshold(values);

    // Convert number of thresholds into uniform thresholds.
    if (!Array.isArray(tz)) {
      const e = extent(values), ts = tickStep(e[0], e[1], tz);
      tz = ticks(Math.floor(e[0] / ts) * ts, Math.floor(e[1] / ts - 1) * ts, tz);
    } else {
      tz = tz.slice().sort(ascending);
    }

    return tz.map(value => contour(values, value));
  }

  // Accumulate, smooth contour rings, assign holes to exterior rings.
  // Based on https://github.com/mbostock/shapefile/blob/v0.6.2/shp/polygon.js
  function contour(values, value) {
    var polygons = [],
        holes = [];

    isorings(values, value, function(ring) {
      smooth(ring, values, value);
      if (area(ring) > 0) polygons.push([ring]);
      else holes.push(ring);
    });

    holes.forEach(function(hole) {
      for (var i = 0, n = polygons.length, polygon; i < n; ++i) {
        if (contains((polygon = polygons[i])[0], hole) !== -1) {
          polygon.push(hole);
          return;
        }
      }
    });

    return {
      type: "MultiPolygon",
      value: value,
      coordinates: polygons
    };
  }

  // Marching squares with isolines stitched into rings.
  // Based on https://github.com/topojson/topojson-client/blob/v3.0.0/src/stitch.js
  function isorings(values, value, callback) {
    var fragmentByStart = new Array,
        fragmentByEnd = new Array,
        x, y, t0, t1, t2, t3;

    // Special case for the first row (y = -1, t2 = t3 = 0).
    x = y = -1;
    t1 = values[0] >= value;
    cases[t1 << 1].forEach(stitch);
    while (++x < dx - 1) {
      t0 = t1, t1 = values[x + 1] >= value;
      cases[t0 | t1 << 1].forEach(stitch);
    }
    cases[t1 << 0].forEach(stitch);

    // General case for the intermediate rows.
    while (++y < dy - 1) {
      x = -1;
      t1 = values[y * dx + dx] >= value;
      t2 = values[y * dx] >= value;
      cases[t1 << 1 | t2 << 2].forEach(stitch);
      while (++x < dx - 1) {
        t0 = t1, t1 = values[y * dx + dx + x + 1] >= value;
        t3 = t2, t2 = values[y * dx + x + 1] >= value;
        cases[t0 | t1 << 1 | t2 << 2 | t3 << 3].forEach(stitch);
      }
      cases[t1 | t2 << 3].forEach(stitch);
    }

    // Special case for the last row (y = dy - 1, t0 = t1 = 0).
    x = -1;
    t2 = values[y * dx] >= value;
    cases[t2 << 2].forEach(stitch);
    while (++x < dx - 1) {
      t3 = t2, t2 = values[y * dx + x + 1] >= value;
      cases[t2 << 2 | t3 << 3].forEach(stitch);
    }
    cases[t2 << 3].forEach(stitch);

    function stitch(line) {
      var start = [line[0][0] + x, line[0][1] + y],
          end = [line[1][0] + x, line[1][1] + y],
          startIndex = index(start),
          endIndex = index(end),
          f, g;
      if (f = fragmentByEnd[startIndex]) {
        if (g = fragmentByStart[endIndex]) {
          delete fragmentByEnd[f.end];
          delete fragmentByStart[g.start];
          if (f === g) {
            f.ring.push(end);
            callback(f.ring);
          } else {
            fragmentByStart[f.start] = fragmentByEnd[g.end] = {start: f.start, end: g.end, ring: f.ring.concat(g.ring)};
          }
        } else {
          delete fragmentByEnd[f.end];
          f.ring.push(end);
          fragmentByEnd[f.end = endIndex] = f;
        }
      } else if (f = fragmentByStart[endIndex]) {
        if (g = fragmentByEnd[startIndex]) {
          delete fragmentByStart[f.start];
          delete fragmentByEnd[g.end];
          if (f === g) {
            f.ring.push(end);
            callback(f.ring);
          } else {
            fragmentByStart[g.start] = fragmentByEnd[f.end] = {start: g.start, end: f.end, ring: g.ring.concat(f.ring)};
          }
        } else {
          delete fragmentByStart[f.start];
          f.ring.unshift(start);
          fragmentByStart[f.start = startIndex] = f;
        }
      } else {
        fragmentByStart[startIndex] = fragmentByEnd[endIndex] = {start: startIndex, end: endIndex, ring: [start, end]};
      }
    }
  }

  function index(point) {
    return point[0] * 2 + point[1] * (dx + 1) * 4;
  }

  function smoothLinear(ring, values, value) {
    ring.forEach(function(point) {
      var x = point[0],
          y = point[1],
          xt = x | 0,
          yt = y | 0,
          v0,
          v1 = values[yt * dx + xt];
      if (x > 0 && x < dx && xt === x) {
        v0 = values[yt * dx + xt - 1];
        point[0] = x + (value - v0) / (v1 - v0) - 0.5;
      }
      if (y > 0 && y < dy && yt === y) {
        v0 = values[(yt - 1) * dx + xt];
        point[1] = y + (value - v0) / (v1 - v0) - 0.5;
      }
    });
  }

  contours.contour = contour;

  contours.size = function(_) {
    if (!arguments.length) return [dx, dy];
    var _0 = Math.floor(_[0]), _1 = Math.floor(_[1]);
    if (!(_0 >= 0 && _1 >= 0)) throw new Error("invalid size");
    return dx = _0, dy = _1, contours;
  };

  contours.thresholds = function(_) {
    return arguments.length ? (threshold = typeof _ === "function" ? _ : Array.isArray(_) ? constant(slice.call(_)) : constant(_), contours) : threshold;
  };

  contours.smooth = function(_) {
    return arguments.length ? (smooth = _ ? smoothLinear : noop, contours) : smooth === smoothLinear;
  };

  return contours;
}

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
            holes += 'Z';
        }
    }
    return `${_pathWithHoles} ${holes}`;
}

/*!
 * vanilla-picker v2.12.1
 * https://vanilla-picker.js.org
 *
 * Copyright 2017-2021 Andreas Borgen (https://github.com/Sphinxxxx), Adam Brooks (https://github.com/dissimulate)
 * Released under the ISC license.
 */
var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

String.prototype.startsWith = String.prototype.startsWith || function (needle) {
    return this.indexOf(needle) === 0;
};
String.prototype.padStart = String.prototype.padStart || function (len, pad) {
    var str = this;while (str.length < len) {
        str = pad + str;
    }return str;
};

var colorNames = { cb: '0f8ff', tqw: 'aebd7', q: '-ffff', qmrn: '7fffd4', zr: '0ffff', bg: '5f5dc', bsq: 'e4c4', bck: '---', nch: 'ebcd', b: '--ff', bvt: '8a2be2', brwn: 'a52a2a', brw: 'deb887', ctb: '5f9ea0', hrt: '7fff-', chcT: 'd2691e', cr: '7f50', rnw: '6495ed', crns: '8dc', crms: 'dc143c', cn: '-ffff', Db: '--8b', Dcn: '-8b8b', Dgnr: 'b8860b', Dgr: 'a9a9a9', Dgrn: '-64-', Dkhk: 'bdb76b', Dmgn: '8b-8b', Dvgr: '556b2f', Drng: '8c-', Drch: '9932cc', Dr: '8b--', Dsmn: 'e9967a', Dsgr: '8fbc8f', DsTb: '483d8b', DsTg: '2f4f4f', Dtrq: '-ced1', Dvt: '94-d3', ppnk: '1493', pskb: '-bfff', mgr: '696969', grb: '1e90ff', rbrc: 'b22222', rwht: 'af0', stg: '228b22', chs: '-ff', gnsb: 'dcdcdc', st: '8f8ff', g: 'd7-', gnr: 'daa520', gr: '808080', grn: '-8-0', grnw: 'adff2f', hnw: '0fff0', htpn: '69b4', nnr: 'cd5c5c', ng: '4b-82', vr: '0', khk: '0e68c', vnr: 'e6e6fa', nrb: '0f5', wngr: '7cfc-', mnch: 'acd', Lb: 'add8e6', Lcr: '08080', Lcn: 'e0ffff', Lgnr: 'afad2', Lgr: 'd3d3d3', Lgrn: '90ee90', Lpnk: 'b6c1', Lsmn: 'a07a', Lsgr: '20b2aa', Lskb: '87cefa', LsTg: '778899', Lstb: 'b0c4de', Lw: 'e0', m: '-ff-', mgrn: '32cd32', nn: 'af0e6', mgnt: '-ff', mrn: '8--0', mqm: '66cdaa', mmb: '--cd', mmrc: 'ba55d3', mmpr: '9370db', msg: '3cb371', mmsT: '7b68ee', '': '-fa9a', mtr: '48d1cc', mmvt: 'c71585', mnLb: '191970', ntc: '5fffa', mstr: 'e4e1', mccs: 'e4b5', vjw: 'dead', nv: '--80', c: 'df5e6', v: '808-0', vrb: '6b8e23', rng: 'a5-', rngr: '45-', rch: 'da70d6', pgnr: 'eee8aa', pgrn: '98fb98', ptrq: 'afeeee', pvtr: 'db7093', ppwh: 'efd5', pchp: 'dab9', pr: 'cd853f', pnk: 'c0cb', pm: 'dda0dd', pwrb: 'b0e0e6', prp: '8-080', cc: '663399', r: '--', sbr: 'bc8f8f', rb: '4169e1', sbrw: '8b4513', smn: 'a8072', nbr: '4a460', sgrn: '2e8b57', ssh: '5ee', snn: 'a0522d', svr: 'c0c0c0', skb: '87ceeb', sTb: '6a5acd', sTgr: '708090', snw: 'afa', n: '-ff7f', stb: '4682b4', tn: 'd2b48c', t: '-8080', thst: 'd8bfd8', tmT: '6347', trqs: '40e0d0', vt: 'ee82ee', whT: '5deb3', wht: '', hts: '5f5f5', w: '-', wgrn: '9acd32' };

function printNum(num) {
    var decs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

    var str = decs > 0 ? num.toFixed(decs).replace(/0+$/, '').replace(/\.$/, '') : num.toString();
    return str || '0';
}

var Color = function () {
    function Color(r, g, b, a) {
        classCallCheck(this, Color);


        var that = this;
        function parseString(input) {

            if (input.startsWith('hsl')) {
                var _input$match$map = input.match(/([\-\d\.e]+)/g).map(Number),
                    _input$match$map2 = slicedToArray(_input$match$map, 4),
                    h = _input$match$map2[0],
                    s = _input$match$map2[1],
                    l = _input$match$map2[2],
                    _a = _input$match$map2[3];

                if (_a === undefined) {
                    _a = 1;
                }

                h /= 360;
                s /= 100;
                l /= 100;
                that.hsla = [h, s, l, _a];
            } else if (input.startsWith('rgb')) {
                var _input$match$map3 = input.match(/([\-\d\.e]+)/g).map(Number),
                    _input$match$map4 = slicedToArray(_input$match$map3, 4),
                    _r = _input$match$map4[0],
                    _g = _input$match$map4[1],
                    _b = _input$match$map4[2],
                    _a2 = _input$match$map4[3];

                if (_a2 === undefined) {
                    _a2 = 1;
                }

                that.rgba = [_r, _g, _b, _a2];
            } else {
                if (input.startsWith('#')) {
                    that.rgba = Color.hexToRgb(input);
                } else {
                    that.rgba = Color.nameToRgb(input) || Color.hexToRgb(input);
                }
            }
        }

        if (r === undefined) ; else if (Array.isArray(r)) {
            this.rgba = r;
        } else if (b === undefined) {
            var color = r && '' + r;
            if (color) {
                parseString(color.toLowerCase());
            }
        } else {
            this.rgba = [r, g, b, a === undefined ? 1 : a];
        }
    }

    createClass(Color, [{
        key: 'printRGB',
        value: function printRGB(alpha) {
            var rgb = alpha ? this.rgba : this.rgba.slice(0, 3),
                vals = rgb.map(function (x, i) {
                return printNum(x, i === 3 ? 3 : 0);
            });

            return alpha ? 'rgba(' + vals + ')' : 'rgb(' + vals + ')';
        }
    }, {
        key: 'printHSL',
        value: function printHSL(alpha) {
            var mults = [360, 100, 100, 1],
                suff = ['', '%', '%', ''];

            var hsl = alpha ? this.hsla : this.hsla.slice(0, 3),
                vals = hsl.map(function (x, i) {
                return printNum(x * mults[i], i === 3 ? 3 : 1) + suff[i];
            });

            return alpha ? 'hsla(' + vals + ')' : 'hsl(' + vals + ')';
        }
    }, {
        key: 'printHex',
        value: function printHex(alpha) {
            var hex = this.hex;
            return alpha ? hex : hex.substring(0, 7);
        }
    }, {
        key: 'rgba',
        get: function get() {
            if (this._rgba) {
                return this._rgba;
            }
            if (!this._hsla) {
                throw new Error('No color is set');
            }

            return this._rgba = Color.hslToRgb(this._hsla);
        },
        set: function set(rgb) {
            if (rgb.length === 3) {
                rgb[3] = 1;
            }

            this._rgba = rgb;
            this._hsla = null;
        }
    }, {
        key: 'rgbString',
        get: function get() {
            return this.printRGB();
        }
    }, {
        key: 'rgbaString',
        get: function get() {
            return this.printRGB(true);
        }
    }, {
        key: 'hsla',
        get: function get() {
            if (this._hsla) {
                return this._hsla;
            }
            if (!this._rgba) {
                throw new Error('No color is set');
            }

            return this._hsla = Color.rgbToHsl(this._rgba);
        },
        set: function set(hsl) {
            if (hsl.length === 3) {
                hsl[3] = 1;
            }

            this._hsla = hsl;
            this._rgba = null;
        }
    }, {
        key: 'hslString',
        get: function get() {
            return this.printHSL();
        }
    }, {
        key: 'hslaString',
        get: function get() {
            return this.printHSL(true);
        }
    }, {
        key: 'hex',
        get: function get() {
            var rgb = this.rgba,
                hex = rgb.map(function (x, i) {
                return i < 3 ? x.toString(16) : Math.round(x * 255).toString(16);
            });

            return '#' + hex.map(function (x) {
                return x.padStart(2, '0');
            }).join('');
        },
        set: function set(hex) {
            this.rgba = Color.hexToRgb(hex);
        }
    }], [{
        key: 'hexToRgb',
        value: function hexToRgb(input) {

            var hex = (input.startsWith('#') ? input.slice(1) : input).replace(/^(\w{3})$/, '$1F').replace(/^(\w)(\w)(\w)(\w)$/, '$1$1$2$2$3$3$4$4').replace(/^(\w{6})$/, '$1FF');

            if (!hex.match(/^([0-9a-fA-F]{8})$/)) {
                throw new Error('Unknown hex color; ' + input);
            }

            var rgba = hex.match(/^(\w\w)(\w\w)(\w\w)(\w\w)$/).slice(1).map(function (x) {
                return parseInt(x, 16);
            });

            rgba[3] = rgba[3] / 255;
            return rgba;
        }
    }, {
        key: 'nameToRgb',
        value: function nameToRgb(input) {

            var hash = input.toLowerCase().replace('at', 'T').replace(/[aeiouyldf]/g, '').replace('ght', 'L').replace('rk', 'D').slice(-5, 4),
                hex = colorNames[hash];
            return hex === undefined ? hex : Color.hexToRgb(hex.replace(/\-/g, '00').padStart(6, 'f'));
        }
    }, {
        key: 'rgbToHsl',
        value: function rgbToHsl(_ref) {
            var _ref2 = slicedToArray(_ref, 4),
                r = _ref2[0],
                g = _ref2[1],
                b = _ref2[2],
                a = _ref2[3];

            r /= 255;
            g /= 255;
            b /= 255;

            var max = Math.max(r, g, b),
                min = Math.min(r, g, b);
            var h = void 0,
                s = void 0,
                l = (max + min) / 2;

            if (max === min) {
                h = s = 0;
            } else {
                var d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r:
                        h = (g - b) / d + (g < b ? 6 : 0);break;
                    case g:
                        h = (b - r) / d + 2;break;
                    case b:
                        h = (r - g) / d + 4;break;
                }

                h /= 6;
            }

            return [h, s, l, a];
        }
    }, {
        key: 'hslToRgb',
        value: function hslToRgb(_ref3) {
            var _ref4 = slicedToArray(_ref3, 4),
                h = _ref4[0],
                s = _ref4[1],
                l = _ref4[2],
                a = _ref4[3];

            var r = void 0,
                g = void 0,
                b = void 0;

            if (s === 0) {
                r = g = b = l;
            } else {
                var hue2rgb = function hue2rgb(p, q, t) {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s,
                    p = 2 * l - q;

                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            var rgba = [r * 255, g * 255, b * 255].map(Math.round);
            rgba[3] = a;

            return rgba;
        }
    }]);
    return Color;
}();

var EventBucket = function () {
    function EventBucket() {
        classCallCheck(this, EventBucket);

        this._events = [];
    }

    createClass(EventBucket, [{
        key: 'add',
        value: function add(target, type, handler) {
            target.addEventListener(type, handler, false);
            this._events.push({
                target: target,
                type: type,
                handler: handler
            });
        }
    }, {
        key: 'remove',
        value: function remove(target, type, handler) {
            this._events = this._events.filter(function (e) {
                var isMatch = true;
                if (target && target !== e.target) {
                    isMatch = false;
                }
                if (type && type !== e.type) {
                    isMatch = false;
                }
                if (handler && handler !== e.handler) {
                    isMatch = false;
                }

                if (isMatch) {
                    EventBucket._doRemove(e.target, e.type, e.handler);
                }
                return !isMatch;
            });
        }
    }, {
        key: 'destroy',
        value: function destroy() {
            this._events.forEach(function (e) {
                return EventBucket._doRemove(e.target, e.type, e.handler);
            });
            this._events = [];
        }
    }], [{
        key: '_doRemove',
        value: function _doRemove(target, type, handler) {
            target.removeEventListener(type, handler, false);
        }
    }]);
    return EventBucket;
}();

function parseHTML(htmlString) {

    var div = document.createElement('div');
    div.innerHTML = htmlString;
    return div.firstElementChild;
}

function dragTrack(eventBucket, area, callback) {
    var dragging = false;

    function clamp(val, min, max) {
        return Math.max(min, Math.min(val, max));
    }

    function onMove(e, info, starting) {
        if (starting) {
            dragging = true;
        }
        if (!dragging) {
            return;
        }

        e.preventDefault();

        var bounds = area.getBoundingClientRect(),
            w = bounds.width,
            h = bounds.height,
            x = info.clientX,
            y = info.clientY;

        var relX = clamp(x - bounds.left, 0, w),
            relY = clamp(y - bounds.top, 0, h);

        callback(relX / w, relY / h);
    }

    function onMouse(e, starting) {
        var button = e.buttons === undefined ? e.which : e.buttons;
        if (button === 1) {
            onMove(e, e, starting);
        } else {
            dragging = false;
        }
    }

    function onTouch(e, starting) {
        if (e.touches.length === 1) {
            onMove(e, e.touches[0], starting);
        } else {
            dragging = false;
        }
    }

    eventBucket.add(area, 'mousedown', function (e) {
        onMouse(e, true);
    });
    eventBucket.add(area, 'touchstart', function (e) {
        onTouch(e, true);
    });
    eventBucket.add(window, 'mousemove', onMouse);
    eventBucket.add(area, 'touchmove', onTouch);
    eventBucket.add(window, 'mouseup', function (e) {
        dragging = false;
    });
    eventBucket.add(area, 'touchend', function (e) {
        dragging = false;
    });
    eventBucket.add(area, 'touchcancel', function (e) {
        dragging = false;
    });
}

var BG_TRANSP = 'linear-gradient(45deg, lightgrey 25%, transparent 25%, transparent 75%, lightgrey 75%) 0 0 / 2em 2em,\n                   linear-gradient(45deg, lightgrey 25%,       white 25%,       white 75%, lightgrey 75%) 1em 1em / 2em 2em';
var HUES = 360;

var EVENT_KEY = 'keydown',
    EVENT_CLICK_OUTSIDE = 'mousedown',
    EVENT_TAB_MOVE = 'focusin';

function $(selector, context) {
    return (context || document).querySelector(selector);
}

function stopEvent(e) {

    e.preventDefault();
    e.stopPropagation();
}
function onKey(bucket, target, keys, handler, stop) {
    bucket.add(target, EVENT_KEY, function (e) {
        if (keys.indexOf(e.key) >= 0) {
            if (stop) {
                stopEvent(e);
            }
            handler(e);
        }
    });
}

var Picker = function () {
    function Picker(options) {
        classCallCheck(this, Picker);


        this.settings = {

            popup: 'right',
            layout: 'default',
            alpha: true,
            editor: true,
            editorFormat: 'hex',
            cancelButton: false,
            defaultColor: '#0cf'
        };

        this._events = new EventBucket();

        this.onChange = null;

        this.onDone = null;

        this.onOpen = null;

        this.onClose = null;

        this.setOptions(options);
    }

    createClass(Picker, [{
        key: 'setOptions',
        value: function setOptions(options) {
            var _this = this;

            if (!options) {
                return;
            }
            var settings = this.settings;

            function transfer(source, target, skipKeys) {
                for (var key in source) {
                    if (skipKeys && skipKeys.indexOf(key) >= 0) {
                        continue;
                    }

                    target[key] = source[key];
                }
            }

            if (options instanceof HTMLElement) {
                settings.parent = options;
            } else {

                if (settings.parent && options.parent && settings.parent !== options.parent) {
                    this._events.remove(settings.parent);
                    this._popupInited = false;
                }

                transfer(options, settings);

                if (options.onChange) {
                    this.onChange = options.onChange;
                }
                if (options.onDone) {
                    this.onDone = options.onDone;
                }
                if (options.onOpen) {
                    this.onOpen = options.onOpen;
                }
                if (options.onClose) {
                    this.onClose = options.onClose;
                }

                var col = options.color || options.colour;
                if (col) {
                    this._setColor(col);
                }
            }

            var parent = settings.parent;
            if (parent && settings.popup && !this._popupInited) {

                var openProxy = function openProxy(e) {
                    return _this.openHandler(e);
                };

                this._events.add(parent, 'click', openProxy);

                onKey(this._events, parent, [' ', 'Spacebar', 'Enter'], openProxy);

                this._popupInited = true;
            } else if (options.parent && !settings.popup) {
                this.show();
            }
        }
    }, {
        key: 'openHandler',
        value: function openHandler(e) {
            if (this.show()) {

                e && e.preventDefault();

                this.settings.parent.style.pointerEvents = 'none';

                var toFocus = e && e.type === EVENT_KEY ? this._domEdit : this.domElement;
                setTimeout(function () {
                    return toFocus.focus();
                }, 100);

                if (this.onOpen) {
                    this.onOpen(this.colour);
                }
            }
        }
    }, {
        key: 'closeHandler',
        value: function closeHandler(e) {
            var event = e && e.type;
            var doHide = false;

            if (!e) {
                doHide = true;
            } else if (event === EVENT_CLICK_OUTSIDE || event === EVENT_TAB_MOVE) {

                var knownTime = (this.__containedEvent || 0) + 100;
                if (e.timeStamp > knownTime) {
                    doHide = true;
                }
            } else {

                stopEvent(e);

                doHide = true;
            }

            if (doHide && this.hide()) {
                this.settings.parent.style.pointerEvents = '';

                if (event !== EVENT_CLICK_OUTSIDE) {
                    this.settings.parent.focus();
                }

                if (this.onClose) {
                    this.onClose(this.colour);
                }
            }
        }
    }, {
        key: 'movePopup',
        value: function movePopup(options, open) {

            this.closeHandler();

            this.setOptions(options);
            if (open) {
                this.openHandler();
            }
        }
    }, {
        key: 'setColor',
        value: function setColor(color, silent) {
            this._setColor(color, { silent: silent });
        }
    }, {
        key: '_setColor',
        value: function _setColor(color, flags) {
            if (typeof color === 'string') {
                color = color.trim();
            }
            if (!color) {
                return;
            }

            flags = flags || {};
            var c = void 0;
            try {

                c = new Color(color);
            } catch (ex) {
                if (flags.failSilently) {
                    return;
                }
                throw ex;
            }

            if (!this.settings.alpha) {
                var hsla = c.hsla;
                hsla[3] = 1;
                c.hsla = hsla;
            }
            this.colour = this.color = c;
            this._setHSLA(null, null, null, null, flags);
        }
    }, {
        key: 'setColour',
        value: function setColour(colour, silent) {
            this.setColor(colour, silent);
        }
    }, {
        key: 'show',
        value: function show() {
            var parent = this.settings.parent;
            if (!parent) {
                return false;
            }

            if (this.domElement) {
                var toggled = this._toggleDOM(true);

                this._setPosition();

                return toggled;
            }

            var html = this.settings.template || '<div class="picker_wrapper" tabindex="-1"><div class="picker_arrow"></div><div class="picker_hue picker_slider"><div class="picker_selector"></div></div><div class="picker_sl"><div class="picker_selector"></div></div><div class="picker_alpha picker_slider"><div class="picker_selector"></div></div><div class="picker_editor"><input aria-label="Type a color name or hex value"/></div><div class="picker_sample"></div><div class="picker_done"><button>Ok</button></div><div class="picker_cancel"><button>Cancel</button></div></div>';
            var wrapper = parseHTML(html);

            this.domElement = wrapper;
            this._domH = $('.picker_hue', wrapper);
            this._domSL = $('.picker_sl', wrapper);
            this._domA = $('.picker_alpha', wrapper);
            this._domEdit = $('.picker_editor input', wrapper);
            this._domSample = $('.picker_sample', wrapper);
            this._domOkay = $('.picker_done button', wrapper);
            this._domCancel = $('.picker_cancel button', wrapper);

            wrapper.classList.add('layout_' + this.settings.layout);
            if (!this.settings.alpha) {
                wrapper.classList.add('no_alpha');
            }
            if (!this.settings.editor) {
                wrapper.classList.add('no_editor');
            }
            if (!this.settings.cancelButton) {
                wrapper.classList.add('no_cancel');
            }
            this._ifPopup(function () {
                return wrapper.classList.add('popup');
            });

            this._setPosition();

            if (this.colour) {
                this._updateUI();
            } else {
                this._setColor(this.settings.defaultColor);
            }
            this._bindEvents();

            return true;
        }
    }, {
        key: 'hide',
        value: function hide() {
            return this._toggleDOM(false);
        }
    }, {
        key: 'destroy',
        value: function destroy() {
            this._events.destroy();
            if (this.domElement) {
                this.settings.parent.removeChild(this.domElement);
            }
        }
    }, {
        key: '_bindEvents',
        value: function _bindEvents() {
            var _this2 = this;

            var that = this,
                dom = this.domElement,
                events = this._events;

            function addEvent(target, type, handler) {
                events.add(target, type, handler);
            }

            addEvent(dom, 'click', function (e) {
                return e.preventDefault();
            });

            dragTrack(events, this._domH, function (x, y) {
                return that._setHSLA(x);
            });

            dragTrack(events, this._domSL, function (x, y) {
                return that._setHSLA(null, x, 1 - y);
            });

            if (this.settings.alpha) {
                dragTrack(events, this._domA, function (x, y) {
                    return that._setHSLA(null, null, null, 1 - y);
                });
            }

            var editInput = this._domEdit;
            {
                addEvent(editInput, 'input', function (e) {
                    that._setColor(this.value, { fromEditor: true, failSilently: true });
                });

                addEvent(editInput, 'focus', function (e) {
                    var input = this;

                    if (input.selectionStart === input.selectionEnd) {
                        input.select();
                    }
                });
            }

            this._ifPopup(function () {

                var popupCloseProxy = function popupCloseProxy(e) {
                    return _this2.closeHandler(e);
                };

                addEvent(window, EVENT_CLICK_OUTSIDE, popupCloseProxy);
                addEvent(window, EVENT_TAB_MOVE, popupCloseProxy);
                onKey(events, dom, ['Esc', 'Escape'], popupCloseProxy);

                var timeKeeper = function timeKeeper(e) {
                    _this2.__containedEvent = e.timeStamp;
                };
                addEvent(dom, EVENT_CLICK_OUTSIDE, timeKeeper);

                addEvent(dom, EVENT_TAB_MOVE, timeKeeper);

                addEvent(_this2._domCancel, 'click', popupCloseProxy);
            });

            var onDoneProxy = function onDoneProxy(e) {
                _this2._ifPopup(function () {
                    return _this2.closeHandler(e);
                });
                if (_this2.onDone) {
                    _this2.onDone(_this2.colour);
                }
            };
            addEvent(this._domOkay, 'click', onDoneProxy);
            onKey(events, dom, ['Enter'], onDoneProxy);
        }
    }, {
        key: '_setPosition',
        value: function _setPosition() {
            var parent = this.settings.parent,
                elm = this.domElement;

            if (parent !== elm.parentNode) {
                parent.appendChild(elm);
            }

            this._ifPopup(function (popup) {

                if (getComputedStyle(parent).position === 'static') {
                    parent.style.position = 'relative';
                }

                var cssClass = popup === true ? 'popup_right' : 'popup_' + popup;

                ['popup_top', 'popup_bottom', 'popup_left', 'popup_right'].forEach(function (c) {

                    if (c === cssClass) {
                        elm.classList.add(c);
                    } else {
                        elm.classList.remove(c);
                    }
                });

                elm.classList.add(cssClass);
            });
        }
    }, {
        key: '_setHSLA',
        value: function _setHSLA(h, s, l, a, flags) {
            flags = flags || {};

            var col = this.colour,
                hsla = col.hsla;

            [h, s, l, a].forEach(function (x, i) {
                if (x || x === 0) {
                    hsla[i] = x;
                }
            });
            col.hsla = hsla;

            this._updateUI(flags);

            if (this.onChange && !flags.silent) {
                this.onChange(col);
            }
        }
    }, {
        key: '_updateUI',
        value: function _updateUI(flags) {
            if (!this.domElement) {
                return;
            }
            flags = flags || {};

            var col = this.colour,
                hsl = col.hsla,
                cssHue = 'hsl(' + hsl[0] * HUES + ', 100%, 50%)',
                cssHSL = col.hslString,
                cssHSLA = col.hslaString;

            var uiH = this._domH,
                uiSL = this._domSL,
                uiA = this._domA,
                thumbH = $('.picker_selector', uiH),
                thumbSL = $('.picker_selector', uiSL),
                thumbA = $('.picker_selector', uiA);

            function posX(parent, child, relX) {
                child.style.left = relX * 100 + '%';
            }
            function posY(parent, child, relY) {
                child.style.top = relY * 100 + '%';
            }

            posX(uiH, thumbH, hsl[0]);

            this._domSL.style.backgroundColor = this._domH.style.color = cssHue;

            posX(uiSL, thumbSL, hsl[1]);
            posY(uiSL, thumbSL, 1 - hsl[2]);

            uiSL.style.color = cssHSL;

            posY(uiA, thumbA, 1 - hsl[3]);

            var opaque = cssHSL,
                transp = opaque.replace('hsl', 'hsla').replace(')', ', 0)'),
                bg = 'linear-gradient(' + [opaque, transp] + ')';

            this._domA.style.background = bg + ', ' + BG_TRANSP;

            if (!flags.fromEditor) {
                var format = this.settings.editorFormat,
                    alpha = this.settings.alpha;

                var value = void 0;
                switch (format) {
                    case 'rgb':
                        value = col.printRGB(alpha);break;
                    case 'hsl':
                        value = col.printHSL(alpha);break;
                    default:
                        value = col.printHex(alpha);
                }
                this._domEdit.value = value;
            }

            this._domSample.style.color = cssHSLA;
        }
    }, {
        key: '_ifPopup',
        value: function _ifPopup(actionIf, actionElse) {
            if (this.settings.parent && this.settings.popup) {
                actionIf && actionIf(this.settings.popup);
            } else {
                actionElse && actionElse();
            }
        }
    }, {
        key: '_toggleDOM',
        value: function _toggleDOM(toVisible) {
            var dom = this.domElement;
            if (!dom) {
                return false;
            }

            var displayStyle = toVisible ? '' : 'none',
                toggle = dom.style.display !== displayStyle;

            if (toggle) {
                dom.style.display = displayStyle;
            }
            return toggle;
        }
    }]);
    return Picker;
}();

/* src/components/ColorPicker.svelte generated by Svelte v3.49.0 */

function create_fragment$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			/*div_binding*/ ctx[6](div);
		},
		p: noop$1,
		i: noop$1,
		o: noop$1,
		d(detaching) {
			if (detaching) detach(div);
			/*div_binding*/ ctx[6](null);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { value = "#AAAAAAFF" } = $$props;
	let { options = {} } = $$props;

	let { onChange = () => {
		
	} } = $$props;

	let self;
	let pickerElem;

	function setColor(rgbaString) {
		pickerElem.setColor(rgbaString);
	}

	function setValue(val) {
		if (val === value) return;
		onChange(val, value);
		$$invalidate(1, value = val);
	}

	function _onChange(color) {
		setValue(color.hex);
	}

	onMount(() => {
		init(options);
	});

	onDestroy(() => {
		pickerElem.destroy();
	});

	function init(opts) {
		if (!self) return;
		if (pickerElem) pickerElem.destroy();
		opts.onChange = _onChange;

		$$invalidate(5, pickerElem = new Picker({
				parent: self,
				color: value,
				popup: false,
				...opts
			}));

		pickerElem.show();
		pickerElem.openHandler();
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			self = $$value;
			$$invalidate(0, self);
		});
	}

	$$self.$$set = $$props => {
		if ('value' in $$props) $$invalidate(1, value = $$props.value);
		if ('options' in $$props) $$invalidate(2, options = $$props.options);
		if ('onChange' in $$props) $$invalidate(3, onChange = $$props.onChange);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*pickerElem, value*/ 34) {
			if (pickerElem) {
				pickerElem.setColor(value);
			}
		}
	};

	return [self, value, options, onChange, setColor, pickerElem, div_binding];
}

class ColorPicker extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			value: 1,
			options: 2,
			onChange: 3,
			setColor: 4
		});
	}

	get setColor() {
		return this.$$.ctx[4];
	}
}

var ColorPicker$1 = ColorPicker;

const fontCheck = new Set([
    // Windows 10
    'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'HoloLens MDL2 Assets', 'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Palatino Linotype', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Historic', 'Segoe UI Emoji', 'Segoe UI Symbol', 'SimSun', 'Sitka', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic',
    // macOS
    'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72', 'Bodoni 72 Oldstyle', 'Bodoni 72 Smallcaps', 'Bradley Hand', 'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier', 'Courier New', 'Didot', 'DIN Alternate', 'DIN Condensed', 'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact', 'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo', 'Microsoft Sans Serif', 'Monaco', 'Noteworthy', 'Optima', 'Palatino', 'Papyrus', 'Phosphate', 'Rockwell', 'Savoye LET', 'SignPainter', 'Skia', 'Snell Roundhand', 'Tahoma', 'Times', 'Times New Roman', 'Trattatello', 'Trebuchet MS', 'Verdana', 'Zapfino',
].sort());

function getFonts() {
    const availableFonts = new Set();

    for (const font of fontCheck.values()) {
        if (document.fonts.check(`12px "${font}"`)) {
            availableFonts.add(font);
        }
    }

    return [...listFonts(), ...availableFonts.values()]
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

/* src/components/InlineStyleEditor.svelte generated by Svelte v3.49.0 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[62] = list[i];
	child_ctx[64] = list;
	child_ctx[65] = i;
	const constants_0 = /*choices*/ child_ctx[62].props[/*choices*/ child_ctx[62].selected];
	child_ctx[63] = constants_0;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[66] = list[i];
	return child_ctx;
}

function get_if_ctx(ctx) {
	const child_ctx = ctx.slice();
	const constants_0 = /*allCurrentPropDefs*/ child_ctx[13][/*selectedName*/ child_ctx[63]].choices();
	child_ctx[62] = constants_0;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[69] = list[i];
	child_ctx[71] = i;
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[72] = list[i];
	child_ctx[74] = i;
	return child_ctx;
}

function get_each_context_4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[75] = list[i];
	child_ctx[77] = i;
	return child_ctx;
}

function get_each_context_5(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[78] = list[i];
	child_ctx[80] = i;
	return child_ctx;
}

// (406:4) {#if targetsToSearch.length > 1}
function create_if_block_8(ctx) {
	let div;
	let b;
	let t1;
	let each_value_5 = /*targetsToSearch*/ ctx[1];
	let each_blocks = [];

	for (let i = 0; i < each_value_5.length; i += 1) {
		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
	}

	return {
		c() {
			div = element("div");
			b = element("b");
			b.textContent = "Elem";
			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "select-tab");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, b);
			append(div, t1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedElemIndex, selectedRuleIndex, targetsToSearch*/ 50) {
				each_value_5 = /*targetsToSearch*/ ctx[1];
				let i;

				for (i = 0; i < each_value_5.length; i += 1) {
					const child_ctx = get_each_context_5(ctx, each_value_5, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_5(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_5.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (409:8) {#each targetsToSearch as target, elemIndex}
function create_each_block_5(ctx) {
	let span;
	let t0;
	let t1;
	let t2;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[32](/*elemIndex*/ ctx[80]);
	}

	return {
		c() {
			span = element("span");
			t0 = text("Elem ");
			t1 = text(/*elemIndex*/ ctx[80]);
			t2 = space();
			toggle_class(span, "selected", /*selectedElemIndex*/ ctx[4] === /*elemIndex*/ ctx[80]);
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t0);
			append(span, t1);
			append(span, t2);

			if (!mounted) {
				dispose = listen(span, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*selectedElemIndex*/ 16) {
				toggle_class(span, "selected", /*selectedElemIndex*/ ctx[4] === /*elemIndex*/ ctx[80]);
			}
		},
		d(detaching) {
			if (detaching) detach(span);
			mounted = false;
			dispose();
		}
	};
}

// (418:8) {#each getRuleNames(allRules[selectedElemIndex]) as ruleName, ruleIndex}
function create_each_block_4(ctx) {
	let span;
	let t_value = /*ruleName*/ ctx[75] + "";
	let t;
	let span_title_value;
	let mounted;
	let dispose;

	function click_handler_1() {
		return /*click_handler_1*/ ctx[33](/*ruleIndex*/ ctx[77]);
	}

	return {
		c() {
			span = element("span");
			t = text(t_value);
			attr(span, "title", span_title_value = /*ruleName*/ ctx[75]);
			toggle_class(span, "selected", /*selectedRuleIndex*/ ctx[5] === /*ruleIndex*/ ctx[77]);
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);

			if (!mounted) {
				dispose = listen(span, "click", click_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*allRules, selectedElemIndex*/ 20 && t_value !== (t_value = /*ruleName*/ ctx[75] + "")) set_data(t, t_value);

			if (dirty[0] & /*allRules, selectedElemIndex*/ 20 && span_title_value !== (span_title_value = /*ruleName*/ ctx[75])) {
				attr(span, "title", span_title_value);
			}

			if (dirty[0] & /*selectedRuleIndex*/ 32) {
				toggle_class(span, "selected", /*selectedRuleIndex*/ ctx[5] === /*ruleIndex*/ ctx[77]);
			}
		},
		d(detaching) {
			if (detaching) detach(span);
			mounted = false;
			dispose();
		}
	};
}

// (429:12) {#if type !== 'custom' || (currentRule === 'inline' && type === 'custom' && hasDisplayedCustom )}
function create_if_block_7(ctx) {
	let span;
	let t0_value = /*type*/ ctx[72] + "";
	let t0;
	let t1;
	let mounted;
	let dispose;

	function click_handler_2() {
		return /*click_handler_2*/ ctx[34](/*typeIndex*/ ctx[74]);
	}

	return {
		c() {
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			toggle_class(span, "selected", /*selectedTypeIndex*/ ctx[6] === /*typeIndex*/ ctx[74]);
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t0);
			append(span, t1);

			if (!mounted) {
				dispose = listen(span, "click", click_handler_2);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*allTypes, selectedElemIndex*/ 24 && t0_value !== (t0_value = /*type*/ ctx[72] + "")) set_data(t0, t0_value);

			if (dirty[0] & /*selectedTypeIndex*/ 64) {
				toggle_class(span, "selected", /*selectedTypeIndex*/ ctx[6] === /*typeIndex*/ ctx[74]);
			}
		},
		d(detaching) {
			if (detaching) detach(span);
			mounted = false;
			dispose();
		}
	};
}

// (427:8) {#each allTypes[selectedElemIndex] || [] as type, typeIndex}
function create_each_block_3(ctx) {
	let if_block_anchor;
	let if_block = (/*type*/ ctx[72] !== 'custom' || /*currentRule*/ ctx[16] === 'inline' && /*type*/ ctx[72] === 'custom' && /*hasDisplayedCustom*/ ctx[15]) && create_if_block_7(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (/*type*/ ctx[72] !== 'custom' || /*currentRule*/ ctx[16] === 'inline' && /*type*/ ctx[72] === 'custom' && /*hasDisplayedCustom*/ ctx[15]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_7(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (434:4) {#if allTypes[selectedElemIndex]}
function create_if_block(ctx) {
	let div;
	let t;
	let current;
	let each_value = /*propsByType*/ ctx[12];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	let if_block = /*currentRule*/ ctx[16] === 'inline' && /*bringableToFront*/ ctx[14][/*selectedElemIndex*/ ctx[4]] !== null && create_if_block_1(ctx);

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
			if (if_block) if_block.c();
			attr(div, "class", "editor");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}

			append(div, t);
			if (if_block) if_block.m(div, null);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty[0] & /*allCurrentPropDefs, propsByType, updateProp, deleteProp*/ 1323008) {
				each_value = /*propsByType*/ ctx[12];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div, t);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			if (/*currentRule*/ ctx[16] === 'inline' && /*bringableToFront*/ ctx[14][/*selectedElemIndex*/ ctx[4]] !== null) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_1(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
			if (if_block) if_block.d();
		}
	};
}

// (445:16) {:else}
function create_else_block(ctx) {
	let span;
	let t_value = /*selectedName*/ ctx[63] + "";
	let t;

	return {
		c() {
			span = element("span");
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*propsByType*/ 4096 && t_value !== (t_value = /*selectedName*/ ctx[63] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (439:16) {#if choices.props.length > 1}
function create_if_block_6(ctx) {
	let div;
	let select;
	let mounted;
	let dispose;
	let each_value_2 = /*choices*/ ctx[62].props;
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	function change_handler(...args) {
		return /*change_handler*/ ctx[35](/*choices*/ ctx[62], /*each_value*/ ctx[64], /*choices_index*/ ctx[65], ...args);
	}

	return {
		c() {
			div = element("div");
			select = element("select");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, select);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select, null);
			}

			if (!mounted) {
				dispose = listen(select, "change", change_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*propsByType*/ 4096) {
				each_value_2 = /*choices*/ ctx[62].props;
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

// (441:24) {#each choices.props as propName, i}
function create_each_block_2(ctx) {
	let option;
	let t0_value = /*propName*/ ctx[69] + "";
	let t0;
	let t1;
	let option_selected_value;

	return {
		c() {
			option = element("option");
			t0 = text(t0_value);
			t1 = space();
			option.selected = option_selected_value = /*i*/ ctx[71] === /*choices*/ ctx[62].selected;
			option.__value = /*i*/ ctx[71];
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t0);
			append(option, t1);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*propsByType*/ 4096 && t0_value !== (t0_value = /*propName*/ ctx[69] + "")) set_data(t0, t0_value);

			if (dirty[0] & /*propsByType*/ 4096 && option_selected_value !== (option_selected_value = /*i*/ ctx[71] === /*choices*/ ctx[62].selected)) {
				option.selected = option_selected_value;
			}
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (468:50) 
function create_if_block_5(ctx) {
	let colorpicker;
	let current;

	function func(...args) {
		return /*func*/ ctx[39](/*selectedName*/ ctx[63], ...args);
	}

	colorpicker = new ColorPicker$1({
			props: {
				value: /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value,
				onChange: func
			}
		});

	return {
		c() {
			create_component(colorpicker.$$.fragment);
		},
		m(target, anchor) {
			mount_component(colorpicker, target, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const colorpicker_changes = {};
			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288) colorpicker_changes.value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value;
			if (dirty[0] & /*propsByType*/ 4096) colorpicker_changes.onChange = func;
			colorpicker.$set(colorpicker_changes);
		},
		i(local) {
			if (current) return;
			transition_in(colorpicker.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(colorpicker.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(colorpicker, detaching);
		}
	};
}

// (458:51) 
function create_if_block_3(ctx) {
	let select;
	let show_if = !/*choices*/ ctx[62].includes(/*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value);
	let if_block_anchor;
	let mounted;
	let dispose;
	let if_block = show_if && create_if_block_4();
	let each_value_1 = /*choices*/ ctx[62];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	function change_handler_2(...args) {
		return /*change_handler_2*/ ctx[38](/*selectedName*/ ctx[63], ...args);
	}

	return {
		c() {
			select = element("select");
			if (if_block) if_block.c();
			if_block_anchor = empty();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
		},
		m(target, anchor) {
			insert(target, select, anchor);
			if (if_block) if_block.m(select, null);
			append(select, if_block_anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select, null);
			}

			if (!mounted) {
				dispose = listen(select, "change", change_handler_2);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288) show_if = !/*choices*/ ctx[62].includes(/*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value);

			if (show_if) {
				if (if_block) ; else {
					if_block = create_if_block_4();
					if_block.c();
					if_block.m(select, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288) {
				each_value_1 = /*choices*/ ctx[62];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		i: noop$1,
		o: noop$1,
		d(detaching) {
			if (detaching) detach(select);
			if (if_block) if_block.d();
			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

// (449:16) {#if choices.type === 'slider'}
function create_if_block_2(ctx) {
	let input;
	let input_min_value;
	let input_max_value;
	let input_step_value;
	let input_value_value;
	let t0;
	let span;
	let t1_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].displayed + "";
	let t1;
	let mounted;
	let dispose;

	function change_handler_1(...args) {
		return /*change_handler_1*/ ctx[37](/*selectedName*/ ctx[63], ...args);
	}

	return {
		c() {
			input = element("input");
			t0 = space();
			span = element("span");
			t1 = text(t1_value);
			attr(input, "type", "range");
			attr(input, "min", input_min_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].min);
			attr(input, "max", input_max_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].max);
			attr(input, "step", input_step_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].step || 1);
			input.value = input_value_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value;
			attr(span, "class", "current-value");
		},
		m(target, anchor) {
			insert(target, input, anchor);
			insert(target, t0, anchor);
			insert(target, span, anchor);
			append(span, t1);

			if (!mounted) {
				dispose = listen(input, "change", change_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && input_min_value !== (input_min_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].min)) {
				attr(input, "min", input_min_value);
			}

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && input_max_value !== (input_max_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].max)) {
				attr(input, "max", input_max_value);
			}

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && input_step_value !== (input_step_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].step || 1)) {
				attr(input, "step", input_step_value);
			}

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && input_value_value !== (input_value_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value)) {
				input.value = input_value_value;
			}

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && t1_value !== (t1_value = /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].displayed + "")) set_data(t1, t1_value);
		},
		i: noop$1,
		o: noop$1,
		d(detaching) {
			if (detaching) detach(input);
			if (detaching) detach(t0);
			if (detaching) detach(span);
			mounted = false;
			dispose();
		}
	};
}

// (461:24) {#if !choices.includes(allCurrentPropDefs[selectedName].value)}
function create_if_block_4(ctx) {
	let option;

	return {
		c() {
			option = element("option");
			option.textContent = "--- ";
			option.selected = "true";
			option.__value = " --- ";
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (464:24) {#each choices as choice}
function create_each_block_1(ctx) {
	let option;
	let t_value = /*choice*/ ctx[66] + "";
	let t;
	let option_selected_value;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t = text(t_value);
			option.selected = option_selected_value = /*choice*/ ctx[66] == /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value || null;
			option.__value = option_value_value = " " + /*choice*/ ctx[66] + " ";
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && t_value !== (t_value = /*choice*/ ctx[66] + "")) set_data(t, t_value);

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && option_selected_value !== (option_selected_value = /*choice*/ ctx[66] == /*allCurrentPropDefs*/ ctx[13][/*selectedName*/ ctx[63]].value || null)) {
				option.selected = option_selected_value;
			}

			if (dirty[0] & /*allCurrentPropDefs, propsByType*/ 12288 && option_value_value !== (option_value_value = " " + /*choice*/ ctx[66] + " ")) {
				option.__value = option_value_value;
				option.value = option.__value;
			}
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (436:8) {#each propsByType as choices}
function create_each_block(ctx) {
	let div;
	let t0;
	let span;
	let t2;
	let current_block_type_index;
	let if_block1;
	let current;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*choices*/ ctx[62].props.length > 1) return create_if_block_6;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);

	function click_handler_3() {
		return /*click_handler_3*/ ctx[36](/*selectedName*/ ctx[63]);
	}

	const if_block_creators = [create_if_block_2, create_if_block_3, create_if_block_5];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*choices*/ ctx[62].type === 'slider') return 0;
		if (/*choices*/ ctx[62].type == 'select') return 1;
		if (/*choices*/ ctx[62].type == 'color') return 2;
		return -1;
	}

	function select_block_ctx(ctx, index) {
		if (index === 1) return get_if_ctx(ctx);
		return ctx;
	}

	if (~(current_block_type_index = select_block_type_1(ctx))) {
		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](select_block_ctx(ctx, current_block_type_index));
	}

	return {
		c() {
			div = element("div");
			if_block0.c();
			t0 = space();
			span = element("span");
			span.textContent = "✕";
			t2 = space();
			if (if_block1) if_block1.c();
			attr(span, "class", "delete");
			attr(div, "class", "prop-section");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if_block0.m(div, null);
			append(div, t0);
			append(div, span);
			append(div, t2);

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(div, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen(span, "click", click_handler_3);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(div, t0);
				}
			}

			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(select_block_ctx(ctx, current_block_type_index), dirty);
				}
			} else {
				if (if_block1) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block1 = if_blocks[current_block_type_index];

					if (!if_block1) {
						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](select_block_ctx(ctx, current_block_type_index));
						if_block1.c();
					} else {
						if_block1.p(select_block_ctx(ctx, current_block_type_index), dirty);
					}

					transition_in(if_block1, 1);
					if_block1.m(div, null);
				} else {
					if_block1 = null;
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if_block0.d();

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d();
			}

			mounted = false;
			dispose();
		}
	};
}

// (476:8) {#if currentRule === 'inline' && bringableToFront[selectedElemIndex] !== null}
function create_if_block_1(ctx) {
	let div;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			div.textContent = "Bring to front";
			attr(div, "class", "btn");
			toggle_class(div, "active", /*bringableToFront*/ ctx[14][/*selectedElemIndex*/ ctx[4]] === true);
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (!mounted) {
				dispose = listen(div, "click", /*bringToFront*/ ctx[19]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*bringableToFront, selectedElemIndex*/ 16400) {
				toggle_class(div, "active", /*bringableToFront*/ ctx[14][/*selectedElemIndex*/ ctx[4]] === true);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let div0;
	let t0;
	let svg;
	let clipPath;
	let path;
	let rect;
	let svg_width_value;
	let svg_height_value;
	let t1;
	let div4;
	let div1;
	let t3;
	let t4;
	let div2;
	let b0;
	let t6;
	let t7;
	let div3;
	let b1;
	let t9;
	let t10;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*targetsToSearch*/ ctx[1].length > 1 && create_if_block_8(ctx);
	let each_value_4 = getRuleNames(/*allRules*/ ctx[2][/*selectedElemIndex*/ ctx[4]]);
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_4.length; i += 1) {
		each_blocks_1[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
	}

	let each_value_3 = /*allTypes*/ ctx[3][/*selectedElemIndex*/ ctx[4]] || [];
	let each_blocks = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	let if_block1 = /*allTypes*/ ctx[3][/*selectedElemIndex*/ ctx[4]] && create_if_block(ctx);

	return {
		c() {
			div0 = element("div");
			t0 = space();
			svg = svg_element("svg");
			clipPath = svg_element("clipPath");
			path = svg_element("path");
			rect = svg_element("rect");
			t1 = space();
			div4 = element("div");
			div1 = element("div");
			div1.textContent = "x";
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			div2 = element("div");
			b0 = element("b");
			b0.textContent = "Rule:";
			t6 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t7 = space();
			div3 = element("div");
			b1 = element("b");
			b1.textContent = "Property type:";
			t9 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t10 = space();
			if (if_block1) if_block1.c();
			set_style(div0, "position", "absolute");
			attr(path, "d", /*pathWithHoles*/ ctx[10]);
			attr(clipPath, "id", "overlay-clip");
			attr(clipPath, "clip-rule", "evenodd");
			attr(rect, "y", "0");
			attr(rect, "x", "0");
			attr(rect, "height", "100%");
			attr(rect, "width", "100%");
			attr(rect, "class", "overlay-over");
			attr(svg, "class", "ise-helper-wrapper");
			attr(svg, "version", "1.1");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
			attr(svg, "width", svg_width_value = /*pageDimensions*/ ctx[11].width);
			attr(svg, "height", svg_height_value = /*pageDimensions*/ ctx[11].height);
			attr(div1, "class", "close-button");
			attr(div2, "class", "select-tab");
			attr(div3, "class", "select-tab");
			attr(div4, "class", "ise");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			/*div0_binding*/ ctx[30](div0);
			insert(target, t0, anchor);
			insert(target, svg, anchor);
			append(svg, clipPath);
			append(clipPath, path);
			append(svg, rect);
			/*svg_binding*/ ctx[31](svg);
			insert(target, t1, anchor);
			insert(target, div4, anchor);
			append(div4, div1);
			append(div4, t3);
			if (if_block0) if_block0.m(div4, null);
			append(div4, t4);
			append(div4, div2);
			append(div2, b0);
			append(div2, t6);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(div2, null);
			}

			append(div4, t7);
			append(div4, div3);
			append(div3, b1);
			append(div3, t9);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div3, null);
			}

			append(div4, t10);
			if (if_block1) if_block1.m(div4, null);
			/*div4_binding*/ ctx[40](div4);
			current = true;

			if (!mounted) {
				dispose = [
					listen(svg, "click", /*overlayClicked*/ ctx[17]),
					listen(div1, "click", /*close*/ ctx[0])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (!current || dirty[0] & /*pathWithHoles*/ 1024) {
				attr(path, "d", /*pathWithHoles*/ ctx[10]);
			}

			if (!current || dirty[0] & /*pageDimensions*/ 2048 && svg_width_value !== (svg_width_value = /*pageDimensions*/ ctx[11].width)) {
				attr(svg, "width", svg_width_value);
			}

			if (!current || dirty[0] & /*pageDimensions*/ 2048 && svg_height_value !== (svg_height_value = /*pageDimensions*/ ctx[11].height)) {
				attr(svg, "height", svg_height_value);
			}

			if (/*targetsToSearch*/ ctx[1].length > 1) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_8(ctx);
					if_block0.c();
					if_block0.m(div4, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty[0] & /*allRules, selectedElemIndex, selectedRuleIndex, selectRule*/ 2097204) {
				each_value_4 = getRuleNames(/*allRules*/ ctx[2][/*selectedElemIndex*/ ctx[4]]);
				let i;

				for (i = 0; i < each_value_4.length; i += 1) {
					const child_ctx = get_each_context_4(ctx, each_value_4, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_4(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(div2, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_4.length;
			}

			if (dirty[0] & /*selectedTypeIndex, allTypes, selectedElemIndex, currentRule, hasDisplayedCustom*/ 98392) {
				each_value_3 = /*allTypes*/ ctx[3][/*selectedElemIndex*/ ctx[4]] || [];
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_3(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div3, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_3.length;
			}

			if (/*allTypes*/ ctx[3][/*selectedElemIndex*/ ctx[4]]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty[0] & /*allTypes, selectedElemIndex*/ 24) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div4, null);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			/*div0_binding*/ ctx[30](null);
			if (detaching) detach(t0);
			if (detaching) detach(svg);
			/*svg_binding*/ ctx[31](null);
			if (detaching) detach(t1);
			if (detaching) detach(div4);
			if (if_block0) if_block0.d();
			destroy_each(each_blocks_1, detaching);
			destroy_each(each_blocks, detaching);
			if (if_block1) if_block1.d();
			/*div4_binding*/ ctx[40](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

const typeText = "text";
const typeBorder = "border";
const typeStroke = "stroke";
const typeBackground = "background";
const customType = "custom";

function getRuleNames(rules) {
	if (!rules) return [];

	return rules.map((rule, i) => {
		if (rule === 'inline') return 'inline';
		const cssSelector = rule.selectorText;
		const title = rule.parentStyleSheet.title || `${i}`;
		return `${title}: ${cssSelector}`;
	});
}

function getBoundingBoxInfos(el, padding = 0) {
	const rect = el.getBoundingClientRect();

	return {
		left: rect.left + window.scrollX - padding,
		top: rect.top + window.scrollY - padding,
		width: rect.width + padding * 2,
		height: rect.height + padding * 2,
		right: rect.left + window.scrollX + rect.width + padding,
		bottom: rect.top + window.scrollY + rect.height + padding
	};
}

function cssRgbToHex(rgbStr) {
	const m = rgbStr.match(/[0-9\.]+/g).map(i => parseFloat(i));
	if (m.length === 3) m.push(1);

	return m.reduce(
		(hexStr, cur, i) => {
			if (i === 3) hexStr += Math.round(cur * 255).toString(16).padStart(2, '0'); else hexStr += cur.toString(16).padStart(2, '0');
			return hexStr;
		},
		'#'
	);
}

// type one of: "number", "rgb", "font", "raw"
function parsePropvalue(value, type = "number") {
	if (type == "raw") return value;
	if (type == "number" && (/[0-9]+(px)|(em)|(rem)/).test(value)) return parseInt(value);

	if (type == "rgb") {
		if (value === "none") return "#00000000";
		if (value.includes('rgb') || value[0] == "#") return cssRgbToHex(value);
	}

	return value;
}

function instance($$self, $$props, $$invalidate) {
	let currentElement;
	let currentRule;

	const strokeElements = [
		"altGlyph",
		"circle",
		"ellipse",
		"line",
		"path",
		"polygon",
		"polyline",
		"rect",
		"text",
		"textPath",
		"tref",
		"tspan"
	];

	const borderProps = ["border-radius", "border-width", "border-color", "border-style"];
	const backgroundProps = ["background-color"];
	const fontProps = ["font-family", "font-size", "font-weight", "color"];
	const pathProps = ["stroke-width", "stroke", "stroke-dasharray", "stroke-linejoin", "fill"];

	const cssPropByType = {
		"border-radius": {
			type: "slider",
			min: 0,
			max: 30,
			suffix: 'px'
		},
		"border-width": {
			type: "slider",
			min: 0,
			max: 30,
			suffix: 'px'
		},
		"border-style": {
			type: 'select',
			choices: () => [
				"none",
				"dotted",
				"dashed",
				"solid",
				"double",
				"groove",
				"ridge",
				"inset",
				"outset"
			]
		},
		"border-color": { type: "color" },
		"font-family": { type: 'select', choices: getFontFamilies },
		"font-size": {
			type: "slider",
			min: 0,
			max: 40,
			suffix: 'px'
		},
		"font-weight": { type: "slider", min: 0, max: 800 },
		"color": { type: "color" },
		"stroke-width": {
			type: "slider",
			min: 0,
			max: 20,
			step: 0.5,
			suffix: 'px'
		},
		'stroke': { type: "color" },
		"stroke-linejoin": {
			type: 'select',
			choices: () => ["bevel", "miter", "round"]
		},
		'fill': { type: "color" },
		"stroke-dasharray": {
			type: "slider",
			min: 0,
			max: 30,
			suffix: 'px'
		},
		"background-color": { type: "color" }
	};

	let { getAdditionalElems = () => {
		return [];
	} } = $$props;

	let { listenOnClick = false } = $$props;

	let { onStyleChanged = () => {
		
	} } = $$props;

	let { customProps = {} } = $$props;

	const propByType = {
		[typeText]: fontProps,
		[typeBorder]: borderProps,
		[typeStroke]: pathProps,
		[typeBackground]: backgroundProps,
		[customType]: Object.keys(customProps)
	};

	const inputTypeOrder = { slider: 0, select: 1, color: 2 };
	let elementToListen = null;
	let positionAnchor;
	let self;
	let helperElemWrapper;
	let pathWithHoles = '';
	let pageDimensions = { width: 0, height: 0 };
	let targetsToSearch = [];
	let allRules = []; // list of list of CSS rules, for every target element
	let allTypes = []; // list of list of types (e.g color, border), for every target element
	let selectedElemIndex = 0;
	let selectedRuleIndex = 0;
	let selectedTypeIndex = 0;
	let propsByType; // propType -> {[props], selected} 
	let allCurrentPropDefs = {}; // propName => selectorDef
	let bringableToFront = []; // null = not bringable, true = bringable, false = was bringed
	let hasDisplayedCustom = false;
	let curType;

	onMount(() => {
		close();
		$$invalidate(28, elementToListen = self.parentNode);
		document.body.appendChild(self);
		document.body.appendChild(helperElemWrapper);
		document.body.appendChild(positionAnchor);
		udpatePageDimensions();

		// make sure the layout is computed to get the client size
		setTimeout(
			() => {
				udpatePageDimensions();
			},
			1000
		);

		window.addEventListener('resize', udpatePageDimensions);
	});

	onDestroy(() => {
		window.removeEventListener('resize', udpatePageDimensions);
		if (listenOnClick) elementToListen.removeEventListener("click", getTargetsAndRules);
	});

	function getFontFamilies() {
		return getFonts();
	}

	function initAndGroup() {
		const allProps = { ...cssPropByType, ...customProps };
		const _allCurrentPropDefs = pick(allProps, propByType[curType]);

		Object.keys(_allCurrentPropDefs).forEach(key => {
			const propSelectType = _allCurrentPropDefs[key].type;
			let retrieveType = 'number';
			if (propSelectType === 'color') retrieveType = 'rgb'; else if (propSelectType === 'select') retrieveType = 'raw';

			if (_allCurrentPropDefs[key].getter) {
				const val = _allCurrentPropDefs[key].getter(currentElement);

				if (val === null) {
					delete _allCurrentPropDefs[key];
					return;
				}

				_allCurrentPropDefs[key].value = val;
				_allCurrentPropDefs[key].displayed = val;
			} else {
				_allCurrentPropDefs[key].displayed = getComputedPropValue(currentElement, key, 'raw');
				_allCurrentPropDefs[key].value = getComputedPropValue(currentElement, key, retrieveType);
			}
		});

		$$invalidate(12, propsByType = Object.entries(_allCurrentPropDefs).reduce(
			(byType, [propName, selectorDef]) => {
				const selectorType = selectorDef.type;
				const existing = byType.find(x => x.type === selectorType);

				if (!existing) byType.push({
					selected: 0,
					props: [propName],
					type: selectorType
				}); else existing.props.push(propName);

				return byType;
			},
			[]
		).sort((a, b) => {
			if (inputTypeOrder[a.type] < inputTypeOrder[b.type]) return -1;
			if (inputTypeOrder[a.type] > inputTypeOrder[b.type]) return 1;
			return 0;
		}));

		$$invalidate(13, allCurrentPropDefs = _allCurrentPropDefs);
		updateHelpers();
	}

	let warningDisplayed = new Set();

	function getMatchedCSSRules(elems) {
		const sheets = document.styleSheets;

		return elems.reduce(
			(matchedRulesByElem, el) => {
				const matchedRules = ['inline'];

				for (let i in sheets) {
					try {
						const rules = sheets[i].cssRules;

						for (let r in rules) {
							let selectorText = rules[r].selectorText;
							if (!selectorText || rules[r].selectorText.length > 50) continue; // skip selectors too long
							if (selectorText.split(',').some(selector => selector === '*')) continue; // skip * selector
							if (selectorText.endsWith(':hover')) selectorText = selectorText.substring(0, selectorText.length - (':hover').length);

							if (el.matches(selectorText)) {
								matchedRules.push(rules[r]);
							}
						}
					} catch(err) {
						if (!warningDisplayed.has(i)) {
							console.log('Style editor: Not able to access', sheets[i].ownerNode, 'sheet. Try CORS loading the sheet if you want to edit it.');
							warningDisplayed.add(i);
						}
					}
				}

				matchedRulesByElem.push(matchedRules);
				return matchedRulesByElem;
			},
			[]
		);
	}

	function getEditableTypes(elems) {
		return elems.reduce(
			(typesByElem, elem) => {
				const types = [];

				if (elem.firstChild && elem.firstChild.nodeType === 3) {
					// Node.TEXT_NODE
					types.push(typeText);
				}

				const elemTagName = elem.tagName.toLowerCase();
				let bringable = false;

				if (strokeElements.includes(elemTagName)) {
					types.push(typeStroke);
					const parentTag = elem.parentElement.tagName.toLowerCase();

					if (parentTag === 'g' && elem.previousElementSibling && elem.previousElementSibling.tagName.toLowerCase() == elemTagName) {
						bringable = true;
					}
				} else {
					types.push(typeBorder);
					types.push(typeBackground);
				}

				if (bringable) bringableToFront.push(true); else bringableToFront.push(null);
				typesByElem.push(types);
				return typesByElem;
			},
			[]
		);
	}

	function init() {
		if (listenOnClick) elementToListen.addEventListener("click", _open);
	}

	function _open(e) {
		open(e.target, e.pageX, e.pageY);
	}

	async function open(el, x, y) {
		udpatePageDimensions();
		if (el.classList.contains('overlay-over')) return overlayClicked(); else if (self.contains(el)) return;
		$$invalidate(4, selectedElemIndex = 0);
		$$invalidate(5, selectedRuleIndex = 0);
		$$invalidate(6, selectedTypeIndex = 0);
		$$invalidate(14, bringableToFront = []);
		$$invalidate(3, allTypes = []);
		$$invalidate(2, allRules = []);
		$$invalidate(1, targetsToSearch = [el, ...getAdditionalElems(el)]);
		$$invalidate(3, allTypes = getEditableTypes(targetsToSearch));
		$$invalidate(15, hasDisplayedCustom = false);
		$$invalidate(2, allRules = getMatchedCSSRules(targetsToSearch));

		for (let def of Object.values(customProps)) {
			if (def.getter(el) !== null) {
				$$invalidate(15, hasDisplayedCustom = true);
				break;
			}
		}

		if (Object.keys(customProps).length) {
			allTypes[0].push(customType);
		}

		await tick();
		initAndGroup();

		if (x && y) show(x, y); else {
			const rect = getBoundingBoxInfos(el, 15);
			show(rect.left, rect.top);
		}
	}

	function close() {
		$$invalidate(8, self.style.display = "none", self);
		$$invalidate(9, helperElemWrapper.style.display = "none", helperElemWrapper);
		$$invalidate(10, pathWithHoles = '');
	}

	function isOpened() {
		return self.style.display === 'block';
	}

	function overlayClicked() {
		close();
	}

	function show(x, y) {
		$$invalidate(8, self.style.display = "block", self);
		$$invalidate(8, self.style.opacity = 0, self);
		const popupDimension = self.getBoundingClientRect();

		x = x + popupDimension.width + 20 > pageDimensions.width
		? x - popupDimension.width - 20
		: x + 20;

		y = y + popupDimension.height + 20 > pageDimensions.height
		? y - popupDimension.height - 20
		: y + 20;

		$$invalidate(8, self.style.left = x + "px", self);
		$$invalidate(8, self.style.top = y + "px", self);
		$$invalidate(9, helperElemWrapper.style.display = "block", helperElemWrapper);
		$$invalidate(8, self.style.opacity = 1, self);
		updateHelpers();
	}

	async function updateHelpers() {
		await tick();
		if (!currentRule) return;
		let matching;

		if (currentRule === 'inline') matching = [currentElement]; else {
			const selector = currentRule.selectorText.replace(/(:hover)|:focus/g, '');
			matching = Array.from(document.querySelectorAll(selector));
		}

		const boundingBoxes = matching.map(el => getBoundingBoxInfos(el, 10));
		$$invalidate(10, pathWithHoles = computeContours(boundingBoxes, pageDimensions));
	}

	function _updateProp(propName, val, suffix) {
		const finalValue = suffix ? val + suffix : val;

		if (currentRule === 'inline') {
			if (allCurrentPropDefs[propName].setter) {
				allCurrentPropDefs[propName].setter(currentElement, val);
			} else {
				const style = currentElement.style; // do not trigger reactivity on currentElement
				style[propName] = finalValue;
			}
		} else currentRule.style.setProperty(propName, finalValue);

		$$invalidate(13, allCurrentPropDefs[propName].value = val, allCurrentPropDefs);
		$$invalidate(13, allCurrentPropDefs[propName].displayed = finalValue, allCurrentPropDefs);
		onStyleChanged(currentElement, currentRule, propName, finalValue);
		updateHelpers();
	}

	const updateProp = debounce(_updateProp, 100);

	function udpatePageDimensions() {
		const bodyStyle = getComputedStyle(document.body);
		const marginLeft = parseInt(bodyStyle.marginLeft);
		const marginRight = parseInt(bodyStyle.marginRight);
		const marginTop = parseInt(bodyStyle.marginTop);
		const marginBottom = parseInt(bodyStyle.marginBottom);

		$$invalidate(11, pageDimensions = {
			width: document.body.offsetWidth + marginLeft + marginRight,
			height: document.body.offsetHeight + marginTop + marginBottom
		});
	}

	function getComputedPropValue(el, cssProp, type = "number") {
		let currentStyleValue = currentRule?.style?.[cssProp];

		if (!currentStyleValue) {
			const computed = getComputedStyle(el);
			currentStyleValue = computed[cssProp];
		}

		return parsePropvalue(currentStyleValue, type);
	}

	function bringToFront() {
		$$invalidate(14, bringableToFront[selectedElemIndex] = false, bringableToFront);
		currentElement.parentNode.appendChild(currentElement);
		onStyleChanged(currentElement, currentRule, 'bringtofront', null);
	}

	function deleteProp(propName) {
		if (currentRule === 'inline') {
			currentElement.style.removeProperty(propName);
		} else {
			currentRule.style.removeProperty(propName);
		}

		onStyleChanged(currentElement, currentRule, propName, null);
		initAndGroup();
	}

	function selectRule(ruleIndex) {
		const newRule = allRules[selectedElemIndex]?.[ruleIndex];

		if (newRule !== 'inline' && selectedTypeIndex === allTypes[selectedElemIndex].length - 1) {
			$$invalidate(6, selectedTypeIndex = 0);
		}

		$$invalidate(5, selectedRuleIndex = ruleIndex);
	}

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			positionAnchor = $$value;
			$$invalidate(7, positionAnchor);
		});
	}

	function svg_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			helperElemWrapper = $$value;
			$$invalidate(9, helperElemWrapper);
		});
	}

	const click_handler = elemIndex => {
		$$invalidate(4, selectedElemIndex = elemIndex);
		$$invalidate(5, selectedRuleIndex = 0);
	};

	const click_handler_1 = ruleIndex => {
		selectRule(ruleIndex);
	};

	const click_handler_2 = typeIndex => {
		$$invalidate(6, selectedTypeIndex = typeIndex);
	};

	const change_handler = async (choices, each_value, choices_index, e) => {
		$$invalidate(12, each_value[choices_index].selected = e.target.value, propsByType);
		await tick();
	};

	const click_handler_3 = selectedName => deleteProp(selectedName);
	const change_handler_1 = (selectedName, e) => updateProp(selectedName, e.target.value, allCurrentPropDefs[selectedName].suffix, e.target);
	const change_handler_2 = (selectedName, e) => updateProp(selectedName, e.target.value);
	const func = (selectedName, color) => updateProp(selectedName, color);

	function div4_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			self = $$value;
			$$invalidate(8, self);
		});
	}

	$$self.$$set = $$props => {
		if ('getAdditionalElems' in $$props) $$invalidate(22, getAdditionalElems = $$props.getAdditionalElems);
		if ('listenOnClick' in $$props) $$invalidate(23, listenOnClick = $$props.listenOnClick);
		if ('onStyleChanged' in $$props) $$invalidate(24, onStyleChanged = $$props.onStyleChanged);
		if ('customProps' in $$props) $$invalidate(25, customProps = $$props.customProps);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*elementToListen*/ 268435456) {
			{
				if (elementToListen !== null) {
					init();
				}
			}
		}

		if ($$self.$$.dirty[0] & /*targetsToSearch, selectedElemIndex*/ 18) {
			currentElement = targetsToSearch[selectedElemIndex];
		}

		if ($$self.$$.dirty[0] & /*allRules, selectedElemIndex, selectedRuleIndex*/ 52) {
			$$invalidate(16, currentRule = allRules[selectedElemIndex]?.[selectedRuleIndex]);
		}

		if ($$self.$$.dirty[0] & /*allTypes, selectedElemIndex, selectedTypeIndex, curType*/ 536871000) {
			{
				if (allTypes[selectedElemIndex]?.[selectedTypeIndex] !== curType) {
					$$invalidate(29, curType = allTypes[selectedElemIndex]?.[selectedTypeIndex]);
				}
			}
		}

		if ($$self.$$.dirty[0] & /*curType, selectedRuleIndex, selectedElemIndex*/ 536870960) {
			{
				if (curType || selectedRuleIndex || selectedElemIndex) {
					initAndGroup();
				}
			}
		}
	};

	return [
		close,
		targetsToSearch,
		allRules,
		allTypes,
		selectedElemIndex,
		selectedRuleIndex,
		selectedTypeIndex,
		positionAnchor,
		self,
		helperElemWrapper,
		pathWithHoles,
		pageDimensions,
		propsByType,
		allCurrentPropDefs,
		bringableToFront,
		hasDisplayedCustom,
		currentRule,
		overlayClicked,
		updateProp,
		bringToFront,
		deleteProp,
		selectRule,
		getAdditionalElems,
		listenOnClick,
		onStyleChanged,
		customProps,
		open,
		isOpened,
		elementToListen,
		curType,
		div0_binding,
		svg_binding,
		click_handler,
		click_handler_1,
		click_handler_2,
		change_handler,
		click_handler_3,
		change_handler_1,
		change_handler_2,
		func,
		div4_binding
	];
}

class InlineStyleEditor$1 extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				getAdditionalElems: 22,
				listenOnClick: 23,
				onStyleChanged: 24,
				customProps: 25,
				open: 26,
				close: 0,
				isOpened: 27
			},
			null,
			[-1, -1, -1]
		);
	}

	get open() {
		return this.$$.ctx[26];
	}

	get close() {
		return this.$$.ctx[0];
	}

	get isOpened() {
		return this.$$.ctx[27];
	}
}

var StyleEditor = InlineStyleEditor$1;

class InlineStyleEditor {
    constructor(options) {
        return new StyleEditor({target: document.body, props: options});
    }
}

export { InlineStyleEditor as default };
