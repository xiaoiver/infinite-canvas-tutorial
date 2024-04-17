import './chunk-WVEPVUDD.js';
import { __commonJS, __toESM } from './chunk-ZS7NZCD4.js';

// ../../node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS({
  '../../node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.js'(
    exports,
    module,
  ) {
    'use strict';
    var has = Object.prototype.hasOwnProperty;
    var prefix = '~';
    function Events() {}
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== 'function') {
        throw new TypeError('The listener must be a function');
      }
      var listener = new EE(fn, context || emitter, once),
        evt = prefix ? prefix + event : event;
      if (!emitter._events[evt])
        (emitter._events[evt] = listener), emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter2() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter2.prototype.eventNames = function eventNames() {
      var names = [],
        events,
        name;
      if (this._eventsCount === 0) return names;
      for (name in (events = this._events)) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter2.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event,
        handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter2.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event,
        listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt],
        len = arguments.length,
        args,
        i;
      if (listeners.fn) {
        if (listeners.once)
          this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return (
              listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true
            );
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length,
          j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once)
            this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args)
                for (j = 1, args = new Array(len - 1); j < len; j++) {
                  args[j - 1] = arguments[j];
                }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter2.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter2.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter2.prototype.removeListener = function removeListener(
      event,
      fn,
      context,
      once,
    ) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (
          listeners.fn === fn &&
          (!once || listeners.once) &&
          (!context || listeners.context === context)
        ) {
          clearEvent(this, evt);
        }
      } else {
        for (
          var i = 0, events = [], length = listeners.length;
          i < length;
          i++
        ) {
          if (
            listeners[i].fn !== fn ||
            (once && !listeners[i].once) ||
            (context && listeners[i].context !== context)
          ) {
            events.push(listeners[i]);
          }
        }
        if (events.length)
          this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter2.prototype.removeAllListeners = function removeAllListeners(
      event,
    ) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
    EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
    EventEmitter2.prefixed = prefix;
    EventEmitter2.EventEmitter = EventEmitter2;
    if ('undefined' !== typeof module) {
      module.exports = EventEmitter2;
    }
  },
});

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/color/arr2rgb.js
function toHex(value) {
  var x16Value = Math.round(value).toString(16);
  return x16Value.length === 1 ? '0' + x16Value : x16Value;
}
function arr2rgb(arr) {
  return '#' + toHex(arr[0]) + toHex(arr[1]) + toHex(arr[2]);
}

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/is-function.js
var is_function_default = function (value) {
  return typeof value === 'function';
};

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/is-nil.js
var isNil = function (value) {
  return value === null || value === void 0;
};
var is_nil_default = isNil;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/is-type.js
var toString = {}.toString;
var isType = function (value, type) {
  return toString.call(value) === '[object ' + type + ']';
};
var is_type_default = isType;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/pull.js
var arrPrototype = Array.prototype;
var splice = arrPrototype.splice;
var indexOf = arrPrototype.indexOf;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/pull-at.js
var splice2 = Array.prototype.splice;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/clamp.js
var clamp = function (a, min, max) {
  if (a < min) {
    return min;
  } else if (a > max) {
    return max;
  }
  return a;
};
var clamp_default = clamp;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/is-number.js
var isNumber = function (value) {
  return is_type_default(value, 'Number');
};
var is_number_default = isNumber;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/is-integer.js
var isInteger = Number.isInteger
  ? Number.isInteger
  : function (num) {
      return is_number_default(num) && num % 1 === 0;
    };

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/to-degree.js
var DEGREE = 180 / Math.PI;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/to-radian.js
var RADIAN = Math.PI / 180;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/get-type.js
var toString2 = {}.toString;

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/is-prototype.js
var objectProto = Object.prototype;

// ../../node_modules/.pnpm/flru@1.0.2/node_modules/flru/dist/flru.mjs
function flru_default(max) {
  var num, curr, prev;
  var limit = max || 1;
  function keep(key, value) {
    if (++num > limit) {
      prev = curr;
      reset(1);
      ++num;
    }
    curr[key] = value;
  }
  function reset(isPartial) {
    num = 0;
    curr = /* @__PURE__ */ Object.create(null);
    isPartial || (prev = /* @__PURE__ */ Object.create(null));
  }
  reset();
  return {
    clear: reset,
    has: function (key) {
      return curr[key] !== void 0 || prev[key] !== void 0;
    },
    get: function (key) {
      var val = curr[key];
      if (val !== void 0) return val;
      if ((val = prev[key]) !== void 0) {
        keep(key, val);
        return val;
      }
    },
    set: function (key, value) {
      if (curr[key] !== void 0) {
        curr[key] = value;
      } else {
        keep(key, value);
      }
    },
  };
}

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/memoize.js
var memoize_default = function (f, resolver, maxSize) {
  if (maxSize === void 0) {
    maxSize = 128;
  }
  if (!is_function_default(f)) {
    throw new TypeError('Expected a function');
  }
  var memoized = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    var key = resolver ? resolver.apply(this, args) : args[0];
    var cache = memoized.cache;
    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = f.apply(this, args);
    cache.set(key, result);
    return result;
  };
  memoized.cache = flru_default(maxSize);
  return memoized;
};

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/lodash/cache.js
var default_1 =
  /** @class */
  (function () {
    function default_12() {
      this.map = {};
    }
    default_12.prototype.has = function (key) {
      return this.map[key] !== void 0;
    };
    default_12.prototype.get = function (key, def) {
      var v = this.map[key];
      return v === void 0 ? def : v;
    };
    default_12.prototype.set = function (key, value) {
      this.map[key] = value;
    };
    default_12.prototype.clear = function () {
      this.map = {};
    };
    default_12.prototype.delete = function (key) {
      delete this.map[key];
    };
    default_12.prototype.size = function () {
      return Object.keys(this.map).length;
    };
    return default_12;
  })();

// ../../node_modules/.pnpm/@antv+util@3.3.5/node_modules/@antv/util/esm/color/torgb.js
var RGB_REG = /rgba?\(([\s.,0-9]+)\)/;
function createTmp() {
  var i = document.createElement('i');
  i.title = 'Web Colour Picker';
  i.style.display = 'none';
  document.body.appendChild(i);
  return i;
}
var iEl;
function toRGBString(color) {
  if (color[0] === '#' && color.length === 7) {
    return color;
  }
  if (!iEl) {
    iEl = createTmp();
  }
  iEl.style.color = color;
  var rst = document.defaultView
    .getComputedStyle(iEl, '')
    .getPropertyValue('color');
  var matches = RGB_REG.exec(rst);
  var cArray = matches[1].split(/\s*,\s*/).map(function (s) {
    return Number(s);
  });
  rst = arr2rgb(cArray);
  return rst;
}
var toRGB = memoize_default(
  toRGBString,
  function (color) {
    return color;
  },
  256,
);

// ../../node_modules/.pnpm/tslib@2.6.2/node_modules/tslib/tslib.es6.mjs
var extendStatics = function (d, b) {
  extendStatics =
    Object.setPrototypeOf ||
    ({ __proto__: [] } instanceof Array &&
      function (d2, b2) {
        d2.__proto__ = b2;
      }) ||
    function (d2, b2) {
      for (var p in b2)
        if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
    };
  return extendStatics(d, b);
};
function __extends(d, b) {
  if (typeof b !== 'function' && b !== null)
    throw new TypeError(
      'Class extends value ' + String(b) + ' is not a constructor or null',
    );
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype =
    b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
}
var __assign = function () {
  __assign =
    Object.assign ||
    function __assign2(t) {
      for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s)
          if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
      }
      return t;
    };
  return __assign.apply(this, arguments);
};
function __rest(s, e) {
  var t = {};
  for (var p in s)
    if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
      t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === 'function')
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (
        e.indexOf(p[i]) < 0 &&
        Object.prototype.propertyIsEnumerable.call(s, p[i])
      )
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P
      ? value
      : new P(function (resolve) {
          resolve(value);
        });
  }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator['throw'](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done
        ? resolve(result.value)
        : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = {
      label: 0,
      sent: function () {
        if (t[0] & 1) throw t[1];
        return t[1];
      },
      trys: [],
      ops: [],
    },
    f,
    y,
    t,
    g;
  return (
    (g = { next: verb(0), throw: verb(1), return: verb(2) }),
    typeof Symbol === 'function' &&
      (g[Symbol.iterator] = function () {
        return this;
      }),
    g
  );
  function verb(n) {
    return function (v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError('Generator is already executing.');
    while ((g && ((g = 0), op[0] && (_ = 0)), _))
      try {
        if (
          ((f = 1),
          y &&
            (t =
              op[0] & 2
                ? y['return']
                : op[0]
                ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                : y.next) &&
            !(t = t.call(y, op[1])).done)
        )
          return t;
        if (((y = 0), t)) op = [op[0] & 2, t.value];
        switch (op[0]) {
          case 0:
          case 1:
            t = op;
            break;
          case 4:
            _.label++;
            return { value: op[1], done: false };
          case 5:
            _.label++;
            y = op[1];
            op = [0];
            continue;
          case 7:
            op = _.ops.pop();
            _.trys.pop();
            continue;
          default:
            if (
              !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
              (op[0] === 6 || op[0] === 2)
            ) {
              _ = 0;
              continue;
            }
            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
              _.label = op[1];
              break;
            }
            if (op[0] === 6 && _.label < t[1]) {
              _.label = t[1];
              t = op;
              break;
            }
            if (t && _.label < t[2]) {
              _.label = t[2];
              _.ops.push(op);
              break;
            }
            if (t[2]) _.ops.pop();
            _.trys.pop();
            continue;
        }
        op = body.call(thisArg, _);
      } catch (e) {
        op = [6, e];
        y = 0;
      } finally {
        f = t = 0;
      }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __values(o) {
  var s = typeof Symbol === 'function' && Symbol.iterator,
    m = s && o[s],
    i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === 'number')
    return {
      next: function () {
        if (o && i >= o.length) o = void 0;
        return { value: o && o[i++], done: !o };
      },
    };
  throw new TypeError(
    s ? 'Object is not iterable.' : 'Symbol.iterator is not defined.',
  );
}
function __read(o, n) {
  var m = typeof Symbol === 'function' && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o),
    r,
    ar = [],
    e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i['return'])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2)
    for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
  return to.concat(ar || Array.prototype.slice.call(from));
}

// ../../node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.mjs
var import_index = __toESM(require_eventemitter3(), 1);
var eventemitter3_default = import_index.default;

// ../../node_modules/.pnpm/@antv+g-device-api@1.6.5/node_modules/@antv/g-device-api/es/index.js
var GL;
(function (GL2) {
  GL2[(GL2['DEPTH_BUFFER_BIT'] = 256)] = 'DEPTH_BUFFER_BIT';
  GL2[(GL2['STENCIL_BUFFER_BIT'] = 1024)] = 'STENCIL_BUFFER_BIT';
  GL2[(GL2['COLOR_BUFFER_BIT'] = 16384)] = 'COLOR_BUFFER_BIT';
  GL2[(GL2['POINTS'] = 0)] = 'POINTS';
  GL2[(GL2['LINES'] = 1)] = 'LINES';
  GL2[(GL2['LINE_LOOP'] = 2)] = 'LINE_LOOP';
  GL2[(GL2['LINE_STRIP'] = 3)] = 'LINE_STRIP';
  GL2[(GL2['TRIANGLES'] = 4)] = 'TRIANGLES';
  GL2[(GL2['TRIANGLE_STRIP'] = 5)] = 'TRIANGLE_STRIP';
  GL2[(GL2['TRIANGLE_FAN'] = 6)] = 'TRIANGLE_FAN';
  GL2[(GL2['ZERO'] = 0)] = 'ZERO';
  GL2[(GL2['ONE'] = 1)] = 'ONE';
  GL2[(GL2['SRC_COLOR'] = 768)] = 'SRC_COLOR';
  GL2[(GL2['ONE_MINUS_SRC_COLOR'] = 769)] = 'ONE_MINUS_SRC_COLOR';
  GL2[(GL2['SRC_ALPHA'] = 770)] = 'SRC_ALPHA';
  GL2[(GL2['ONE_MINUS_SRC_ALPHA'] = 771)] = 'ONE_MINUS_SRC_ALPHA';
  GL2[(GL2['DST_ALPHA'] = 772)] = 'DST_ALPHA';
  GL2[(GL2['ONE_MINUS_DST_ALPHA'] = 773)] = 'ONE_MINUS_DST_ALPHA';
  GL2[(GL2['DST_COLOR'] = 774)] = 'DST_COLOR';
  GL2[(GL2['ONE_MINUS_DST_COLOR'] = 775)] = 'ONE_MINUS_DST_COLOR';
  GL2[(GL2['SRC_ALPHA_SATURATE'] = 776)] = 'SRC_ALPHA_SATURATE';
  GL2[(GL2['CONSTANT_COLOR'] = 32769)] = 'CONSTANT_COLOR';
  GL2[(GL2['ONE_MINUS_CONSTANT_COLOR'] = 32770)] = 'ONE_MINUS_CONSTANT_COLOR';
  GL2[(GL2['CONSTANT_ALPHA'] = 32771)] = 'CONSTANT_ALPHA';
  GL2[(GL2['ONE_MINUS_CONSTANT_ALPHA'] = 32772)] = 'ONE_MINUS_CONSTANT_ALPHA';
  GL2[(GL2['FUNC_ADD'] = 32774)] = 'FUNC_ADD';
  GL2[(GL2['FUNC_SUBTRACT'] = 32778)] = 'FUNC_SUBTRACT';
  GL2[(GL2['FUNC_REVERSE_SUBTRACT'] = 32779)] = 'FUNC_REVERSE_SUBTRACT';
  GL2[(GL2['BLEND_EQUATION'] = 32777)] = 'BLEND_EQUATION';
  GL2[(GL2['BLEND_EQUATION_RGB'] = 32777)] = 'BLEND_EQUATION_RGB';
  GL2[(GL2['BLEND_EQUATION_ALPHA'] = 34877)] = 'BLEND_EQUATION_ALPHA';
  GL2[(GL2['BLEND_DST_RGB'] = 32968)] = 'BLEND_DST_RGB';
  GL2[(GL2['BLEND_SRC_RGB'] = 32969)] = 'BLEND_SRC_RGB';
  GL2[(GL2['BLEND_DST_ALPHA'] = 32970)] = 'BLEND_DST_ALPHA';
  GL2[(GL2['BLEND_SRC_ALPHA'] = 32971)] = 'BLEND_SRC_ALPHA';
  GL2[(GL2['BLEND_COLOR'] = 32773)] = 'BLEND_COLOR';
  GL2[(GL2['ARRAY_BUFFER_BINDING'] = 34964)] = 'ARRAY_BUFFER_BINDING';
  GL2[(GL2['ELEMENT_ARRAY_BUFFER_BINDING'] = 34965)] =
    'ELEMENT_ARRAY_BUFFER_BINDING';
  GL2[(GL2['LINE_WIDTH'] = 2849)] = 'LINE_WIDTH';
  GL2[(GL2['ALIASED_POINT_SIZE_RANGE'] = 33901)] = 'ALIASED_POINT_SIZE_RANGE';
  GL2[(GL2['ALIASED_LINE_WIDTH_RANGE'] = 33902)] = 'ALIASED_LINE_WIDTH_RANGE';
  GL2[(GL2['CULL_FACE_MODE'] = 2885)] = 'CULL_FACE_MODE';
  GL2[(GL2['FRONT_FACE'] = 2886)] = 'FRONT_FACE';
  GL2[(GL2['DEPTH_RANGE'] = 2928)] = 'DEPTH_RANGE';
  GL2[(GL2['DEPTH_WRITEMASK'] = 2930)] = 'DEPTH_WRITEMASK';
  GL2[(GL2['DEPTH_CLEAR_VALUE'] = 2931)] = 'DEPTH_CLEAR_VALUE';
  GL2[(GL2['DEPTH_FUNC'] = 2932)] = 'DEPTH_FUNC';
  GL2[(GL2['STENCIL_CLEAR_VALUE'] = 2961)] = 'STENCIL_CLEAR_VALUE';
  GL2[(GL2['STENCIL_FUNC'] = 2962)] = 'STENCIL_FUNC';
  GL2[(GL2['STENCIL_FAIL'] = 2964)] = 'STENCIL_FAIL';
  GL2[(GL2['STENCIL_PASS_DEPTH_FAIL'] = 2965)] = 'STENCIL_PASS_DEPTH_FAIL';
  GL2[(GL2['STENCIL_PASS_DEPTH_PASS'] = 2966)] = 'STENCIL_PASS_DEPTH_PASS';
  GL2[(GL2['STENCIL_REF'] = 2967)] = 'STENCIL_REF';
  GL2[(GL2['STENCIL_VALUE_MASK'] = 2963)] = 'STENCIL_VALUE_MASK';
  GL2[(GL2['STENCIL_WRITEMASK'] = 2968)] = 'STENCIL_WRITEMASK';
  GL2[(GL2['STENCIL_BACK_FUNC'] = 34816)] = 'STENCIL_BACK_FUNC';
  GL2[(GL2['STENCIL_BACK_FAIL'] = 34817)] = 'STENCIL_BACK_FAIL';
  GL2[(GL2['STENCIL_BACK_PASS_DEPTH_FAIL'] = 34818)] =
    'STENCIL_BACK_PASS_DEPTH_FAIL';
  GL2[(GL2['STENCIL_BACK_PASS_DEPTH_PASS'] = 34819)] =
    'STENCIL_BACK_PASS_DEPTH_PASS';
  GL2[(GL2['STENCIL_BACK_REF'] = 36003)] = 'STENCIL_BACK_REF';
  GL2[(GL2['STENCIL_BACK_VALUE_MASK'] = 36004)] = 'STENCIL_BACK_VALUE_MASK';
  GL2[(GL2['STENCIL_BACK_WRITEMASK'] = 36005)] = 'STENCIL_BACK_WRITEMASK';
  GL2[(GL2['VIEWPORT'] = 2978)] = 'VIEWPORT';
  GL2[(GL2['SCISSOR_BOX'] = 3088)] = 'SCISSOR_BOX';
  GL2[(GL2['COLOR_CLEAR_VALUE'] = 3106)] = 'COLOR_CLEAR_VALUE';
  GL2[(GL2['COLOR_WRITEMASK'] = 3107)] = 'COLOR_WRITEMASK';
  GL2[(GL2['UNPACK_ALIGNMENT'] = 3317)] = 'UNPACK_ALIGNMENT';
  GL2[(GL2['PACK_ALIGNMENT'] = 3333)] = 'PACK_ALIGNMENT';
  GL2[(GL2['MAX_TEXTURE_SIZE'] = 3379)] = 'MAX_TEXTURE_SIZE';
  GL2[(GL2['MAX_VIEWPORT_DIMS'] = 3386)] = 'MAX_VIEWPORT_DIMS';
  GL2[(GL2['SUBPIXEL_BITS'] = 3408)] = 'SUBPIXEL_BITS';
  GL2[(GL2['RED_BITS'] = 3410)] = 'RED_BITS';
  GL2[(GL2['GREEN_BITS'] = 3411)] = 'GREEN_BITS';
  GL2[(GL2['BLUE_BITS'] = 3412)] = 'BLUE_BITS';
  GL2[(GL2['ALPHA_BITS'] = 3413)] = 'ALPHA_BITS';
  GL2[(GL2['DEPTH_BITS'] = 3414)] = 'DEPTH_BITS';
  GL2[(GL2['STENCIL_BITS'] = 3415)] = 'STENCIL_BITS';
  GL2[(GL2['POLYGON_OFFSET_UNITS'] = 10752)] = 'POLYGON_OFFSET_UNITS';
  GL2[(GL2['POLYGON_OFFSET_FACTOR'] = 32824)] = 'POLYGON_OFFSET_FACTOR';
  GL2[(GL2['TEXTURE_BINDING_2D'] = 32873)] = 'TEXTURE_BINDING_2D';
  GL2[(GL2['SAMPLE_BUFFERS'] = 32936)] = 'SAMPLE_BUFFERS';
  GL2[(GL2['SAMPLES'] = 32937)] = 'SAMPLES';
  GL2[(GL2['SAMPLE_COVERAGE_VALUE'] = 32938)] = 'SAMPLE_COVERAGE_VALUE';
  GL2[(GL2['SAMPLE_COVERAGE_INVERT'] = 32939)] = 'SAMPLE_COVERAGE_INVERT';
  GL2[(GL2['COMPRESSED_TEXTURE_FORMATS'] = 34467)] =
    'COMPRESSED_TEXTURE_FORMATS';
  GL2[(GL2['VENDOR'] = 7936)] = 'VENDOR';
  GL2[(GL2['RENDERER'] = 7937)] = 'RENDERER';
  GL2[(GL2['VERSION'] = 7938)] = 'VERSION';
  GL2[(GL2['IMPLEMENTATION_COLOR_READ_TYPE'] = 35738)] =
    'IMPLEMENTATION_COLOR_READ_TYPE';
  GL2[(GL2['IMPLEMENTATION_COLOR_READ_FORMAT'] = 35739)] =
    'IMPLEMENTATION_COLOR_READ_FORMAT';
  GL2[(GL2['BROWSER_DEFAULT_WEBGL'] = 37444)] = 'BROWSER_DEFAULT_WEBGL';
  GL2[(GL2['STATIC_DRAW'] = 35044)] = 'STATIC_DRAW';
  GL2[(GL2['STREAM_DRAW'] = 35040)] = 'STREAM_DRAW';
  GL2[(GL2['DYNAMIC_DRAW'] = 35048)] = 'DYNAMIC_DRAW';
  GL2[(GL2['ARRAY_BUFFER'] = 34962)] = 'ARRAY_BUFFER';
  GL2[(GL2['ELEMENT_ARRAY_BUFFER'] = 34963)] = 'ELEMENT_ARRAY_BUFFER';
  GL2[(GL2['BUFFER_SIZE'] = 34660)] = 'BUFFER_SIZE';
  GL2[(GL2['BUFFER_USAGE'] = 34661)] = 'BUFFER_USAGE';
  GL2[(GL2['CURRENT_VERTEX_ATTRIB'] = 34342)] = 'CURRENT_VERTEX_ATTRIB';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_ENABLED'] = 34338)] =
    'VERTEX_ATTRIB_ARRAY_ENABLED';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_SIZE'] = 34339)] = 'VERTEX_ATTRIB_ARRAY_SIZE';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_STRIDE'] = 34340)] =
    'VERTEX_ATTRIB_ARRAY_STRIDE';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_TYPE'] = 34341)] = 'VERTEX_ATTRIB_ARRAY_TYPE';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_NORMALIZED'] = 34922)] =
    'VERTEX_ATTRIB_ARRAY_NORMALIZED';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_POINTER'] = 34373)] =
    'VERTEX_ATTRIB_ARRAY_POINTER';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_BUFFER_BINDING'] = 34975)] =
    'VERTEX_ATTRIB_ARRAY_BUFFER_BINDING';
  GL2[(GL2['CULL_FACE'] = 2884)] = 'CULL_FACE';
  GL2[(GL2['FRONT'] = 1028)] = 'FRONT';
  GL2[(GL2['BACK'] = 1029)] = 'BACK';
  GL2[(GL2['FRONT_AND_BACK'] = 1032)] = 'FRONT_AND_BACK';
  GL2[(GL2['BLEND'] = 3042)] = 'BLEND';
  GL2[(GL2['DEPTH_TEST'] = 2929)] = 'DEPTH_TEST';
  GL2[(GL2['DITHER'] = 3024)] = 'DITHER';
  GL2[(GL2['POLYGON_OFFSET_FILL'] = 32823)] = 'POLYGON_OFFSET_FILL';
  GL2[(GL2['SAMPLE_ALPHA_TO_COVERAGE'] = 32926)] = 'SAMPLE_ALPHA_TO_COVERAGE';
  GL2[(GL2['SAMPLE_COVERAGE'] = 32928)] = 'SAMPLE_COVERAGE';
  GL2[(GL2['SCISSOR_TEST'] = 3089)] = 'SCISSOR_TEST';
  GL2[(GL2['STENCIL_TEST'] = 2960)] = 'STENCIL_TEST';
  GL2[(GL2['NO_ERROR'] = 0)] = 'NO_ERROR';
  GL2[(GL2['INVALID_ENUM'] = 1280)] = 'INVALID_ENUM';
  GL2[(GL2['INVALID_VALUE'] = 1281)] = 'INVALID_VALUE';
  GL2[(GL2['INVALID_OPERATION'] = 1282)] = 'INVALID_OPERATION';
  GL2[(GL2['OUT_OF_MEMORY'] = 1285)] = 'OUT_OF_MEMORY';
  GL2[(GL2['CONTEXT_LOST_WEBGL'] = 37442)] = 'CONTEXT_LOST_WEBGL';
  GL2[(GL2['CW'] = 2304)] = 'CW';
  GL2[(GL2['CCW'] = 2305)] = 'CCW';
  GL2[(GL2['DONT_CARE'] = 4352)] = 'DONT_CARE';
  GL2[(GL2['FASTEST'] = 4353)] = 'FASTEST';
  GL2[(GL2['NICEST'] = 4354)] = 'NICEST';
  GL2[(GL2['GENERATE_MIPMAP_HINT'] = 33170)] = 'GENERATE_MIPMAP_HINT';
  GL2[(GL2['BYTE'] = 5120)] = 'BYTE';
  GL2[(GL2['UNSIGNED_BYTE'] = 5121)] = 'UNSIGNED_BYTE';
  GL2[(GL2['SHORT'] = 5122)] = 'SHORT';
  GL2[(GL2['UNSIGNED_SHORT'] = 5123)] = 'UNSIGNED_SHORT';
  GL2[(GL2['INT'] = 5124)] = 'INT';
  GL2[(GL2['UNSIGNED_INT'] = 5125)] = 'UNSIGNED_INT';
  GL2[(GL2['FLOAT'] = 5126)] = 'FLOAT';
  GL2[(GL2['DOUBLE'] = 5130)] = 'DOUBLE';
  GL2[(GL2['DEPTH_COMPONENT'] = 6402)] = 'DEPTH_COMPONENT';
  GL2[(GL2['ALPHA'] = 6406)] = 'ALPHA';
  GL2[(GL2['RGB'] = 6407)] = 'RGB';
  GL2[(GL2['RGBA'] = 6408)] = 'RGBA';
  GL2[(GL2['LUMINANCE'] = 6409)] = 'LUMINANCE';
  GL2[(GL2['LUMINANCE_ALPHA'] = 6410)] = 'LUMINANCE_ALPHA';
  GL2[(GL2['UNSIGNED_SHORT_4_4_4_4'] = 32819)] = 'UNSIGNED_SHORT_4_4_4_4';
  GL2[(GL2['UNSIGNED_SHORT_5_5_5_1'] = 32820)] = 'UNSIGNED_SHORT_5_5_5_1';
  GL2[(GL2['UNSIGNED_SHORT_5_6_5'] = 33635)] = 'UNSIGNED_SHORT_5_6_5';
  GL2[(GL2['FRAGMENT_SHADER'] = 35632)] = 'FRAGMENT_SHADER';
  GL2[(GL2['VERTEX_SHADER'] = 35633)] = 'VERTEX_SHADER';
  GL2[(GL2['COMPILE_STATUS'] = 35713)] = 'COMPILE_STATUS';
  GL2[(GL2['DELETE_STATUS'] = 35712)] = 'DELETE_STATUS';
  GL2[(GL2['LINK_STATUS'] = 35714)] = 'LINK_STATUS';
  GL2[(GL2['VALIDATE_STATUS'] = 35715)] = 'VALIDATE_STATUS';
  GL2[(GL2['ATTACHED_SHADERS'] = 35717)] = 'ATTACHED_SHADERS';
  GL2[(GL2['ACTIVE_ATTRIBUTES'] = 35721)] = 'ACTIVE_ATTRIBUTES';
  GL2[(GL2['ACTIVE_UNIFORMS'] = 35718)] = 'ACTIVE_UNIFORMS';
  GL2[(GL2['MAX_VERTEX_ATTRIBS'] = 34921)] = 'MAX_VERTEX_ATTRIBS';
  GL2[(GL2['MAX_VERTEX_UNIFORM_VECTORS'] = 36347)] =
    'MAX_VERTEX_UNIFORM_VECTORS';
  GL2[(GL2['MAX_VARYING_VECTORS'] = 36348)] = 'MAX_VARYING_VECTORS';
  GL2[(GL2['MAX_COMBINED_TEXTURE_IMAGE_UNITS'] = 35661)] =
    'MAX_COMBINED_TEXTURE_IMAGE_UNITS';
  GL2[(GL2['MAX_VERTEX_TEXTURE_IMAGE_UNITS'] = 35660)] =
    'MAX_VERTEX_TEXTURE_IMAGE_UNITS';
  GL2[(GL2['MAX_TEXTURE_IMAGE_UNITS'] = 34930)] = 'MAX_TEXTURE_IMAGE_UNITS';
  GL2[(GL2['MAX_FRAGMENT_UNIFORM_VECTORS'] = 36349)] =
    'MAX_FRAGMENT_UNIFORM_VECTORS';
  GL2[(GL2['SHADER_TYPE'] = 35663)] = 'SHADER_TYPE';
  GL2[(GL2['SHADING_LANGUAGE_VERSION'] = 35724)] = 'SHADING_LANGUAGE_VERSION';
  GL2[(GL2['CURRENT_PROGRAM'] = 35725)] = 'CURRENT_PROGRAM';
  GL2[(GL2['NEVER'] = 512)] = 'NEVER';
  GL2[(GL2['ALWAYS'] = 519)] = 'ALWAYS';
  GL2[(GL2['LESS'] = 513)] = 'LESS';
  GL2[(GL2['EQUAL'] = 514)] = 'EQUAL';
  GL2[(GL2['LEQUAL'] = 515)] = 'LEQUAL';
  GL2[(GL2['GREATER'] = 516)] = 'GREATER';
  GL2[(GL2['GEQUAL'] = 518)] = 'GEQUAL';
  GL2[(GL2['NOTEQUAL'] = 517)] = 'NOTEQUAL';
  GL2[(GL2['KEEP'] = 7680)] = 'KEEP';
  GL2[(GL2['REPLACE'] = 7681)] = 'REPLACE';
  GL2[(GL2['INCR'] = 7682)] = 'INCR';
  GL2[(GL2['DECR'] = 7683)] = 'DECR';
  GL2[(GL2['INVERT'] = 5386)] = 'INVERT';
  GL2[(GL2['INCR_WRAP'] = 34055)] = 'INCR_WRAP';
  GL2[(GL2['DECR_WRAP'] = 34056)] = 'DECR_WRAP';
  GL2[(GL2['NEAREST'] = 9728)] = 'NEAREST';
  GL2[(GL2['LINEAR'] = 9729)] = 'LINEAR';
  GL2[(GL2['NEAREST_MIPMAP_NEAREST'] = 9984)] = 'NEAREST_MIPMAP_NEAREST';
  GL2[(GL2['LINEAR_MIPMAP_NEAREST'] = 9985)] = 'LINEAR_MIPMAP_NEAREST';
  GL2[(GL2['NEAREST_MIPMAP_LINEAR'] = 9986)] = 'NEAREST_MIPMAP_LINEAR';
  GL2[(GL2['LINEAR_MIPMAP_LINEAR'] = 9987)] = 'LINEAR_MIPMAP_LINEAR';
  GL2[(GL2['TEXTURE_MAG_FILTER'] = 10240)] = 'TEXTURE_MAG_FILTER';
  GL2[(GL2['TEXTURE_MIN_FILTER'] = 10241)] = 'TEXTURE_MIN_FILTER';
  GL2[(GL2['TEXTURE_WRAP_S'] = 10242)] = 'TEXTURE_WRAP_S';
  GL2[(GL2['TEXTURE_WRAP_T'] = 10243)] = 'TEXTURE_WRAP_T';
  GL2[(GL2['TEXTURE_2D'] = 3553)] = 'TEXTURE_2D';
  GL2[(GL2['TEXTURE'] = 5890)] = 'TEXTURE';
  GL2[(GL2['TEXTURE_CUBE_MAP'] = 34067)] = 'TEXTURE_CUBE_MAP';
  GL2[(GL2['TEXTURE_BINDING_CUBE_MAP'] = 34068)] = 'TEXTURE_BINDING_CUBE_MAP';
  GL2[(GL2['TEXTURE_CUBE_MAP_POSITIVE_X'] = 34069)] =
    'TEXTURE_CUBE_MAP_POSITIVE_X';
  GL2[(GL2['TEXTURE_CUBE_MAP_NEGATIVE_X'] = 34070)] =
    'TEXTURE_CUBE_MAP_NEGATIVE_X';
  GL2[(GL2['TEXTURE_CUBE_MAP_POSITIVE_Y'] = 34071)] =
    'TEXTURE_CUBE_MAP_POSITIVE_Y';
  GL2[(GL2['TEXTURE_CUBE_MAP_NEGATIVE_Y'] = 34072)] =
    'TEXTURE_CUBE_MAP_NEGATIVE_Y';
  GL2[(GL2['TEXTURE_CUBE_MAP_POSITIVE_Z'] = 34073)] =
    'TEXTURE_CUBE_MAP_POSITIVE_Z';
  GL2[(GL2['TEXTURE_CUBE_MAP_NEGATIVE_Z'] = 34074)] =
    'TEXTURE_CUBE_MAP_NEGATIVE_Z';
  GL2[(GL2['MAX_CUBE_MAP_TEXTURE_SIZE'] = 34076)] = 'MAX_CUBE_MAP_TEXTURE_SIZE';
  GL2[(GL2['TEXTURE0'] = 33984)] = 'TEXTURE0';
  GL2[(GL2['ACTIVE_TEXTURE'] = 34016)] = 'ACTIVE_TEXTURE';
  GL2[(GL2['REPEAT'] = 10497)] = 'REPEAT';
  GL2[(GL2['CLAMP_TO_EDGE'] = 33071)] = 'CLAMP_TO_EDGE';
  GL2[(GL2['MIRRORED_REPEAT'] = 33648)] = 'MIRRORED_REPEAT';
  GL2[(GL2['TEXTURE_WIDTH'] = 4096)] = 'TEXTURE_WIDTH';
  GL2[(GL2['TEXTURE_HEIGHT'] = 4097)] = 'TEXTURE_HEIGHT';
  GL2[(GL2['FLOAT_VEC2'] = 35664)] = 'FLOAT_VEC2';
  GL2[(GL2['FLOAT_VEC3'] = 35665)] = 'FLOAT_VEC3';
  GL2[(GL2['FLOAT_VEC4'] = 35666)] = 'FLOAT_VEC4';
  GL2[(GL2['INT_VEC2'] = 35667)] = 'INT_VEC2';
  GL2[(GL2['INT_VEC3'] = 35668)] = 'INT_VEC3';
  GL2[(GL2['INT_VEC4'] = 35669)] = 'INT_VEC4';
  GL2[(GL2['BOOL'] = 35670)] = 'BOOL';
  GL2[(GL2['BOOL_VEC2'] = 35671)] = 'BOOL_VEC2';
  GL2[(GL2['BOOL_VEC3'] = 35672)] = 'BOOL_VEC3';
  GL2[(GL2['BOOL_VEC4'] = 35673)] = 'BOOL_VEC4';
  GL2[(GL2['FLOAT_MAT2'] = 35674)] = 'FLOAT_MAT2';
  GL2[(GL2['FLOAT_MAT3'] = 35675)] = 'FLOAT_MAT3';
  GL2[(GL2['FLOAT_MAT4'] = 35676)] = 'FLOAT_MAT4';
  GL2[(GL2['SAMPLER_2D'] = 35678)] = 'SAMPLER_2D';
  GL2[(GL2['SAMPLER_CUBE'] = 35680)] = 'SAMPLER_CUBE';
  GL2[(GL2['LOW_FLOAT'] = 36336)] = 'LOW_FLOAT';
  GL2[(GL2['MEDIUM_FLOAT'] = 36337)] = 'MEDIUM_FLOAT';
  GL2[(GL2['HIGH_FLOAT'] = 36338)] = 'HIGH_FLOAT';
  GL2[(GL2['LOW_INT'] = 36339)] = 'LOW_INT';
  GL2[(GL2['MEDIUM_INT'] = 36340)] = 'MEDIUM_INT';
  GL2[(GL2['HIGH_INT'] = 36341)] = 'HIGH_INT';
  GL2[(GL2['FRAMEBUFFER'] = 36160)] = 'FRAMEBUFFER';
  GL2[(GL2['RENDERBUFFER'] = 36161)] = 'RENDERBUFFER';
  GL2[(GL2['RGBA4'] = 32854)] = 'RGBA4';
  GL2[(GL2['RGB5_A1'] = 32855)] = 'RGB5_A1';
  GL2[(GL2['RGB565'] = 36194)] = 'RGB565';
  GL2[(GL2['DEPTH_COMPONENT16'] = 33189)] = 'DEPTH_COMPONENT16';
  GL2[(GL2['STENCIL_INDEX'] = 6401)] = 'STENCIL_INDEX';
  GL2[(GL2['STENCIL_INDEX8'] = 36168)] = 'STENCIL_INDEX8';
  GL2[(GL2['DEPTH_STENCIL'] = 34041)] = 'DEPTH_STENCIL';
  GL2[(GL2['RENDERBUFFER_WIDTH'] = 36162)] = 'RENDERBUFFER_WIDTH';
  GL2[(GL2['RENDERBUFFER_HEIGHT'] = 36163)] = 'RENDERBUFFER_HEIGHT';
  GL2[(GL2['RENDERBUFFER_INTERNAL_FORMAT'] = 36164)] =
    'RENDERBUFFER_INTERNAL_FORMAT';
  GL2[(GL2['RENDERBUFFER_RED_SIZE'] = 36176)] = 'RENDERBUFFER_RED_SIZE';
  GL2[(GL2['RENDERBUFFER_GREEN_SIZE'] = 36177)] = 'RENDERBUFFER_GREEN_SIZE';
  GL2[(GL2['RENDERBUFFER_BLUE_SIZE'] = 36178)] = 'RENDERBUFFER_BLUE_SIZE';
  GL2[(GL2['RENDERBUFFER_ALPHA_SIZE'] = 36179)] = 'RENDERBUFFER_ALPHA_SIZE';
  GL2[(GL2['RENDERBUFFER_DEPTH_SIZE'] = 36180)] = 'RENDERBUFFER_DEPTH_SIZE';
  GL2[(GL2['RENDERBUFFER_STENCIL_SIZE'] = 36181)] = 'RENDERBUFFER_STENCIL_SIZE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE'] = 36048)] =
    'FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_OBJECT_NAME'] = 36049)] =
    'FRAMEBUFFER_ATTACHMENT_OBJECT_NAME';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL'] = 36050)] =
    'FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE'] = 36051)] =
    'FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE';
  GL2[(GL2['COLOR_ATTACHMENT0'] = 36064)] = 'COLOR_ATTACHMENT0';
  GL2[(GL2['DEPTH_ATTACHMENT'] = 36096)] = 'DEPTH_ATTACHMENT';
  GL2[(GL2['STENCIL_ATTACHMENT'] = 36128)] = 'STENCIL_ATTACHMENT';
  GL2[(GL2['DEPTH_STENCIL_ATTACHMENT'] = 33306)] = 'DEPTH_STENCIL_ATTACHMENT';
  GL2[(GL2['NONE'] = 0)] = 'NONE';
  GL2[(GL2['FRAMEBUFFER_COMPLETE'] = 36053)] = 'FRAMEBUFFER_COMPLETE';
  GL2[(GL2['FRAMEBUFFER_INCOMPLETE_ATTACHMENT'] = 36054)] =
    'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
  GL2[(GL2['FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT'] = 36055)] =
    'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
  GL2[(GL2['FRAMEBUFFER_INCOMPLETE_DIMENSIONS'] = 36057)] =
    'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
  GL2[(GL2['FRAMEBUFFER_UNSUPPORTED'] = 36061)] = 'FRAMEBUFFER_UNSUPPORTED';
  GL2[(GL2['FRAMEBUFFER_BINDING'] = 36006)] = 'FRAMEBUFFER_BINDING';
  GL2[(GL2['RENDERBUFFER_BINDING'] = 36007)] = 'RENDERBUFFER_BINDING';
  GL2[(GL2['READ_FRAMEBUFFER'] = 36008)] = 'READ_FRAMEBUFFER';
  GL2[(GL2['DRAW_FRAMEBUFFER'] = 36009)] = 'DRAW_FRAMEBUFFER';
  GL2[(GL2['MAX_RENDERBUFFER_SIZE'] = 34024)] = 'MAX_RENDERBUFFER_SIZE';
  GL2[(GL2['INVALID_FRAMEBUFFER_OPERATION'] = 1286)] =
    'INVALID_FRAMEBUFFER_OPERATION';
  GL2[(GL2['UNPACK_FLIP_Y_WEBGL'] = 37440)] = 'UNPACK_FLIP_Y_WEBGL';
  GL2[(GL2['UNPACK_PREMULTIPLY_ALPHA_WEBGL'] = 37441)] =
    'UNPACK_PREMULTIPLY_ALPHA_WEBGL';
  GL2[(GL2['UNPACK_COLORSPACE_CONVERSION_WEBGL'] = 37443)] =
    'UNPACK_COLORSPACE_CONVERSION_WEBGL';
  GL2[(GL2['READ_BUFFER'] = 3074)] = 'READ_BUFFER';
  GL2[(GL2['UNPACK_ROW_LENGTH'] = 3314)] = 'UNPACK_ROW_LENGTH';
  GL2[(GL2['UNPACK_SKIP_ROWS'] = 3315)] = 'UNPACK_SKIP_ROWS';
  GL2[(GL2['UNPACK_SKIP_PIXELS'] = 3316)] = 'UNPACK_SKIP_PIXELS';
  GL2[(GL2['PACK_ROW_LENGTH'] = 3330)] = 'PACK_ROW_LENGTH';
  GL2[(GL2['PACK_SKIP_ROWS'] = 3331)] = 'PACK_SKIP_ROWS';
  GL2[(GL2['PACK_SKIP_PIXELS'] = 3332)] = 'PACK_SKIP_PIXELS';
  GL2[(GL2['TEXTURE_BINDING_3D'] = 32874)] = 'TEXTURE_BINDING_3D';
  GL2[(GL2['UNPACK_SKIP_IMAGES'] = 32877)] = 'UNPACK_SKIP_IMAGES';
  GL2[(GL2['UNPACK_IMAGE_HEIGHT'] = 32878)] = 'UNPACK_IMAGE_HEIGHT';
  GL2[(GL2['MAX_3D_TEXTURE_SIZE'] = 32883)] = 'MAX_3D_TEXTURE_SIZE';
  GL2[(GL2['MAX_ELEMENTS_VERTICES'] = 33e3)] = 'MAX_ELEMENTS_VERTICES';
  GL2[(GL2['MAX_ELEMENTS_INDICES'] = 33001)] = 'MAX_ELEMENTS_INDICES';
  GL2[(GL2['MAX_TEXTURE_LOD_BIAS'] = 34045)] = 'MAX_TEXTURE_LOD_BIAS';
  GL2[(GL2['MAX_FRAGMENT_UNIFORM_COMPONENTS'] = 35657)] =
    'MAX_FRAGMENT_UNIFORM_COMPONENTS';
  GL2[(GL2['MAX_VERTEX_UNIFORM_COMPONENTS'] = 35658)] =
    'MAX_VERTEX_UNIFORM_COMPONENTS';
  GL2[(GL2['MAX_ARRAY_TEXTURE_LAYERS'] = 35071)] = 'MAX_ARRAY_TEXTURE_LAYERS';
  GL2[(GL2['MIN_PROGRAM_TEXEL_OFFSET'] = 35076)] = 'MIN_PROGRAM_TEXEL_OFFSET';
  GL2[(GL2['MAX_PROGRAM_TEXEL_OFFSET'] = 35077)] = 'MAX_PROGRAM_TEXEL_OFFSET';
  GL2[(GL2['MAX_VARYING_COMPONENTS'] = 35659)] = 'MAX_VARYING_COMPONENTS';
  GL2[(GL2['FRAGMENT_SHADER_DERIVATIVE_HINT'] = 35723)] =
    'FRAGMENT_SHADER_DERIVATIVE_HINT';
  GL2[(GL2['RASTERIZER_DISCARD'] = 35977)] = 'RASTERIZER_DISCARD';
  GL2[(GL2['VERTEX_ARRAY_BINDING'] = 34229)] = 'VERTEX_ARRAY_BINDING';
  GL2[(GL2['MAX_VERTEX_OUTPUT_COMPONENTS'] = 37154)] =
    'MAX_VERTEX_OUTPUT_COMPONENTS';
  GL2[(GL2['MAX_FRAGMENT_INPUT_COMPONENTS'] = 37157)] =
    'MAX_FRAGMENT_INPUT_COMPONENTS';
  GL2[(GL2['MAX_SERVER_WAIT_TIMEOUT'] = 37137)] = 'MAX_SERVER_WAIT_TIMEOUT';
  GL2[(GL2['MAX_ELEMENT_INDEX'] = 36203)] = 'MAX_ELEMENT_INDEX';
  GL2[(GL2['RED'] = 6403)] = 'RED';
  GL2[(GL2['RGB8'] = 32849)] = 'RGB8';
  GL2[(GL2['RGBA8'] = 32856)] = 'RGBA8';
  GL2[(GL2['RGB10_A2'] = 32857)] = 'RGB10_A2';
  GL2[(GL2['TEXTURE_3D'] = 32879)] = 'TEXTURE_3D';
  GL2[(GL2['TEXTURE_WRAP_R'] = 32882)] = 'TEXTURE_WRAP_R';
  GL2[(GL2['TEXTURE_MIN_LOD'] = 33082)] = 'TEXTURE_MIN_LOD';
  GL2[(GL2['TEXTURE_MAX_LOD'] = 33083)] = 'TEXTURE_MAX_LOD';
  GL2[(GL2['TEXTURE_BASE_LEVEL'] = 33084)] = 'TEXTURE_BASE_LEVEL';
  GL2[(GL2['TEXTURE_MAX_LEVEL'] = 33085)] = 'TEXTURE_MAX_LEVEL';
  GL2[(GL2['TEXTURE_COMPARE_MODE'] = 34892)] = 'TEXTURE_COMPARE_MODE';
  GL2[(GL2['TEXTURE_COMPARE_FUNC'] = 34893)] = 'TEXTURE_COMPARE_FUNC';
  GL2[(GL2['SRGB'] = 35904)] = 'SRGB';
  GL2[(GL2['SRGB8'] = 35905)] = 'SRGB8';
  GL2[(GL2['SRGB8_ALPHA8'] = 35907)] = 'SRGB8_ALPHA8';
  GL2[(GL2['COMPARE_REF_TO_TEXTURE'] = 34894)] = 'COMPARE_REF_TO_TEXTURE';
  GL2[(GL2['RGBA32F'] = 34836)] = 'RGBA32F';
  GL2[(GL2['RGB32F'] = 34837)] = 'RGB32F';
  GL2[(GL2['RGBA16F'] = 34842)] = 'RGBA16F';
  GL2[(GL2['RGB16F'] = 34843)] = 'RGB16F';
  GL2[(GL2['TEXTURE_2D_ARRAY'] = 35866)] = 'TEXTURE_2D_ARRAY';
  GL2[(GL2['TEXTURE_BINDING_2D_ARRAY'] = 35869)] = 'TEXTURE_BINDING_2D_ARRAY';
  GL2[(GL2['R11F_G11F_B10F'] = 35898)] = 'R11F_G11F_B10F';
  GL2[(GL2['RGB9_E5'] = 35901)] = 'RGB9_E5';
  GL2[(GL2['RGBA32UI'] = 36208)] = 'RGBA32UI';
  GL2[(GL2['RGB32UI'] = 36209)] = 'RGB32UI';
  GL2[(GL2['RGBA16UI'] = 36214)] = 'RGBA16UI';
  GL2[(GL2['RGB16UI'] = 36215)] = 'RGB16UI';
  GL2[(GL2['RGBA8UI'] = 36220)] = 'RGBA8UI';
  GL2[(GL2['RGB8UI'] = 36221)] = 'RGB8UI';
  GL2[(GL2['RGBA32I'] = 36226)] = 'RGBA32I';
  GL2[(GL2['RGB32I'] = 36227)] = 'RGB32I';
  GL2[(GL2['RGBA16I'] = 36232)] = 'RGBA16I';
  GL2[(GL2['RGB16I'] = 36233)] = 'RGB16I';
  GL2[(GL2['RGBA8I'] = 36238)] = 'RGBA8I';
  GL2[(GL2['RGB8I'] = 36239)] = 'RGB8I';
  GL2[(GL2['RED_INTEGER'] = 36244)] = 'RED_INTEGER';
  GL2[(GL2['RGB_INTEGER'] = 36248)] = 'RGB_INTEGER';
  GL2[(GL2['RGBA_INTEGER'] = 36249)] = 'RGBA_INTEGER';
  GL2[(GL2['R8'] = 33321)] = 'R8';
  GL2[(GL2['RG8'] = 33323)] = 'RG8';
  GL2[(GL2['R16F'] = 33325)] = 'R16F';
  GL2[(GL2['R32F'] = 33326)] = 'R32F';
  GL2[(GL2['RG16F'] = 33327)] = 'RG16F';
  GL2[(GL2['RG32F'] = 33328)] = 'RG32F';
  GL2[(GL2['R8I'] = 33329)] = 'R8I';
  GL2[(GL2['R8UI'] = 33330)] = 'R8UI';
  GL2[(GL2['R16I'] = 33331)] = 'R16I';
  GL2[(GL2['R16UI'] = 33332)] = 'R16UI';
  GL2[(GL2['R32I'] = 33333)] = 'R32I';
  GL2[(GL2['R32UI'] = 33334)] = 'R32UI';
  GL2[(GL2['RG8I'] = 33335)] = 'RG8I';
  GL2[(GL2['RG8UI'] = 33336)] = 'RG8UI';
  GL2[(GL2['RG16I'] = 33337)] = 'RG16I';
  GL2[(GL2['RG16UI'] = 33338)] = 'RG16UI';
  GL2[(GL2['RG32I'] = 33339)] = 'RG32I';
  GL2[(GL2['RG32UI'] = 33340)] = 'RG32UI';
  GL2[(GL2['R8_SNORM'] = 36756)] = 'R8_SNORM';
  GL2[(GL2['RG8_SNORM'] = 36757)] = 'RG8_SNORM';
  GL2[(GL2['RGB8_SNORM'] = 36758)] = 'RGB8_SNORM';
  GL2[(GL2['RGBA8_SNORM'] = 36759)] = 'RGBA8_SNORM';
  GL2[(GL2['RGB10_A2UI'] = 36975)] = 'RGB10_A2UI';
  GL2[(GL2['TEXTURE_IMMUTABLE_FORMAT'] = 37167)] = 'TEXTURE_IMMUTABLE_FORMAT';
  GL2[(GL2['TEXTURE_IMMUTABLE_LEVELS'] = 33503)] = 'TEXTURE_IMMUTABLE_LEVELS';
  GL2[(GL2['UNSIGNED_INT_2_10_10_10_REV'] = 33640)] =
    'UNSIGNED_INT_2_10_10_10_REV';
  GL2[(GL2['UNSIGNED_INT_10F_11F_11F_REV'] = 35899)] =
    'UNSIGNED_INT_10F_11F_11F_REV';
  GL2[(GL2['UNSIGNED_INT_5_9_9_9_REV'] = 35902)] = 'UNSIGNED_INT_5_9_9_9_REV';
  GL2[(GL2['FLOAT_32_UNSIGNED_INT_24_8_REV'] = 36269)] =
    'FLOAT_32_UNSIGNED_INT_24_8_REV';
  GL2[(GL2['UNSIGNED_INT_24_8'] = 34042)] = 'UNSIGNED_INT_24_8';
  GL2[(GL2['HALF_FLOAT'] = 5131)] = 'HALF_FLOAT';
  GL2[(GL2['RG'] = 33319)] = 'RG';
  GL2[(GL2['RG_INTEGER'] = 33320)] = 'RG_INTEGER';
  GL2[(GL2['INT_2_10_10_10_REV'] = 36255)] = 'INT_2_10_10_10_REV';
  GL2[(GL2['CURRENT_QUERY'] = 34917)] = 'CURRENT_QUERY';
  GL2[(GL2['QUERY_RESULT'] = 34918)] = 'QUERY_RESULT';
  GL2[(GL2['QUERY_RESULT_AVAILABLE'] = 34919)] = 'QUERY_RESULT_AVAILABLE';
  GL2[(GL2['ANY_SAMPLES_PASSED'] = 35887)] = 'ANY_SAMPLES_PASSED';
  GL2[(GL2['ANY_SAMPLES_PASSED_CONSERVATIVE'] = 36202)] =
    'ANY_SAMPLES_PASSED_CONSERVATIVE';
  GL2[(GL2['MAX_DRAW_BUFFERS'] = 34852)] = 'MAX_DRAW_BUFFERS';
  GL2[(GL2['DRAW_BUFFER0'] = 34853)] = 'DRAW_BUFFER0';
  GL2[(GL2['DRAW_BUFFER1'] = 34854)] = 'DRAW_BUFFER1';
  GL2[(GL2['DRAW_BUFFER2'] = 34855)] = 'DRAW_BUFFER2';
  GL2[(GL2['DRAW_BUFFER3'] = 34856)] = 'DRAW_BUFFER3';
  GL2[(GL2['DRAW_BUFFER4'] = 34857)] = 'DRAW_BUFFER4';
  GL2[(GL2['DRAW_BUFFER5'] = 34858)] = 'DRAW_BUFFER5';
  GL2[(GL2['DRAW_BUFFER6'] = 34859)] = 'DRAW_BUFFER6';
  GL2[(GL2['DRAW_BUFFER7'] = 34860)] = 'DRAW_BUFFER7';
  GL2[(GL2['DRAW_BUFFER8'] = 34861)] = 'DRAW_BUFFER8';
  GL2[(GL2['DRAW_BUFFER9'] = 34862)] = 'DRAW_BUFFER9';
  GL2[(GL2['DRAW_BUFFER10'] = 34863)] = 'DRAW_BUFFER10';
  GL2[(GL2['DRAW_BUFFER11'] = 34864)] = 'DRAW_BUFFER11';
  GL2[(GL2['DRAW_BUFFER12'] = 34865)] = 'DRAW_BUFFER12';
  GL2[(GL2['DRAW_BUFFER13'] = 34866)] = 'DRAW_BUFFER13';
  GL2[(GL2['DRAW_BUFFER14'] = 34867)] = 'DRAW_BUFFER14';
  GL2[(GL2['DRAW_BUFFER15'] = 34868)] = 'DRAW_BUFFER15';
  GL2[(GL2['MAX_COLOR_ATTACHMENTS'] = 36063)] = 'MAX_COLOR_ATTACHMENTS';
  GL2[(GL2['COLOR_ATTACHMENT1'] = 36065)] = 'COLOR_ATTACHMENT1';
  GL2[(GL2['COLOR_ATTACHMENT2'] = 36066)] = 'COLOR_ATTACHMENT2';
  GL2[(GL2['COLOR_ATTACHMENT3'] = 36067)] = 'COLOR_ATTACHMENT3';
  GL2[(GL2['COLOR_ATTACHMENT4'] = 36068)] = 'COLOR_ATTACHMENT4';
  GL2[(GL2['COLOR_ATTACHMENT5'] = 36069)] = 'COLOR_ATTACHMENT5';
  GL2[(GL2['COLOR_ATTACHMENT6'] = 36070)] = 'COLOR_ATTACHMENT6';
  GL2[(GL2['COLOR_ATTACHMENT7'] = 36071)] = 'COLOR_ATTACHMENT7';
  GL2[(GL2['COLOR_ATTACHMENT8'] = 36072)] = 'COLOR_ATTACHMENT8';
  GL2[(GL2['COLOR_ATTACHMENT9'] = 36073)] = 'COLOR_ATTACHMENT9';
  GL2[(GL2['COLOR_ATTACHMENT10'] = 36074)] = 'COLOR_ATTACHMENT10';
  GL2[(GL2['COLOR_ATTACHMENT11'] = 36075)] = 'COLOR_ATTACHMENT11';
  GL2[(GL2['COLOR_ATTACHMENT12'] = 36076)] = 'COLOR_ATTACHMENT12';
  GL2[(GL2['COLOR_ATTACHMENT13'] = 36077)] = 'COLOR_ATTACHMENT13';
  GL2[(GL2['COLOR_ATTACHMENT14'] = 36078)] = 'COLOR_ATTACHMENT14';
  GL2[(GL2['COLOR_ATTACHMENT15'] = 36079)] = 'COLOR_ATTACHMENT15';
  GL2[(GL2['SAMPLER_3D'] = 35679)] = 'SAMPLER_3D';
  GL2[(GL2['SAMPLER_2D_SHADOW'] = 35682)] = 'SAMPLER_2D_SHADOW';
  GL2[(GL2['SAMPLER_2D_ARRAY'] = 36289)] = 'SAMPLER_2D_ARRAY';
  GL2[(GL2['SAMPLER_2D_ARRAY_SHADOW'] = 36292)] = 'SAMPLER_2D_ARRAY_SHADOW';
  GL2[(GL2['SAMPLER_CUBE_SHADOW'] = 36293)] = 'SAMPLER_CUBE_SHADOW';
  GL2[(GL2['INT_SAMPLER_2D'] = 36298)] = 'INT_SAMPLER_2D';
  GL2[(GL2['INT_SAMPLER_3D'] = 36299)] = 'INT_SAMPLER_3D';
  GL2[(GL2['INT_SAMPLER_CUBE'] = 36300)] = 'INT_SAMPLER_CUBE';
  GL2[(GL2['INT_SAMPLER_2D_ARRAY'] = 36303)] = 'INT_SAMPLER_2D_ARRAY';
  GL2[(GL2['UNSIGNED_INT_SAMPLER_2D'] = 36306)] = 'UNSIGNED_INT_SAMPLER_2D';
  GL2[(GL2['UNSIGNED_INT_SAMPLER_3D'] = 36307)] = 'UNSIGNED_INT_SAMPLER_3D';
  GL2[(GL2['UNSIGNED_INT_SAMPLER_CUBE'] = 36308)] = 'UNSIGNED_INT_SAMPLER_CUBE';
  GL2[(GL2['UNSIGNED_INT_SAMPLER_2D_ARRAY'] = 36311)] =
    'UNSIGNED_INT_SAMPLER_2D_ARRAY';
  GL2[(GL2['MAX_SAMPLES'] = 36183)] = 'MAX_SAMPLES';
  GL2[(GL2['SAMPLER_BINDING'] = 35097)] = 'SAMPLER_BINDING';
  GL2[(GL2['PIXEL_PACK_BUFFER'] = 35051)] = 'PIXEL_PACK_BUFFER';
  GL2[(GL2['PIXEL_UNPACK_BUFFER'] = 35052)] = 'PIXEL_UNPACK_BUFFER';
  GL2[(GL2['PIXEL_PACK_BUFFER_BINDING'] = 35053)] = 'PIXEL_PACK_BUFFER_BINDING';
  GL2[(GL2['PIXEL_UNPACK_BUFFER_BINDING'] = 35055)] =
    'PIXEL_UNPACK_BUFFER_BINDING';
  GL2[(GL2['COPY_READ_BUFFER'] = 36662)] = 'COPY_READ_BUFFER';
  GL2[(GL2['COPY_WRITE_BUFFER'] = 36663)] = 'COPY_WRITE_BUFFER';
  GL2[(GL2['COPY_READ_BUFFER_BINDING'] = 36662)] = 'COPY_READ_BUFFER_BINDING';
  GL2[(GL2['COPY_WRITE_BUFFER_BINDING'] = 36663)] = 'COPY_WRITE_BUFFER_BINDING';
  GL2[(GL2['FLOAT_MAT2x3'] = 35685)] = 'FLOAT_MAT2x3';
  GL2[(GL2['FLOAT_MAT2x4'] = 35686)] = 'FLOAT_MAT2x4';
  GL2[(GL2['FLOAT_MAT3x2'] = 35687)] = 'FLOAT_MAT3x2';
  GL2[(GL2['FLOAT_MAT3x4'] = 35688)] = 'FLOAT_MAT3x4';
  GL2[(GL2['FLOAT_MAT4x2'] = 35689)] = 'FLOAT_MAT4x2';
  GL2[(GL2['FLOAT_MAT4x3'] = 35690)] = 'FLOAT_MAT4x3';
  GL2[(GL2['UNSIGNED_INT_VEC2'] = 36294)] = 'UNSIGNED_INT_VEC2';
  GL2[(GL2['UNSIGNED_INT_VEC3'] = 36295)] = 'UNSIGNED_INT_VEC3';
  GL2[(GL2['UNSIGNED_INT_VEC4'] = 36296)] = 'UNSIGNED_INT_VEC4';
  GL2[(GL2['UNSIGNED_NORMALIZED'] = 35863)] = 'UNSIGNED_NORMALIZED';
  GL2[(GL2['SIGNED_NORMALIZED'] = 36764)] = 'SIGNED_NORMALIZED';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_INTEGER'] = 35069)] =
    'VERTEX_ATTRIB_ARRAY_INTEGER';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_DIVISOR'] = 35070)] =
    'VERTEX_ATTRIB_ARRAY_DIVISOR';
  GL2[(GL2['TRANSFORM_FEEDBACK_BUFFER_MODE'] = 35967)] =
    'TRANSFORM_FEEDBACK_BUFFER_MODE';
  GL2[(GL2['MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS'] = 35968)] =
    'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS';
  GL2[(GL2['TRANSFORM_FEEDBACK_VARYINGS'] = 35971)] =
    'TRANSFORM_FEEDBACK_VARYINGS';
  GL2[(GL2['TRANSFORM_FEEDBACK_BUFFER_START'] = 35972)] =
    'TRANSFORM_FEEDBACK_BUFFER_START';
  GL2[(GL2['TRANSFORM_FEEDBACK_BUFFER_SIZE'] = 35973)] =
    'TRANSFORM_FEEDBACK_BUFFER_SIZE';
  GL2[(GL2['TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN'] = 35976)] =
    'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN';
  GL2[(GL2['MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS'] = 35978)] =
    'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS';
  GL2[(GL2['MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS'] = 35979)] =
    'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS';
  GL2[(GL2['INTERLEAVED_ATTRIBS'] = 35980)] = 'INTERLEAVED_ATTRIBS';
  GL2[(GL2['SEPARATE_ATTRIBS'] = 35981)] = 'SEPARATE_ATTRIBS';
  GL2[(GL2['TRANSFORM_FEEDBACK_BUFFER'] = 35982)] = 'TRANSFORM_FEEDBACK_BUFFER';
  GL2[(GL2['TRANSFORM_FEEDBACK_BUFFER_BINDING'] = 35983)] =
    'TRANSFORM_FEEDBACK_BUFFER_BINDING';
  GL2[(GL2['TRANSFORM_FEEDBACK'] = 36386)] = 'TRANSFORM_FEEDBACK';
  GL2[(GL2['TRANSFORM_FEEDBACK_PAUSED'] = 36387)] = 'TRANSFORM_FEEDBACK_PAUSED';
  GL2[(GL2['TRANSFORM_FEEDBACK_ACTIVE'] = 36388)] = 'TRANSFORM_FEEDBACK_ACTIVE';
  GL2[(GL2['TRANSFORM_FEEDBACK_BINDING'] = 36389)] =
    'TRANSFORM_FEEDBACK_BINDING';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING'] = 33296)] =
    'FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE'] = 33297)] =
    'FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_RED_SIZE'] = 33298)] =
    'FRAMEBUFFER_ATTACHMENT_RED_SIZE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_GREEN_SIZE'] = 33299)] =
    'FRAMEBUFFER_ATTACHMENT_GREEN_SIZE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_BLUE_SIZE'] = 33300)] =
    'FRAMEBUFFER_ATTACHMENT_BLUE_SIZE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE'] = 33301)] =
    'FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE'] = 33302)] =
    'FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE'] = 33303)] =
    'FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE';
  GL2[(GL2['FRAMEBUFFER_DEFAULT'] = 33304)] = 'FRAMEBUFFER_DEFAULT';
  GL2[(GL2['DEPTH24_STENCIL8'] = 35056)] = 'DEPTH24_STENCIL8';
  GL2[(GL2['DRAW_FRAMEBUFFER_BINDING'] = 36006)] = 'DRAW_FRAMEBUFFER_BINDING';
  GL2[(GL2['READ_FRAMEBUFFER_BINDING'] = 36010)] = 'READ_FRAMEBUFFER_BINDING';
  GL2[(GL2['RENDERBUFFER_SAMPLES'] = 36011)] = 'RENDERBUFFER_SAMPLES';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER'] = 36052)] =
    'FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER';
  GL2[(GL2['FRAMEBUFFER_INCOMPLETE_MULTISAMPLE'] = 36182)] =
    'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE';
  GL2[(GL2['UNIFORM_BUFFER'] = 35345)] = 'UNIFORM_BUFFER';
  GL2[(GL2['UNIFORM_BUFFER_BINDING'] = 35368)] = 'UNIFORM_BUFFER_BINDING';
  GL2[(GL2['UNIFORM_BUFFER_START'] = 35369)] = 'UNIFORM_BUFFER_START';
  GL2[(GL2['UNIFORM_BUFFER_SIZE'] = 35370)] = 'UNIFORM_BUFFER_SIZE';
  GL2[(GL2['MAX_VERTEX_UNIFORM_BLOCKS'] = 35371)] = 'MAX_VERTEX_UNIFORM_BLOCKS';
  GL2[(GL2['MAX_FRAGMENT_UNIFORM_BLOCKS'] = 35373)] =
    'MAX_FRAGMENT_UNIFORM_BLOCKS';
  GL2[(GL2['MAX_COMBINED_UNIFORM_BLOCKS'] = 35374)] =
    'MAX_COMBINED_UNIFORM_BLOCKS';
  GL2[(GL2['MAX_UNIFORM_BUFFER_BINDINGS'] = 35375)] =
    'MAX_UNIFORM_BUFFER_BINDINGS';
  GL2[(GL2['MAX_UNIFORM_BLOCK_SIZE'] = 35376)] = 'MAX_UNIFORM_BLOCK_SIZE';
  GL2[(GL2['MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS'] = 35377)] =
    'MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS';
  GL2[(GL2['MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS'] = 35379)] =
    'MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS';
  GL2[(GL2['UNIFORM_BUFFER_OFFSET_ALIGNMENT'] = 35380)] =
    'UNIFORM_BUFFER_OFFSET_ALIGNMENT';
  GL2[(GL2['ACTIVE_UNIFORM_BLOCKS'] = 35382)] = 'ACTIVE_UNIFORM_BLOCKS';
  GL2[(GL2['UNIFORM_TYPE'] = 35383)] = 'UNIFORM_TYPE';
  GL2[(GL2['UNIFORM_SIZE'] = 35384)] = 'UNIFORM_SIZE';
  GL2[(GL2['UNIFORM_BLOCK_INDEX'] = 35386)] = 'UNIFORM_BLOCK_INDEX';
  GL2[(GL2['UNIFORM_OFFSET'] = 35387)] = 'UNIFORM_OFFSET';
  GL2[(GL2['UNIFORM_ARRAY_STRIDE'] = 35388)] = 'UNIFORM_ARRAY_STRIDE';
  GL2[(GL2['UNIFORM_MATRIX_STRIDE'] = 35389)] = 'UNIFORM_MATRIX_STRIDE';
  GL2[(GL2['UNIFORM_IS_ROW_MAJOR'] = 35390)] = 'UNIFORM_IS_ROW_MAJOR';
  GL2[(GL2['UNIFORM_BLOCK_BINDING'] = 35391)] = 'UNIFORM_BLOCK_BINDING';
  GL2[(GL2['UNIFORM_BLOCK_DATA_SIZE'] = 35392)] = 'UNIFORM_BLOCK_DATA_SIZE';
  GL2[(GL2['UNIFORM_BLOCK_ACTIVE_UNIFORMS'] = 35394)] =
    'UNIFORM_BLOCK_ACTIVE_UNIFORMS';
  GL2[(GL2['UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES'] = 35395)] =
    'UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES';
  GL2[(GL2['UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER'] = 35396)] =
    'UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER';
  GL2[(GL2['UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER'] = 35398)] =
    'UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER';
  GL2[(GL2['OBJECT_TYPE'] = 37138)] = 'OBJECT_TYPE';
  GL2[(GL2['SYNC_CONDITION'] = 37139)] = 'SYNC_CONDITION';
  GL2[(GL2['SYNC_STATUS'] = 37140)] = 'SYNC_STATUS';
  GL2[(GL2['SYNC_FLAGS'] = 37141)] = 'SYNC_FLAGS';
  GL2[(GL2['SYNC_FENCE'] = 37142)] = 'SYNC_FENCE';
  GL2[(GL2['SYNC_GPU_COMMANDS_COMPLETE'] = 37143)] =
    'SYNC_GPU_COMMANDS_COMPLETE';
  GL2[(GL2['UNSIGNALED'] = 37144)] = 'UNSIGNALED';
  GL2[(GL2['SIGNALED'] = 37145)] = 'SIGNALED';
  GL2[(GL2['ALREADY_SIGNALED'] = 37146)] = 'ALREADY_SIGNALED';
  GL2[(GL2['TIMEOUT_EXPIRED'] = 37147)] = 'TIMEOUT_EXPIRED';
  GL2[(GL2['CONDITION_SATISFIED'] = 37148)] = 'CONDITION_SATISFIED';
  GL2[(GL2['WAIT_FAILED'] = 37149)] = 'WAIT_FAILED';
  GL2[(GL2['SYNC_FLUSH_COMMANDS_BIT'] = 1)] = 'SYNC_FLUSH_COMMANDS_BIT';
  GL2[(GL2['COLOR'] = 6144)] = 'COLOR';
  GL2[(GL2['DEPTH'] = 6145)] = 'DEPTH';
  GL2[(GL2['STENCIL'] = 6146)] = 'STENCIL';
  GL2[(GL2['MIN'] = 32775)] = 'MIN';
  GL2[(GL2['MAX'] = 32776)] = 'MAX';
  GL2[(GL2['DEPTH_COMPONENT24'] = 33190)] = 'DEPTH_COMPONENT24';
  GL2[(GL2['STREAM_READ'] = 35041)] = 'STREAM_READ';
  GL2[(GL2['STREAM_COPY'] = 35042)] = 'STREAM_COPY';
  GL2[(GL2['STATIC_READ'] = 35045)] = 'STATIC_READ';
  GL2[(GL2['STATIC_COPY'] = 35046)] = 'STATIC_COPY';
  GL2[(GL2['DYNAMIC_READ'] = 35049)] = 'DYNAMIC_READ';
  GL2[(GL2['DYNAMIC_COPY'] = 35050)] = 'DYNAMIC_COPY';
  GL2[(GL2['DEPTH_COMPONENT32F'] = 36012)] = 'DEPTH_COMPONENT32F';
  GL2[(GL2['DEPTH32F_STENCIL8'] = 36013)] = 'DEPTH32F_STENCIL8';
  GL2[(GL2['INVALID_INDEX'] = 4294967295)] = 'INVALID_INDEX';
  GL2[(GL2['TIMEOUT_IGNORED'] = -1)] = 'TIMEOUT_IGNORED';
  GL2[(GL2['MAX_CLIENT_WAIT_TIMEOUT_WEBGL'] = 37447)] =
    'MAX_CLIENT_WAIT_TIMEOUT_WEBGL';
  GL2[(GL2['VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE'] = 35070)] =
    'VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE';
  GL2[(GL2['UNMASKED_VENDOR_WEBGL'] = 37445)] = 'UNMASKED_VENDOR_WEBGL';
  GL2[(GL2['UNMASKED_RENDERER_WEBGL'] = 37446)] = 'UNMASKED_RENDERER_WEBGL';
  GL2[(GL2['MAX_TEXTURE_MAX_ANISOTROPY_EXT'] = 34047)] =
    'MAX_TEXTURE_MAX_ANISOTROPY_EXT';
  GL2[(GL2['TEXTURE_MAX_ANISOTROPY_EXT'] = 34046)] =
    'TEXTURE_MAX_ANISOTROPY_EXT';
  GL2[(GL2['COMPRESSED_RGB_S3TC_DXT1_EXT'] = 33776)] =
    'COMPRESSED_RGB_S3TC_DXT1_EXT';
  GL2[(GL2['COMPRESSED_RGBA_S3TC_DXT1_EXT'] = 33777)] =
    'COMPRESSED_RGBA_S3TC_DXT1_EXT';
  GL2[(GL2['COMPRESSED_RGBA_S3TC_DXT3_EXT'] = 33778)] =
    'COMPRESSED_RGBA_S3TC_DXT3_EXT';
  GL2[(GL2['COMPRESSED_RGBA_S3TC_DXT5_EXT'] = 33779)] =
    'COMPRESSED_RGBA_S3TC_DXT5_EXT';
  GL2[(GL2['COMPRESSED_R11_EAC'] = 37488)] = 'COMPRESSED_R11_EAC';
  GL2[(GL2['COMPRESSED_SIGNED_R11_EAC'] = 37489)] = 'COMPRESSED_SIGNED_R11_EAC';
  GL2[(GL2['COMPRESSED_RG11_EAC'] = 37490)] = 'COMPRESSED_RG11_EAC';
  GL2[(GL2['COMPRESSED_SIGNED_RG11_EAC'] = 37491)] =
    'COMPRESSED_SIGNED_RG11_EAC';
  GL2[(GL2['COMPRESSED_RGB8_ETC2'] = 37492)] = 'COMPRESSED_RGB8_ETC2';
  GL2[(GL2['COMPRESSED_RGBA8_ETC2_EAC'] = 37493)] = 'COMPRESSED_RGBA8_ETC2_EAC';
  GL2[(GL2['COMPRESSED_SRGB8_ETC2'] = 37494)] = 'COMPRESSED_SRGB8_ETC2';
  GL2[(GL2['COMPRESSED_SRGB8_ALPHA8_ETC2_EAC'] = 37495)] =
    'COMPRESSED_SRGB8_ALPHA8_ETC2_EAC';
  GL2[(GL2['COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2'] = 37496)] =
    'COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2';
  GL2[(GL2['COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2'] = 37497)] =
    'COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2';
  GL2[(GL2['COMPRESSED_RGB_PVRTC_4BPPV1_IMG'] = 35840)] =
    'COMPRESSED_RGB_PVRTC_4BPPV1_IMG';
  GL2[(GL2['COMPRESSED_RGBA_PVRTC_4BPPV1_IMG'] = 35842)] =
    'COMPRESSED_RGBA_PVRTC_4BPPV1_IMG';
  GL2[(GL2['COMPRESSED_RGB_PVRTC_2BPPV1_IMG'] = 35841)] =
    'COMPRESSED_RGB_PVRTC_2BPPV1_IMG';
  GL2[(GL2['COMPRESSED_RGBA_PVRTC_2BPPV1_IMG'] = 35843)] =
    'COMPRESSED_RGBA_PVRTC_2BPPV1_IMG';
  GL2[(GL2['COMPRESSED_RGB_ETC1_WEBGL'] = 36196)] = 'COMPRESSED_RGB_ETC1_WEBGL';
  GL2[(GL2['COMPRESSED_RGB_ATC_WEBGL'] = 35986)] = 'COMPRESSED_RGB_ATC_WEBGL';
  GL2[(GL2['COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL'] = 35986)] =
    'COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL';
  GL2[(GL2['COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL'] = 34798)] =
    'COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL';
  GL2[(GL2['UNSIGNED_INT_24_8_WEBGL'] = 34042)] = 'UNSIGNED_INT_24_8_WEBGL';
  GL2[(GL2['HALF_FLOAT_OES'] = 36193)] = 'HALF_FLOAT_OES';
  GL2[(GL2['RGBA32F_EXT'] = 34836)] = 'RGBA32F_EXT';
  GL2[(GL2['RGB32F_EXT'] = 34837)] = 'RGB32F_EXT';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT'] = 33297)] =
    'FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT';
  GL2[(GL2['UNSIGNED_NORMALIZED_EXT'] = 35863)] = 'UNSIGNED_NORMALIZED_EXT';
  GL2[(GL2['MIN_EXT'] = 32775)] = 'MIN_EXT';
  GL2[(GL2['MAX_EXT'] = 32776)] = 'MAX_EXT';
  GL2[(GL2['SRGB_EXT'] = 35904)] = 'SRGB_EXT';
  GL2[(GL2['SRGB_ALPHA_EXT'] = 35906)] = 'SRGB_ALPHA_EXT';
  GL2[(GL2['SRGB8_ALPHA8_EXT'] = 35907)] = 'SRGB8_ALPHA8_EXT';
  GL2[(GL2['FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING_EXT'] = 33296)] =
    'FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING_EXT';
  GL2[(GL2['FRAGMENT_SHADER_DERIVATIVE_HINT_OES'] = 35723)] =
    'FRAGMENT_SHADER_DERIVATIVE_HINT_OES';
  GL2[(GL2['COLOR_ATTACHMENT0_WEBGL'] = 36064)] = 'COLOR_ATTACHMENT0_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT1_WEBGL'] = 36065)] = 'COLOR_ATTACHMENT1_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT2_WEBGL'] = 36066)] = 'COLOR_ATTACHMENT2_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT3_WEBGL'] = 36067)] = 'COLOR_ATTACHMENT3_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT4_WEBGL'] = 36068)] = 'COLOR_ATTACHMENT4_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT5_WEBGL'] = 36069)] = 'COLOR_ATTACHMENT5_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT6_WEBGL'] = 36070)] = 'COLOR_ATTACHMENT6_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT7_WEBGL'] = 36071)] = 'COLOR_ATTACHMENT7_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT8_WEBGL'] = 36072)] = 'COLOR_ATTACHMENT8_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT9_WEBGL'] = 36073)] = 'COLOR_ATTACHMENT9_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT10_WEBGL'] = 36074)] = 'COLOR_ATTACHMENT10_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT11_WEBGL'] = 36075)] = 'COLOR_ATTACHMENT11_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT12_WEBGL'] = 36076)] = 'COLOR_ATTACHMENT12_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT13_WEBGL'] = 36077)] = 'COLOR_ATTACHMENT13_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT14_WEBGL'] = 36078)] = 'COLOR_ATTACHMENT14_WEBGL';
  GL2[(GL2['COLOR_ATTACHMENT15_WEBGL'] = 36079)] = 'COLOR_ATTACHMENT15_WEBGL';
  GL2[(GL2['DRAW_BUFFER0_WEBGL'] = 34853)] = 'DRAW_BUFFER0_WEBGL';
  GL2[(GL2['DRAW_BUFFER1_WEBGL'] = 34854)] = 'DRAW_BUFFER1_WEBGL';
  GL2[(GL2['DRAW_BUFFER2_WEBGL'] = 34855)] = 'DRAW_BUFFER2_WEBGL';
  GL2[(GL2['DRAW_BUFFER3_WEBGL'] = 34856)] = 'DRAW_BUFFER3_WEBGL';
  GL2[(GL2['DRAW_BUFFER4_WEBGL'] = 34857)] = 'DRAW_BUFFER4_WEBGL';
  GL2[(GL2['DRAW_BUFFER5_WEBGL'] = 34858)] = 'DRAW_BUFFER5_WEBGL';
  GL2[(GL2['DRAW_BUFFER6_WEBGL'] = 34859)] = 'DRAW_BUFFER6_WEBGL';
  GL2[(GL2['DRAW_BUFFER7_WEBGL'] = 34860)] = 'DRAW_BUFFER7_WEBGL';
  GL2[(GL2['DRAW_BUFFER8_WEBGL'] = 34861)] = 'DRAW_BUFFER8_WEBGL';
  GL2[(GL2['DRAW_BUFFER9_WEBGL'] = 34862)] = 'DRAW_BUFFER9_WEBGL';
  GL2[(GL2['DRAW_BUFFER10_WEBGL'] = 34863)] = 'DRAW_BUFFER10_WEBGL';
  GL2[(GL2['DRAW_BUFFER11_WEBGL'] = 34864)] = 'DRAW_BUFFER11_WEBGL';
  GL2[(GL2['DRAW_BUFFER12_WEBGL'] = 34865)] = 'DRAW_BUFFER12_WEBGL';
  GL2[(GL2['DRAW_BUFFER13_WEBGL'] = 34866)] = 'DRAW_BUFFER13_WEBGL';
  GL2[(GL2['DRAW_BUFFER14_WEBGL'] = 34867)] = 'DRAW_BUFFER14_WEBGL';
  GL2[(GL2['DRAW_BUFFER15_WEBGL'] = 34868)] = 'DRAW_BUFFER15_WEBGL';
  GL2[(GL2['MAX_COLOR_ATTACHMENTS_WEBGL'] = 36063)] =
    'MAX_COLOR_ATTACHMENTS_WEBGL';
  GL2[(GL2['MAX_DRAW_BUFFERS_WEBGL'] = 34852)] = 'MAX_DRAW_BUFFERS_WEBGL';
  GL2[(GL2['VERTEX_ARRAY_BINDING_OES'] = 34229)] = 'VERTEX_ARRAY_BINDING_OES';
  GL2[(GL2['QUERY_COUNTER_BITS_EXT'] = 34916)] = 'QUERY_COUNTER_BITS_EXT';
  GL2[(GL2['CURRENT_QUERY_EXT'] = 34917)] = 'CURRENT_QUERY_EXT';
  GL2[(GL2['QUERY_RESULT_EXT'] = 34918)] = 'QUERY_RESULT_EXT';
  GL2[(GL2['QUERY_RESULT_AVAILABLE_EXT'] = 34919)] =
    'QUERY_RESULT_AVAILABLE_EXT';
  GL2[(GL2['TIME_ELAPSED_EXT'] = 35007)] = 'TIME_ELAPSED_EXT';
  GL2[(GL2['TIMESTAMP_EXT'] = 36392)] = 'TIMESTAMP_EXT';
  GL2[(GL2['GPU_DISJOINT_EXT'] = 36795)] = 'GPU_DISJOINT_EXT';
})(GL || (GL = {}));
var ResourceType;
(function (ResourceType2) {
  ResourceType2[(ResourceType2['Buffer'] = 0)] = 'Buffer';
  ResourceType2[(ResourceType2['Texture'] = 1)] = 'Texture';
  ResourceType2[(ResourceType2['RenderTarget'] = 2)] = 'RenderTarget';
  ResourceType2[(ResourceType2['Sampler'] = 3)] = 'Sampler';
  ResourceType2[(ResourceType2['Program'] = 4)] = 'Program';
  ResourceType2[(ResourceType2['Bindings'] = 5)] = 'Bindings';
  ResourceType2[(ResourceType2['InputLayout'] = 6)] = 'InputLayout';
  ResourceType2[(ResourceType2['RenderPipeline'] = 7)] = 'RenderPipeline';
  ResourceType2[(ResourceType2['ComputePipeline'] = 8)] = 'ComputePipeline';
  ResourceType2[(ResourceType2['Readback'] = 9)] = 'Readback';
  ResourceType2[(ResourceType2['QueryPool'] = 10)] = 'QueryPool';
  ResourceType2[(ResourceType2['RenderBundle'] = 11)] = 'RenderBundle';
})(ResourceType || (ResourceType = {}));
var CompareFunction;
(function (CompareFunction2) {
  CompareFunction2[(CompareFunction2['NEVER'] = 512)] = 'NEVER';
  CompareFunction2[(CompareFunction2['LESS'] = 513)] = 'LESS';
  CompareFunction2[(CompareFunction2['EQUAL'] = 514)] = 'EQUAL';
  CompareFunction2[(CompareFunction2['LEQUAL'] = 515)] = 'LEQUAL';
  CompareFunction2[(CompareFunction2['GREATER'] = 516)] = 'GREATER';
  CompareFunction2[(CompareFunction2['NOTEQUAL'] = 517)] = 'NOTEQUAL';
  CompareFunction2[(CompareFunction2['GEQUAL'] = 518)] = 'GEQUAL';
  CompareFunction2[(CompareFunction2['ALWAYS'] = 519)] = 'ALWAYS';
})(CompareFunction || (CompareFunction = {}));
var FrontFace;
(function (FrontFace2) {
  FrontFace2[(FrontFace2['CCW'] = 2305)] = 'CCW';
  FrontFace2[(FrontFace2['CW'] = 2304)] = 'CW';
})(FrontFace || (FrontFace = {}));
var CullMode;
(function (CullMode2) {
  CullMode2[(CullMode2['NONE'] = 0)] = 'NONE';
  CullMode2[(CullMode2['FRONT'] = 1)] = 'FRONT';
  CullMode2[(CullMode2['BACK'] = 2)] = 'BACK';
  CullMode2[(CullMode2['FRONT_AND_BACK'] = 3)] = 'FRONT_AND_BACK';
})(CullMode || (CullMode = {}));
var BlendFactor;
(function (BlendFactor2) {
  BlendFactor2[(BlendFactor2['ZERO'] = 0)] = 'ZERO';
  BlendFactor2[(BlendFactor2['ONE'] = 1)] = 'ONE';
  BlendFactor2[(BlendFactor2['SRC'] = 768)] = 'SRC';
  BlendFactor2[(BlendFactor2['ONE_MINUS_SRC'] = 769)] = 'ONE_MINUS_SRC';
  BlendFactor2[(BlendFactor2['DST'] = 774)] = 'DST';
  BlendFactor2[(BlendFactor2['ONE_MINUS_DST'] = 775)] = 'ONE_MINUS_DST';
  BlendFactor2[(BlendFactor2['SRC_ALPHA'] = 770)] = 'SRC_ALPHA';
  BlendFactor2[(BlendFactor2['ONE_MINUS_SRC_ALPHA'] = 771)] =
    'ONE_MINUS_SRC_ALPHA';
  BlendFactor2[(BlendFactor2['DST_ALPHA'] = 772)] = 'DST_ALPHA';
  BlendFactor2[(BlendFactor2['ONE_MINUS_DST_ALPHA'] = 773)] =
    'ONE_MINUS_DST_ALPHA';
  BlendFactor2[(BlendFactor2['CONST'] = 32769)] = 'CONST';
  BlendFactor2[(BlendFactor2['ONE_MINUS_CONSTANT'] = 32770)] =
    'ONE_MINUS_CONSTANT';
  BlendFactor2[(BlendFactor2['SRC_ALPHA_SATURATE'] = 776)] =
    'SRC_ALPHA_SATURATE';
})(BlendFactor || (BlendFactor = {}));
var BlendMode;
(function (BlendMode2) {
  BlendMode2[(BlendMode2['ADD'] = 32774)] = 'ADD';
  BlendMode2[(BlendMode2['SUBSTRACT'] = 32778)] = 'SUBSTRACT';
  BlendMode2[(BlendMode2['REVERSE_SUBSTRACT'] = 32779)] = 'REVERSE_SUBSTRACT';
  BlendMode2[(BlendMode2['MIN'] = 32775)] = 'MIN';
  BlendMode2[(BlendMode2['MAX'] = 32776)] = 'MAX';
})(BlendMode || (BlendMode = {}));
var AddressMode;
(function (AddressMode2) {
  AddressMode2[(AddressMode2['CLAMP_TO_EDGE'] = 0)] = 'CLAMP_TO_EDGE';
  AddressMode2[(AddressMode2['REPEAT'] = 1)] = 'REPEAT';
  AddressMode2[(AddressMode2['MIRRORED_REPEAT'] = 2)] = 'MIRRORED_REPEAT';
})(AddressMode || (AddressMode = {}));
var FilterMode;
(function (FilterMode2) {
  FilterMode2[(FilterMode2['POINT'] = 0)] = 'POINT';
  FilterMode2[(FilterMode2['BILINEAR'] = 1)] = 'BILINEAR';
})(FilterMode || (FilterMode = {}));
var MipmapFilterMode;
(function (MipmapFilterMode2) {
  MipmapFilterMode2[(MipmapFilterMode2['NO_MIP'] = 0)] = 'NO_MIP';
  MipmapFilterMode2[(MipmapFilterMode2['NEAREST'] = 1)] = 'NEAREST';
  MipmapFilterMode2[(MipmapFilterMode2['LINEAR'] = 2)] = 'LINEAR';
})(MipmapFilterMode || (MipmapFilterMode = {}));
var PrimitiveTopology;
(function (PrimitiveTopology2) {
  PrimitiveTopology2[(PrimitiveTopology2['POINTS'] = 0)] = 'POINTS';
  PrimitiveTopology2[(PrimitiveTopology2['TRIANGLES'] = 1)] = 'TRIANGLES';
  PrimitiveTopology2[(PrimitiveTopology2['TRIANGLE_STRIP'] = 2)] =
    'TRIANGLE_STRIP';
  PrimitiveTopology2[(PrimitiveTopology2['LINES'] = 3)] = 'LINES';
  PrimitiveTopology2[(PrimitiveTopology2['LINE_STRIP'] = 4)] = 'LINE_STRIP';
})(PrimitiveTopology || (PrimitiveTopology = {}));
var BufferUsage;
(function (BufferUsage2) {
  BufferUsage2[(BufferUsage2['MAP_READ'] = 1)] = 'MAP_READ';
  BufferUsage2[(BufferUsage2['MAP_WRITE'] = 2)] = 'MAP_WRITE';
  BufferUsage2[(BufferUsage2['COPY_SRC'] = 4)] = 'COPY_SRC';
  BufferUsage2[(BufferUsage2['COPY_DST'] = 8)] = 'COPY_DST';
  BufferUsage2[(BufferUsage2['INDEX'] = 16)] = 'INDEX';
  BufferUsage2[(BufferUsage2['VERTEX'] = 32)] = 'VERTEX';
  BufferUsage2[(BufferUsage2['UNIFORM'] = 64)] = 'UNIFORM';
  BufferUsage2[(BufferUsage2['STORAGE'] = 128)] = 'STORAGE';
  BufferUsage2[(BufferUsage2['INDIRECT'] = 256)] = 'INDIRECT';
  BufferUsage2[(BufferUsage2['QUERY_RESOLVE'] = 512)] = 'QUERY_RESOLVE';
})(BufferUsage || (BufferUsage = {}));
var BufferFrequencyHint;
(function (BufferFrequencyHint2) {
  BufferFrequencyHint2[(BufferFrequencyHint2['STATIC'] = 1)] = 'STATIC';
  BufferFrequencyHint2[(BufferFrequencyHint2['DYNAMIC'] = 2)] = 'DYNAMIC';
})(BufferFrequencyHint || (BufferFrequencyHint = {}));
var VertexStepMode;
(function (VertexStepMode2) {
  VertexStepMode2[(VertexStepMode2['VERTEX'] = 1)] = 'VERTEX';
  VertexStepMode2[(VertexStepMode2['INSTANCE'] = 2)] = 'INSTANCE';
})(VertexStepMode || (VertexStepMode = {}));
var TextureEvent;
(function (TextureEvent2) {
  TextureEvent2['LOADED'] = 'loaded';
})(TextureEvent || (TextureEvent = {}));
var TextureDimension;
(function (TextureDimension2) {
  TextureDimension2[(TextureDimension2['TEXTURE_2D'] = 0)] = 'TEXTURE_2D';
  TextureDimension2[(TextureDimension2['TEXTURE_2D_ARRAY'] = 1)] =
    'TEXTURE_2D_ARRAY';
  TextureDimension2[(TextureDimension2['TEXTURE_3D'] = 2)] = 'TEXTURE_3D';
  TextureDimension2[(TextureDimension2['TEXTURE_CUBE_MAP'] = 3)] =
    'TEXTURE_CUBE_MAP';
})(TextureDimension || (TextureDimension = {}));
var TextureUsage;
(function (TextureUsage2) {
  TextureUsage2[(TextureUsage2['SAMPLED'] = 1)] = 'SAMPLED';
  TextureUsage2[(TextureUsage2['RENDER_TARGET'] = 2)] = 'RENDER_TARGET';
  TextureUsage2[(TextureUsage2['STORAGE'] = 4)] = 'STORAGE';
})(TextureUsage || (TextureUsage = {}));
var ChannelWriteMask;
(function (ChannelWriteMask2) {
  ChannelWriteMask2[(ChannelWriteMask2['NONE'] = 0)] = 'NONE';
  ChannelWriteMask2[(ChannelWriteMask2['RED'] = 1)] = 'RED';
  ChannelWriteMask2[(ChannelWriteMask2['GREEN'] = 2)] = 'GREEN';
  ChannelWriteMask2[(ChannelWriteMask2['BLUE'] = 4)] = 'BLUE';
  ChannelWriteMask2[(ChannelWriteMask2['ALPHA'] = 8)] = 'ALPHA';
  ChannelWriteMask2[(ChannelWriteMask2['RGB'] = 7)] = 'RGB';
  ChannelWriteMask2[(ChannelWriteMask2['ALL'] = 15)] = 'ALL';
})(ChannelWriteMask || (ChannelWriteMask = {}));
var StencilOp;
(function (StencilOp2) {
  StencilOp2[(StencilOp2['KEEP'] = 7680)] = 'KEEP';
  StencilOp2[(StencilOp2['ZERO'] = 0)] = 'ZERO';
  StencilOp2[(StencilOp2['REPLACE'] = 7681)] = 'REPLACE';
  StencilOp2[(StencilOp2['INVERT'] = 5386)] = 'INVERT';
  StencilOp2[(StencilOp2['INCREMENT_CLAMP'] = 7682)] = 'INCREMENT_CLAMP';
  StencilOp2[(StencilOp2['DECREMENT_CLAMP'] = 7683)] = 'DECREMENT_CLAMP';
  StencilOp2[(StencilOp2['INCREMENT_WRAP'] = 34055)] = 'INCREMENT_WRAP';
  StencilOp2[(StencilOp2['DECREMENT_WRAP'] = 34056)] = 'DECREMENT_WRAP';
})(StencilOp || (StencilOp = {}));
function makeTextureDescriptor2D(format, width, height, mipLevelCount) {
  var dimension = TextureDimension.TEXTURE_2D;
  var depthOrArrayLayers = 1;
  var usage = TextureUsage.SAMPLED;
  return {
    dimension,
    format,
    width,
    height,
    depthOrArrayLayers,
    mipLevelCount,
    usage,
  };
}
var SamplerFormatKind;
(function (SamplerFormatKind2) {
  SamplerFormatKind2[(SamplerFormatKind2['Float'] = 0)] = 'Float';
  SamplerFormatKind2[(SamplerFormatKind2['UnfilterableFloat'] = 1)] =
    'UnfilterableFloat';
  SamplerFormatKind2[(SamplerFormatKind2['Uint'] = 2)] = 'Uint';
  SamplerFormatKind2[(SamplerFormatKind2['Sint'] = 3)] = 'Sint';
  SamplerFormatKind2[(SamplerFormatKind2['Depth'] = 4)] = 'Depth';
})(SamplerFormatKind || (SamplerFormatKind = {}));
var ViewportOrigin;
(function (ViewportOrigin2) {
  ViewportOrigin2[(ViewportOrigin2['LOWER_LEFT'] = 0)] = 'LOWER_LEFT';
  ViewportOrigin2[(ViewportOrigin2['UPPER_LEFT'] = 1)] = 'UPPER_LEFT';
})(ViewportOrigin || (ViewportOrigin = {}));
var ClipSpaceNearZ;
(function (ClipSpaceNearZ2) {
  ClipSpaceNearZ2[(ClipSpaceNearZ2['NEGATIVE_ONE'] = 0)] = 'NEGATIVE_ONE';
  ClipSpaceNearZ2[(ClipSpaceNearZ2['ZERO'] = 1)] = 'ZERO';
})(ClipSpaceNearZ || (ClipSpaceNearZ = {}));
var QueryPoolType;
(function (QueryPoolType2) {
  QueryPoolType2[(QueryPoolType2['OcclusionConservative'] = 0)] =
    'OcclusionConservative';
})(QueryPoolType || (QueryPoolType = {}));
var FormatTypeFlags;
(function (FormatTypeFlags2) {
  FormatTypeFlags2[(FormatTypeFlags2['U8'] = 1)] = 'U8';
  FormatTypeFlags2[(FormatTypeFlags2['U16'] = 2)] = 'U16';
  FormatTypeFlags2[(FormatTypeFlags2['U32'] = 3)] = 'U32';
  FormatTypeFlags2[(FormatTypeFlags2['S8'] = 4)] = 'S8';
  FormatTypeFlags2[(FormatTypeFlags2['S16'] = 5)] = 'S16';
  FormatTypeFlags2[(FormatTypeFlags2['S32'] = 6)] = 'S32';
  FormatTypeFlags2[(FormatTypeFlags2['F16'] = 7)] = 'F16';
  FormatTypeFlags2[(FormatTypeFlags2['F32'] = 8)] = 'F32';
  FormatTypeFlags2[(FormatTypeFlags2['BC1'] = 65)] = 'BC1';
  FormatTypeFlags2[(FormatTypeFlags2['BC2'] = 66)] = 'BC2';
  FormatTypeFlags2[(FormatTypeFlags2['BC3'] = 67)] = 'BC3';
  FormatTypeFlags2[(FormatTypeFlags2['BC4_UNORM'] = 68)] = 'BC4_UNORM';
  FormatTypeFlags2[(FormatTypeFlags2['BC4_SNORM'] = 69)] = 'BC4_SNORM';
  FormatTypeFlags2[(FormatTypeFlags2['BC5_UNORM'] = 70)] = 'BC5_UNORM';
  FormatTypeFlags2[(FormatTypeFlags2['BC5_SNORM'] = 71)] = 'BC5_SNORM';
  FormatTypeFlags2[(FormatTypeFlags2['U16_PACKED_5551'] = 97)] =
    'U16_PACKED_5551';
  FormatTypeFlags2[(FormatTypeFlags2['U16_PACKED_565'] = 98)] =
    'U16_PACKED_565';
  FormatTypeFlags2[(FormatTypeFlags2['D24'] = 129)] = 'D24';
  FormatTypeFlags2[(FormatTypeFlags2['D32F'] = 130)] = 'D32F';
  FormatTypeFlags2[(FormatTypeFlags2['D24S8'] = 131)] = 'D24S8';
  FormatTypeFlags2[(FormatTypeFlags2['D32FS8'] = 132)] = 'D32FS8';
})(FormatTypeFlags || (FormatTypeFlags = {}));
var FormatCompFlags;
(function (FormatCompFlags2) {
  FormatCompFlags2[(FormatCompFlags2['R'] = 1)] = 'R';
  FormatCompFlags2[(FormatCompFlags2['RG'] = 2)] = 'RG';
  FormatCompFlags2[(FormatCompFlags2['RGB'] = 3)] = 'RGB';
  FormatCompFlags2[(FormatCompFlags2['RGBA'] = 4)] = 'RGBA';
  FormatCompFlags2[(FormatCompFlags2['A'] = 5)] = 'A';
})(FormatCompFlags || (FormatCompFlags = {}));
function getFormatCompFlagsComponentCount(n) {
  return n;
}
var FormatFlags;
(function (FormatFlags2) {
  FormatFlags2[(FormatFlags2['None'] = 0)] = 'None';
  FormatFlags2[(FormatFlags2['Normalized'] = 1)] = 'Normalized';
  FormatFlags2[(FormatFlags2['sRGB'] = 2)] = 'sRGB';
  FormatFlags2[(FormatFlags2['Depth'] = 4)] = 'Depth';
  FormatFlags2[(FormatFlags2['Stencil'] = 8)] = 'Stencil';
  FormatFlags2[(FormatFlags2['RenderTarget'] = 16)] = 'RenderTarget';
  FormatFlags2[(FormatFlags2['Luminance'] = 32)] = 'Luminance';
})(FormatFlags || (FormatFlags = {}));
function makeFormat(type, comp, flags) {
  return (type << 16) | (comp << 8) | flags;
}
var Format;
(function (Format2) {
  Format2[
    (Format2['ALPHA'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.A,
      FormatFlags.None,
    ))
  ] = 'ALPHA';
  Format2[
    (Format2['U8_LUMINANCE'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.A,
      FormatFlags.Luminance,
    ))
  ] = 'U8_LUMINANCE';
  Format2[
    (Format2['F16_LUMINANCE'] = makeFormat(
      FormatTypeFlags.F16,
      FormatCompFlags.A,
      FormatFlags.Luminance,
    ))
  ] = 'F16_LUMINANCE';
  Format2[
    (Format2['F32_LUMINANCE'] = makeFormat(
      FormatTypeFlags.F32,
      FormatCompFlags.A,
      FormatFlags.Luminance,
    ))
  ] = 'F32_LUMINANCE';
  Format2[
    (Format2['F16_R'] = makeFormat(
      FormatTypeFlags.F16,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'F16_R';
  Format2[
    (Format2['F16_RG'] = makeFormat(
      FormatTypeFlags.F16,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'F16_RG';
  Format2[
    (Format2['F16_RGB'] = makeFormat(
      FormatTypeFlags.F16,
      FormatCompFlags.RGB,
      FormatFlags.None,
    ))
  ] = 'F16_RGB';
  Format2[
    (Format2['F16_RGBA'] = makeFormat(
      FormatTypeFlags.F16,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'F16_RGBA';
  Format2[
    (Format2['F32_R'] = makeFormat(
      FormatTypeFlags.F32,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'F32_R';
  Format2[
    (Format2['F32_RG'] = makeFormat(
      FormatTypeFlags.F32,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'F32_RG';
  Format2[
    (Format2['F32_RGB'] = makeFormat(
      FormatTypeFlags.F32,
      FormatCompFlags.RGB,
      FormatFlags.None,
    ))
  ] = 'F32_RGB';
  Format2[
    (Format2['F32_RGBA'] = makeFormat(
      FormatTypeFlags.F32,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'F32_RGBA';
  Format2[
    (Format2['U8_R'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'U8_R';
  Format2[
    (Format2['U8_R_NORM'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.R,
      FormatFlags.Normalized,
    ))
  ] = 'U8_R_NORM';
  Format2[
    (Format2['U8_RG'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'U8_RG';
  Format2[
    (Format2['U8_RG_NORM'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RG,
      FormatFlags.Normalized,
    ))
  ] = 'U8_RG_NORM';
  Format2[
    (Format2['U8_RGB'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGB,
      FormatFlags.None,
    ))
  ] = 'U8_RGB';
  Format2[
    (Format2['U8_RGB_NORM'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGB,
      FormatFlags.Normalized,
    ))
  ] = 'U8_RGB_NORM';
  Format2[
    (Format2['U8_RGB_SRGB'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGB,
      FormatFlags.sRGB | FormatFlags.Normalized,
    ))
  ] = 'U8_RGB_SRGB';
  Format2[
    (Format2['U8_RGBA'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'U8_RGBA';
  Format2[
    (Format2['U8_RGBA_NORM'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'U8_RGBA_NORM';
  Format2[
    (Format2['U8_RGBA_SRGB'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGBA,
      FormatFlags.sRGB | FormatFlags.Normalized,
    ))
  ] = 'U8_RGBA_SRGB';
  Format2[
    (Format2['U16_R'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'U16_R';
  Format2[
    (Format2['U16_R_NORM'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.R,
      FormatFlags.Normalized,
    ))
  ] = 'U16_R_NORM';
  Format2[
    (Format2['U16_RG_NORM'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.RG,
      FormatFlags.Normalized,
    ))
  ] = 'U16_RG_NORM';
  Format2[
    (Format2['U16_RGBA_NORM'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'U16_RGBA_NORM';
  Format2[
    (Format2['U16_RGBA'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'U16_RGBA';
  Format2[
    (Format2['U16_RGB'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.RGB,
      FormatFlags.None,
    ))
  ] = 'U16_RGB';
  Format2[
    (Format2['U16_RG'] = makeFormat(
      FormatTypeFlags.U16,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'U16_RG';
  Format2[
    (Format2['U32_R'] = makeFormat(
      FormatTypeFlags.U32,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'U32_R';
  Format2[
    (Format2['U32_RG'] = makeFormat(
      FormatTypeFlags.U32,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'U32_RG';
  Format2[
    (Format2['U32_RGB'] = makeFormat(
      FormatTypeFlags.U32,
      FormatCompFlags.RGB,
      FormatFlags.None,
    ))
  ] = 'U32_RGB';
  Format2[
    (Format2['U32_RGBA'] = makeFormat(
      FormatTypeFlags.U32,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'U32_RGBA';
  Format2[
    (Format2['S8_R'] = makeFormat(
      FormatTypeFlags.S8,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'S8_R';
  Format2[
    (Format2['S8_R_NORM'] = makeFormat(
      FormatTypeFlags.S8,
      FormatCompFlags.R,
      FormatFlags.Normalized,
    ))
  ] = 'S8_R_NORM';
  Format2[
    (Format2['S8_RG_NORM'] = makeFormat(
      FormatTypeFlags.S8,
      FormatCompFlags.RG,
      FormatFlags.Normalized,
    ))
  ] = 'S8_RG_NORM';
  Format2[
    (Format2['S8_RGB_NORM'] = makeFormat(
      FormatTypeFlags.S8,
      FormatCompFlags.RGB,
      FormatFlags.Normalized,
    ))
  ] = 'S8_RGB_NORM';
  Format2[
    (Format2['S8_RGBA_NORM'] = makeFormat(
      FormatTypeFlags.S8,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'S8_RGBA_NORM';
  Format2[
    (Format2['S16_R'] = makeFormat(
      FormatTypeFlags.S16,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'S16_R';
  Format2[
    (Format2['S16_RG'] = makeFormat(
      FormatTypeFlags.S16,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'S16_RG';
  Format2[
    (Format2['S16_RG_NORM'] = makeFormat(
      FormatTypeFlags.S16,
      FormatCompFlags.RG,
      FormatFlags.Normalized,
    ))
  ] = 'S16_RG_NORM';
  Format2[
    (Format2['S16_RGB_NORM'] = makeFormat(
      FormatTypeFlags.S16,
      FormatCompFlags.RGB,
      FormatFlags.Normalized,
    ))
  ] = 'S16_RGB_NORM';
  Format2[
    (Format2['S16_RGBA'] = makeFormat(
      FormatTypeFlags.S16,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'S16_RGBA';
  Format2[
    (Format2['S16_RGBA_NORM'] = makeFormat(
      FormatTypeFlags.S16,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'S16_RGBA_NORM';
  Format2[
    (Format2['S32_R'] = makeFormat(
      FormatTypeFlags.S32,
      FormatCompFlags.R,
      FormatFlags.None,
    ))
  ] = 'S32_R';
  Format2[
    (Format2['S32_RG'] = makeFormat(
      FormatTypeFlags.S32,
      FormatCompFlags.RG,
      FormatFlags.None,
    ))
  ] = 'S32_RG';
  Format2[
    (Format2['S32_RGB'] = makeFormat(
      FormatTypeFlags.S32,
      FormatCompFlags.RGB,
      FormatFlags.None,
    ))
  ] = 'S32_RGB';
  Format2[
    (Format2['S32_RGBA'] = makeFormat(
      FormatTypeFlags.S32,
      FormatCompFlags.RGBA,
      FormatFlags.None,
    ))
  ] = 'S32_RGBA';
  Format2[
    (Format2['U16_RGBA_5551'] = makeFormat(
      FormatTypeFlags.U16_PACKED_5551,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'U16_RGBA_5551';
  Format2[
    (Format2['U16_RGB_565'] = makeFormat(
      FormatTypeFlags.U16_PACKED_565,
      FormatCompFlags.RGB,
      FormatFlags.Normalized,
    ))
  ] = 'U16_RGB_565';
  Format2[
    (Format2['BC1'] = makeFormat(
      FormatTypeFlags.BC1,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'BC1';
  Format2[
    (Format2['BC1_SRGB'] = makeFormat(
      FormatTypeFlags.BC1,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized | FormatFlags.sRGB,
    ))
  ] = 'BC1_SRGB';
  Format2[
    (Format2['BC2'] = makeFormat(
      FormatTypeFlags.BC2,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'BC2';
  Format2[
    (Format2['BC2_SRGB'] = makeFormat(
      FormatTypeFlags.BC2,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized | FormatFlags.sRGB,
    ))
  ] = 'BC2_SRGB';
  Format2[
    (Format2['BC3'] = makeFormat(
      FormatTypeFlags.BC3,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized,
    ))
  ] = 'BC3';
  Format2[
    (Format2['BC3_SRGB'] = makeFormat(
      FormatTypeFlags.BC3,
      FormatCompFlags.RGBA,
      FormatFlags.Normalized | FormatFlags.sRGB,
    ))
  ] = 'BC3_SRGB';
  Format2[
    (Format2['BC4_UNORM'] = makeFormat(
      FormatTypeFlags.BC4_UNORM,
      FormatCompFlags.R,
      FormatFlags.Normalized,
    ))
  ] = 'BC4_UNORM';
  Format2[
    (Format2['BC4_SNORM'] = makeFormat(
      FormatTypeFlags.BC4_SNORM,
      FormatCompFlags.R,
      FormatFlags.Normalized,
    ))
  ] = 'BC4_SNORM';
  Format2[
    (Format2['BC5_UNORM'] = makeFormat(
      FormatTypeFlags.BC5_UNORM,
      FormatCompFlags.RG,
      FormatFlags.Normalized,
    ))
  ] = 'BC5_UNORM';
  Format2[
    (Format2['BC5_SNORM'] = makeFormat(
      FormatTypeFlags.BC5_SNORM,
      FormatCompFlags.RG,
      FormatFlags.Normalized,
    ))
  ] = 'BC5_SNORM';
  Format2[
    (Format2['D24'] = makeFormat(
      FormatTypeFlags.D24,
      FormatCompFlags.R,
      FormatFlags.Depth,
    ))
  ] = 'D24';
  Format2[
    (Format2['D24_S8'] = makeFormat(
      FormatTypeFlags.D24S8,
      FormatCompFlags.RG,
      FormatFlags.Depth | FormatFlags.Stencil,
    ))
  ] = 'D24_S8';
  Format2[
    (Format2['D32F'] = makeFormat(
      FormatTypeFlags.D32F,
      FormatCompFlags.R,
      FormatFlags.Depth,
    ))
  ] = 'D32F';
  Format2[
    (Format2['D32F_S8'] = makeFormat(
      FormatTypeFlags.D32FS8,
      FormatCompFlags.RG,
      FormatFlags.Depth | FormatFlags.Stencil,
    ))
  ] = 'D32F_S8';
  Format2[
    (Format2['U8_RGB_RT'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGB,
      FormatFlags.RenderTarget | FormatFlags.Normalized,
    ))
  ] = 'U8_RGB_RT';
  Format2[
    (Format2['U8_RGBA_RT'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGBA,
      FormatFlags.RenderTarget | FormatFlags.Normalized,
    ))
  ] = 'U8_RGBA_RT';
  Format2[
    (Format2['U8_RGBA_RT_SRGB'] = makeFormat(
      FormatTypeFlags.U8,
      FormatCompFlags.RGBA,
      FormatFlags.RenderTarget | FormatFlags.Normalized | FormatFlags.sRGB,
    ))
  ] = 'U8_RGBA_RT_SRGB';
})(Format || (Format = {}));
function getFormatCompFlags(fmt) {
  return (fmt >>> 8) & 255;
}
function getFormatTypeFlags(fmt) {
  return (fmt >>> 16) & 255;
}
function getFormatFlags(fmt) {
  return fmt & 255;
}
function getFormatTypeFlagsByteSize(typeFlags) {
  switch (typeFlags) {
    case FormatTypeFlags.F32:
    case FormatTypeFlags.U32:
    case FormatTypeFlags.S32:
      return 4;
    case FormatTypeFlags.U16:
    case FormatTypeFlags.S16:
    case FormatTypeFlags.F16:
      return 2;
    case FormatTypeFlags.U8:
    case FormatTypeFlags.S8:
      return 1;
    default:
      throw new Error('whoops');
  }
}
function getFormatCompByteSize(fmt) {
  return getFormatTypeFlagsByteSize(getFormatTypeFlags(fmt));
}
function getFormatComponentCount(fmt) {
  return getFormatCompFlagsComponentCount(getFormatCompFlags(fmt));
}
function getFormatByteSize(fmt) {
  var typeByteSize = getFormatTypeFlagsByteSize(getFormatTypeFlags(fmt));
  var componentCount = getFormatCompFlagsComponentCount(
    getFormatCompFlags(fmt),
  );
  return typeByteSize * componentCount;
}
function setFormatFlags(fmt, flags) {
  return (fmt & 4294967040) | flags;
}
function setFormatComponentCount(fmt, compFlags) {
  return (fmt & 4294902015) | (compFlags << 8);
}
function getFormatSamplerKind(fmt) {
  var flags = getFormatFlags(fmt);
  if (flags & FormatFlags.Depth) {
    return SamplerFormatKind.Depth;
  }
  if (flags & FormatFlags.Normalized) {
    return SamplerFormatKind.Float;
  }
  var typeFlags = getFormatTypeFlags(fmt);
  if (typeFlags === FormatTypeFlags.F16 || typeFlags === FormatTypeFlags.F32) {
    return SamplerFormatKind.Float;
  } else if (
    typeFlags === FormatTypeFlags.U8 ||
    typeFlags === FormatTypeFlags.U16 ||
    typeFlags === FormatTypeFlags.U32
  ) {
    return SamplerFormatKind.Uint;
  } else if (
    typeFlags === FormatTypeFlags.S8 ||
    typeFlags === FormatTypeFlags.S16 ||
    typeFlags === FormatTypeFlags.S32
  ) {
    return SamplerFormatKind.Sint;
  } else {
    throw new Error('whoops');
  }
}
function assert(b, message) {
  if (message === void 0) {
    message = '';
  }
  if (!b) {
    throw new Error('Assert fail: '.concat(message));
  }
}
function assertExists(v) {
  if (v !== void 0 && v !== null) return v;
  else throw new Error('Missing object');
}
function colorEqual(c0, c1) {
  return c0.r === c1.r && c0.g === c1.g && c0.b === c1.b && c0.a === c1.a;
}
function colorCopy(dst, src) {
  dst.r = src.r;
  dst.g = src.g;
  dst.b = src.b;
  dst.a = src.a;
}
function colorNewCopy(src) {
  var r = src.r,
    g = src.g,
    b = src.b,
    a = src.a;
  return { r, g, b, a };
}
function colorNewFromRGBA(r, g, b, a) {
  if (a === void 0) {
    a = 1;
  }
  return { r, g, b, a };
}
var TransparentBlack = colorNewFromRGBA(0, 0, 0, 0);
var OpaqueBlack = colorNewFromRGBA(0, 0, 0, 1);
var TransparentWhite = colorNewFromRGBA(1, 1, 1, 0);
var OpaqueWhite = colorNewFromRGBA(1, 1, 1, 1);
var IsDepthReversed = true;
function reverseDepthForPerspectiveu_ProjectionMatrix(m, isDepthReversed) {
  if (isDepthReversed === void 0) {
    isDepthReversed = IsDepthReversed;
  }
  if (isDepthReversed) {
    m[10] = -m[10];
    m[14] = -m[14];
  }
}
function reverseDepthForOrthographicu_ProjectionMatrix(m, isDepthReversed) {
  if (isDepthReversed === void 0) {
    isDepthReversed = IsDepthReversed;
  }
  if (isDepthReversed) {
    m[10] = -m[10];
    m[14] = -m[14] + 1;
  }
}
function reverseDepthForCompareFunction(compareFunction, isDepthReversed) {
  if (isDepthReversed === void 0) {
    isDepthReversed = IsDepthReversed;
  }
  if (isDepthReversed) {
    switch (compareFunction) {
      case CompareFunction.LESS:
        return CompareFunction.GREATER;
      case CompareFunction.LEQUAL:
        return CompareFunction.GEQUAL;
      case CompareFunction.GEQUAL:
        return CompareFunction.LEQUAL;
      case CompareFunction.GREATER:
        return CompareFunction.LESS;
      default:
        return compareFunction;
    }
  } else {
    return compareFunction;
  }
}
function reverseDepthForClearValue(n, isDepthReversed) {
  if (isDepthReversed === void 0) {
    isDepthReversed = IsDepthReversed;
  }
  if (isDepthReversed) {
    return 1 - n;
  } else {
    return n;
  }
}
function reverseDepthForDepthOffset(n, isDepthReversed) {
  if (isDepthReversed === void 0) {
    isDepthReversed = IsDepthReversed;
  }
  if (isDepthReversed) {
    return -n;
  } else {
    return n;
  }
}
function compareDepthValues(a, b, op, isDepthReversed) {
  if (isDepthReversed === void 0) {
    isDepthReversed = IsDepthReversed;
  }
  op = reverseDepthForCompareFunction(op, isDepthReversed);
  if (op === CompareFunction.LESS) return a < b;
  else if (op === CompareFunction.LEQUAL) return a <= b;
  else if (op === CompareFunction.GREATER) return a > b;
  else if (op === CompareFunction.GEQUAL) return a >= b;
  else throw new Error('whoops');
}
function isPowerOfTwo(n) {
  return !!(n && (n & (n - 1)) === 0);
}
function fallbackUndefined(v, fallback) {
  return v !== null && v !== void 0 ? v : fallback;
}
function nullify(v) {
  return v === void 0 ? null : v;
}
function fillArray(L, n, v) {
  L.length = n;
  L.fill(v);
}
function align(n, multiple) {
  var mask = multiple - 1;
  return (n + mask) & ~mask;
}
function alignNonPowerOfTwo(n, multiple) {
  return (((n + multiple - 1) / multiple) | 0) * multiple;
}
function bisectRight(L, e, compare) {
  var lo = 0,
    hi = L.length;
  while (lo < hi) {
    var mid = lo + ((hi - lo) >>> 1);
    var cmp = compare(e, L[mid]);
    if (cmp < 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
function spliceBisectRight(L, e, compare) {
  var idx = bisectRight(L, e, compare);
  L.splice(idx, 0, e);
}
function setBitFlagEnabled(v, mask, enabled) {
  if (enabled) v |= mask;
  else v &= ~mask;
  return v;
}
function nArray(n, c) {
  var d = new Array(n);
  for (var i = 0; i < n; i++) d[i] = c();
  return d;
}
function prependLineNo(str, lineStart) {
  if (lineStart === void 0) {
    lineStart = 1;
  }
  var lines = str.split('\n');
  return lines
    .map(function (s, i) {
      return ''.concat(leftPad('' + (lineStart + i), 4, ' '), '  ').concat(s);
    })
    .join('\n');
}
function leftPad(S, spaces, ch) {
  if (ch === void 0) {
    ch = '0';
  }
  while (S.length < spaces) S = ''.concat(ch).concat(S);
  return S;
}
function range(start, count) {
  var L = [];
  for (var i = start; i < start + count; i++) L.push(i);
  return L;
}
function copyChannelBlendState(dst, src) {
  dst.blendDstFactor = src.blendDstFactor;
  dst.blendSrcFactor = src.blendSrcFactor;
  dst.blendMode = src.blendMode;
}
function copyStencilFaceState(dst, src) {
  if (dst === void 0) {
    dst = {};
  }
  dst.compare = src.compare;
  dst.depthFailOp = src.depthFailOp;
  dst.passOp = src.passOp;
  dst.failOp = src.failOp;
  dst.mask = src.mask;
  return dst;
}
function copyAttachmentState(dst, src) {
  if (dst === void 0) {
    dst = {
      rgbBlendState: {},
      alphaBlendState: {},
      channelWriteMask: 0,
    };
  }
  copyChannelBlendState(dst.rgbBlendState, src.rgbBlendState);
  copyChannelBlendState(dst.alphaBlendState, src.alphaBlendState);
  dst.channelWriteMask = src.channelWriteMask;
  return dst;
}
function copyAttachmentsState(dst, src) {
  if (dst.length !== src.length) dst.length = src.length;
  for (var i = 0; i < src.length; i++)
    dst[i] = copyAttachmentState(dst[i], src[i]);
}
function setMegaStateFlags(dst, src) {
  if (src.attachmentsState !== void 0) {
    copyAttachmentsState(dst.attachmentsState, src.attachmentsState);
  }
  if (dst.blendConstant && src.blendConstant) {
    colorCopy(dst.blendConstant, src.blendConstant);
  }
  dst.depthCompare = fallbackUndefined(src.depthCompare, dst.depthCompare);
  dst.depthWrite = fallbackUndefined(src.depthWrite, dst.depthWrite);
  dst.stencilWrite = fallbackUndefined(src.stencilWrite, dst.stencilWrite);
  if (dst.stencilFront && src.stencilFront) {
    copyStencilFaceState(dst.stencilFront, src.stencilFront);
  }
  if (dst.stencilBack && src.stencilBack) {
    copyStencilFaceState(dst.stencilBack, src.stencilBack);
  }
  dst.cullMode = fallbackUndefined(src.cullMode, dst.cullMode);
  dst.frontFace = fallbackUndefined(src.frontFace, dst.frontFace);
  dst.polygonOffset = fallbackUndefined(src.polygonOffset, dst.polygonOffset);
}
function copyMegaState(src) {
  var dst = Object.assign({}, src);
  dst.attachmentsState = [];
  copyAttachmentsState(dst.attachmentsState, src.attachmentsState);
  dst.blendConstant = dst.blendConstant && colorNewCopy(dst.blendConstant);
  dst.stencilFront = copyStencilFaceState(void 0, src.stencilFront);
  dst.stencilBack = copyStencilFaceState(void 0, src.stencilBack);
  return dst;
}
function copyAttachmentStateFromSimple(dst, src) {
  if (src.channelWriteMask !== void 0) {
    dst.channelWriteMask = src.channelWriteMask;
  }
  if (src.rgbBlendMode !== void 0) {
    dst.rgbBlendState.blendMode = src.rgbBlendMode;
  }
  if (src.alphaBlendMode !== void 0) {
    dst.alphaBlendState.blendMode = src.alphaBlendMode;
  }
  if (src.rgbBlendSrcFactor !== void 0) {
    dst.rgbBlendState.blendSrcFactor = src.rgbBlendSrcFactor;
  }
  if (src.alphaBlendSrcFactor !== void 0) {
    dst.alphaBlendState.blendSrcFactor = src.alphaBlendSrcFactor;
  }
  if (src.rgbBlendDstFactor !== void 0) {
    dst.rgbBlendState.blendDstFactor = src.rgbBlendDstFactor;
  }
  if (src.alphaBlendDstFactor !== void 0) {
    dst.alphaBlendState.blendDstFactor = src.alphaBlendDstFactor;
  }
}
var defaultBlendState = {
  blendMode: BlendMode.ADD,
  blendSrcFactor: BlendFactor.ONE,
  blendDstFactor: BlendFactor.ZERO,
};
var defaultMegaState = {
  attachmentsState: [
    {
      channelWriteMask: ChannelWriteMask.ALL,
      rgbBlendState: defaultBlendState,
      alphaBlendState: defaultBlendState,
    },
  ],
  blendConstant: colorNewCopy(TransparentBlack),
  depthWrite: true,
  depthCompare: CompareFunction.LEQUAL,
  stencilWrite: false,
  stencilFront: {
    compare: CompareFunction.ALWAYS,
    passOp: StencilOp.KEEP,
    depthFailOp: StencilOp.KEEP,
    failOp: StencilOp.KEEP,
  },
  stencilBack: {
    compare: CompareFunction.ALWAYS,
    passOp: StencilOp.KEEP,
    depthFailOp: StencilOp.KEEP,
    failOp: StencilOp.KEEP,
  },
  cullMode: CullMode.NONE,
  frontFace: FrontFace.CCW,
  polygonOffset: false,
};
function makeMegaState(other, src) {
  if (other === void 0) {
    other = null;
  }
  if (src === void 0) {
    src = defaultMegaState;
  }
  var dst = copyMegaState(src);
  if (other !== null) setMegaStateFlags(dst, other);
  return dst;
}
var fullscreenMegaState = makeMegaState(
  { depthCompare: CompareFunction.ALWAYS, depthWrite: false },
  defaultMegaState,
);
function setAttachmentStateSimple(dst, simple) {
  if (dst.attachmentsState === void 0) {
    dst.attachmentsState = [];
    copyAttachmentsState(
      dst.attachmentsState,
      defaultMegaState.attachmentsState,
    );
  }
  copyAttachmentStateFromSimple(dst.attachmentsState[0], simple);
  return dst;
}
var defaultBindingLayoutSamplerDescriptor = {
  texture: null,
  sampler: null,
  formatKind: SamplerFormatKind.Float,
  dimension: TextureDimension.TEXTURE_2D,
};
function arrayEqual(a, b, e) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (!e(a[i], b[i])) return false;
  return true;
}
function arrayCopy(a, copyFunc) {
  var b = Array(a.length);
  for (var i = 0; i < a.length; i++) b[i] = copyFunc(a[i]);
  return b;
}
function textureBindingEquals(a, b) {
  return a.texture === b.texture && a.binding === b.binding;
}
function bufferBindingEquals(a, b) {
  return (
    a.buffer === b.buffer &&
    a.size === b.size &&
    a.binding === b.binding &&
    a.offset === b.offset
  );
}
function samplerBindingEquals(a, b) {
  if (a === null) return b === null;
  if (b === null) return false;
  return (
    a.sampler === b.sampler &&
    a.texture === b.texture &&
    a.dimension === b.dimension &&
    a.formatKind === b.formatKind &&
    a.comparison === b.comparison
  );
}
function bindingsDescriptorEquals(a, b) {
  a.samplerBindings = a.samplerBindings || [];
  a.uniformBufferBindings = a.uniformBufferBindings || [];
  a.storageBufferBindings = a.storageBufferBindings || [];
  a.storageTextureBindings = a.storageTextureBindings || [];
  b.samplerBindings = b.samplerBindings || [];
  b.uniformBufferBindings = b.uniformBufferBindings || [];
  b.storageBufferBindings = b.storageBufferBindings || [];
  b.storageTextureBindings = b.storageTextureBindings || [];
  if (a.samplerBindings.length !== b.samplerBindings.length) return false;
  if (!arrayEqual(a.samplerBindings, b.samplerBindings, samplerBindingEquals))
    return false;
  if (
    !arrayEqual(
      a.uniformBufferBindings,
      b.uniformBufferBindings,
      bufferBindingEquals,
    )
  )
    return false;
  if (
    !arrayEqual(
      a.storageBufferBindings,
      b.storageBufferBindings,
      bufferBindingEquals,
    )
  )
    return false;
  if (
    !arrayEqual(
      a.storageTextureBindings,
      b.storageTextureBindings,
      textureBindingEquals,
    )
  )
    return false;
  return true;
}
function channelBlendStateEquals(a, b) {
  return (
    a.blendMode == b.blendMode &&
    a.blendSrcFactor === b.blendSrcFactor &&
    a.blendDstFactor === b.blendDstFactor
  );
}
function attachmentStateEquals(a, b) {
  if (!channelBlendStateEquals(a.rgbBlendState, b.rgbBlendState)) return false;
  if (!channelBlendStateEquals(a.alphaBlendState, b.alphaBlendState))
    return false;
  if (a.channelWriteMask !== b.channelWriteMask) return false;
  return true;
}
function stencilFaceStateEquals(a, b) {
  return (
    a.compare == b.compare &&
    a.depthFailOp === b.depthFailOp &&
    a.failOp === b.failOp &&
    a.passOp === b.passOp &&
    a.mask === b.mask
  );
}
function megaStateDescriptorEquals(a, b) {
  if (
    !arrayEqual(a.attachmentsState, b.attachmentsState, attachmentStateEquals)
  )
    return false;
  if (
    a.blendConstant &&
    b.blendConstant &&
    !colorEqual(a.blendConstant, b.blendConstant)
  )
    return false;
  if (
    a.stencilFront &&
    b.stencilFront &&
    !stencilFaceStateEquals(a.stencilFront, b.stencilFront)
  )
    return false;
  if (
    a.stencilBack &&
    b.stencilBack &&
    !stencilFaceStateEquals(a.stencilBack, b.stencilBack)
  )
    return false;
  return (
    a.depthCompare === b.depthCompare &&
    a.depthWrite === b.depthWrite &&
    a.stencilWrite === b.stencilWrite &&
    a.cullMode === b.cullMode &&
    a.frontFace === b.frontFace &&
    a.polygonOffset === b.polygonOffset
  );
}
function programEquals(a, b) {
  return a.id === b.id;
}
function formatEquals(a, b) {
  return a === b;
}
function renderPipelineDescriptorEquals(a, b) {
  if (a.topology !== b.topology) return false;
  if (a.inputLayout !== b.inputLayout) return false;
  if (a.sampleCount !== b.sampleCount) return false;
  if (
    a.megaStateDescriptor &&
    b.megaStateDescriptor &&
    !megaStateDescriptorEquals(a.megaStateDescriptor, b.megaStateDescriptor)
  )
    return false;
  if (!programEquals(a.program, b.program)) return false;
  if (
    !arrayEqual(
      a.colorAttachmentFormats,
      b.colorAttachmentFormats,
      formatEquals,
    )
  )
    return false;
  if (a.depthStencilAttachmentFormat !== b.depthStencilAttachmentFormat)
    return false;
  return true;
}
function vertexAttributeDescriptorEquals(a, b) {
  return (
    a.offset === b.offset &&
    a.shaderLocation === b.shaderLocation &&
    a.format === b.format &&
    a.divisor === b.divisor
  );
}
function inputLayoutBufferDescriptorEquals(a, b) {
  if (is_nil_default(a)) return is_nil_default(b);
  if (is_nil_default(b)) return false;
  return (
    a.arrayStride === b.arrayStride &&
    a.stepMode === b.stepMode &&
    arrayEqual(a.attributes, b.attributes, vertexAttributeDescriptorEquals)
  );
}
function inputLayoutDescriptorEquals(a, b) {
  if (a.indexBufferFormat !== b.indexBufferFormat) return false;
  if (
    !arrayEqual(
      a.vertexBufferDescriptors,
      b.vertexBufferDescriptors,
      inputLayoutBufferDescriptorEquals,
    )
  )
    return false;
  if (!programEquals(a.program, b.program)) return false;
  return true;
}
function samplerDescriptorEquals(a, b) {
  return (
    a.addressModeU === b.addressModeU &&
    a.addressModeV === b.addressModeV &&
    a.minFilter === b.minFilter &&
    a.magFilter === b.magFilter &&
    a.mipmapFilter === b.mipmapFilter &&
    a.lodMinClamp === b.lodMinClamp &&
    a.lodMaxClamp === b.lodMaxClamp &&
    a.maxAnisotropy === b.maxAnisotropy &&
    a.compareFunction === b.compareFunction
  );
}
function samplerBindingCopy(a) {
  var sampler = a.sampler;
  var texture = a.texture;
  var dimension = a.dimension;
  var formatKind = a.formatKind;
  var comparison = a.comparison;
  return { sampler, texture, dimension, formatKind, comparison };
}
function bufferBindingCopy(a) {
  var buffer = a.buffer;
  var size2 = a.size;
  var binding = a.binding;
  var offset = a.offset;
  return { binding, buffer, offset, size: size2 };
}
function textureBindingCopy(a) {
  var binding = a.binding;
  var texture = a.texture;
  return { binding, texture };
}
function bindingsDescriptorCopy(a) {
  var samplerBindings =
    a.samplerBindings && arrayCopy(a.samplerBindings, samplerBindingCopy);
  var uniformBufferBindings =
    a.uniformBufferBindings &&
    arrayCopy(a.uniformBufferBindings, bufferBindingCopy);
  var storageBufferBindings =
    a.storageBufferBindings &&
    arrayCopy(a.storageBufferBindings, bufferBindingCopy);
  var storageTextureBindings =
    a.storageTextureBindings &&
    arrayCopy(a.storageTextureBindings, textureBindingCopy);
  return {
    samplerBindings,
    uniformBufferBindings,
    storageBufferBindings,
    storageTextureBindings,
    pipeline: a.pipeline,
  };
}
function renderPipelineDescriptorCopy(a) {
  var inputLayout = a.inputLayout;
  var program = a.program;
  var topology = a.topology;
  var megaStateDescriptor =
    a.megaStateDescriptor && copyMegaState(a.megaStateDescriptor);
  var colorAttachmentFormats = a.colorAttachmentFormats.slice();
  var depthStencilAttachmentFormat = a.depthStencilAttachmentFormat;
  var sampleCount = a.sampleCount;
  return {
    inputLayout,
    megaStateDescriptor,
    program,
    topology,
    colorAttachmentFormats,
    depthStencilAttachmentFormat,
    sampleCount,
  };
}
function vertexAttributeDescriptorCopy(a) {
  var shaderLocation = a.shaderLocation;
  var format = a.format;
  var offset = a.offset;
  var divisor = a.divisor;
  return {
    shaderLocation,
    format,
    offset,
    divisor,
  };
}
function inputLayoutBufferDescriptorCopy(a) {
  if (!is_nil_default(a)) {
    var arrayStride = a.arrayStride;
    var stepMode = a.stepMode;
    var attributes = arrayCopy(a.attributes, vertexAttributeDescriptorCopy);
    return { arrayStride, stepMode, attributes };
  } else {
    return a;
  }
}
function inputLayoutDescriptorCopy(a) {
  var vertexBufferDescriptors = arrayCopy(
    a.vertexBufferDescriptors,
    inputLayoutBufferDescriptorCopy,
  );
  var indexBufferFormat = a.indexBufferFormat;
  var program = a.program;
  return {
    vertexBufferDescriptors,
    indexBufferFormat,
    program,
  };
}
var _a;
var UNIFORM_NAME_REGEXP = /([^[]*)(\[[0-9]+\])?/;
function parseUniformName(name) {
  if (name[name.length - 1] !== ']') {
    return {
      name,
      length: 1,
      isArray: false,
    };
  }
  var matches = name.match(UNIFORM_NAME_REGEXP);
  if (!matches || matches.length < 2) {
    throw new Error('Failed to parse GLSL uniform name '.concat(name));
  }
  return {
    name: matches[1],
    length: Number(matches[2]) || 1,
    isArray: Boolean(matches[2]),
  };
}
function getSamplerSetter() {
  var cache = null;
  return function (gl, location, value) {
    var update = cache !== value;
    if (update) {
      gl.uniform1i(location, value);
      cache = value;
    }
    return update;
  };
}
function getArraySetter(functionName, toArray, size2, uniformSetter) {
  var cache = null;
  var cacheLength = null;
  return function (gl, location, value) {
    var arrayValue = toArray(value, size2);
    var length = arrayValue.length;
    var update = false;
    if (cache === null) {
      cache = new Float32Array(length);
      cacheLength = length;
      update = true;
    } else {
      assert(cacheLength === length, 'Uniform length cannot change.');
      for (var i = 0; i < length; ++i) {
        if (arrayValue[i] !== cache[i]) {
          update = true;
          break;
        }
      }
    }
    if (update) {
      uniformSetter(gl, functionName, location, arrayValue);
      cache.set(arrayValue);
    }
    return update;
  };
}
function setVectorUniform(gl, functionName, location, value) {
  gl[functionName](location, value);
}
function setMatrixUniform(gl, functionName, location, value) {
  gl[functionName](location, false, value);
}
var FLOAT_ARRAY = {};
var INT_ARRAY = {};
var UINT_ARRAY = {};
var array1 = [0];
function toTypedArray(value, uniformLength, Type, cache) {
  if (uniformLength === 1 && typeof value === 'boolean') {
    value = value ? 1 : 0;
  }
  if (Number.isFinite(value)) {
    array1[0] = value;
    value = array1;
  }
  var length = value.length;
  if (value instanceof Type) {
    return value;
  }
  var result = cache[length];
  if (!result) {
    result = new Type(length);
    cache[length] = result;
  }
  for (var i = 0; i < length; i++) {
    result[i] = value[i];
  }
  return result;
}
function toFloatArray(value, uniformLength) {
  return toTypedArray(value, uniformLength, Float32Array, FLOAT_ARRAY);
}
function toIntArray(value, uniformLength) {
  return toTypedArray(value, uniformLength, Int32Array, INT_ARRAY);
}
function toUIntArray(value, uniformLength) {
  return toTypedArray(value, uniformLength, Uint32Array, UINT_ARRAY);
}
var UNIFORM_SETTERS =
  ((_a = {}), // WEBGL1
  (_a[GL.FLOAT] = getArraySetter.bind(
    null,
    'uniform1fv',
    toFloatArray,
    1,
    setVectorUniform,
  )),
  (_a[GL.FLOAT_VEC2] = getArraySetter.bind(
    null,
    'uniform2fv',
    toFloatArray,
    2,
    setVectorUniform,
  )),
  (_a[GL.FLOAT_VEC3] = getArraySetter.bind(
    null,
    'uniform3fv',
    toFloatArray,
    3,
    setVectorUniform,
  )),
  (_a[GL.FLOAT_VEC4] = getArraySetter.bind(
    null,
    'uniform4fv',
    toFloatArray,
    4,
    setVectorUniform,
  )),
  (_a[GL.INT] = getArraySetter.bind(
    null,
    'uniform1iv',
    toIntArray,
    1,
    setVectorUniform,
  )),
  (_a[GL.INT_VEC2] = getArraySetter.bind(
    null,
    'uniform2iv',
    toIntArray,
    2,
    setVectorUniform,
  )),
  (_a[GL.INT_VEC3] = getArraySetter.bind(
    null,
    'uniform3iv',
    toIntArray,
    3,
    setVectorUniform,
  )),
  (_a[GL.INT_VEC4] = getArraySetter.bind(
    null,
    'uniform4iv',
    toIntArray,
    4,
    setVectorUniform,
  )),
  (_a[GL.BOOL] = getArraySetter.bind(
    null,
    'uniform1iv',
    toIntArray,
    1,
    setVectorUniform,
  )),
  (_a[GL.BOOL_VEC2] = getArraySetter.bind(
    null,
    'uniform2iv',
    toIntArray,
    2,
    setVectorUniform,
  )),
  (_a[GL.BOOL_VEC3] = getArraySetter.bind(
    null,
    'uniform3iv',
    toIntArray,
    3,
    setVectorUniform,
  )),
  (_a[GL.BOOL_VEC4] = getArraySetter.bind(
    null,
    'uniform4iv',
    toIntArray,
    4,
    setVectorUniform,
  )), // uniformMatrix(false): don't transpose the matrix
  (_a[GL.FLOAT_MAT2] = getArraySetter.bind(
    null,
    'uniformMatrix2fv',
    toFloatArray,
    4,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT3] = getArraySetter.bind(
    null,
    'uniformMatrix3fv',
    toFloatArray,
    9,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT4] = getArraySetter.bind(
    null,
    'uniformMatrix4fv',
    toFloatArray,
    16,
    setMatrixUniform,
  )), // WEBGL2 - unsigned integers, irregular matrices, additional texture samplers
  (_a[GL.UNSIGNED_INT] = getArraySetter.bind(
    null,
    'uniform1uiv',
    toUIntArray,
    1,
    setVectorUniform,
  )),
  (_a[GL.UNSIGNED_INT_VEC2] = getArraySetter.bind(
    null,
    'uniform2uiv',
    toUIntArray,
    2,
    setVectorUniform,
  )),
  (_a[GL.UNSIGNED_INT_VEC3] = getArraySetter.bind(
    null,
    'uniform3uiv',
    toUIntArray,
    3,
    setVectorUniform,
  )),
  (_a[GL.UNSIGNED_INT_VEC4] = getArraySetter.bind(
    null,
    'uniform4uiv',
    toUIntArray,
    4,
    setVectorUniform,
  )), // uniformMatrix(false): don't transpose the matrix
  (_a[GL.FLOAT_MAT2x3] = getArraySetter.bind(
    null,
    'uniformMatrix2x3fv',
    toFloatArray,
    6,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT2x4] = getArraySetter.bind(
    null,
    'uniformMatrix2x4fv',
    toFloatArray,
    8,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT3x2] = getArraySetter.bind(
    null,
    'uniformMatrix3x2fv',
    toFloatArray,
    6,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT3x4] = getArraySetter.bind(
    null,
    'uniformMatrix3x4fv',
    toFloatArray,
    12,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT4x2] = getArraySetter.bind(
    null,
    'uniformMatrix4x2fv',
    toFloatArray,
    8,
    setMatrixUniform,
  )),
  (_a[GL.FLOAT_MAT4x3] = getArraySetter.bind(
    null,
    'uniformMatrix4x3fv',
    toFloatArray,
    12,
    setMatrixUniform,
  )),
  (_a[GL.SAMPLER_2D] = getSamplerSetter),
  (_a[GL.SAMPLER_CUBE] = getSamplerSetter),
  (_a[GL.SAMPLER_3D] = getSamplerSetter),
  (_a[GL.SAMPLER_2D_SHADOW] = getSamplerSetter),
  (_a[GL.SAMPLER_2D_ARRAY] = getSamplerSetter),
  (_a[GL.SAMPLER_2D_ARRAY_SHADOW] = getSamplerSetter),
  (_a[GL.SAMPLER_CUBE_SHADOW] = getSamplerSetter),
  (_a[GL.INT_SAMPLER_2D] = getSamplerSetter),
  (_a[GL.INT_SAMPLER_3D] = getSamplerSetter),
  (_a[GL.INT_SAMPLER_CUBE] = getSamplerSetter),
  (_a[GL.INT_SAMPLER_2D_ARRAY] = getSamplerSetter),
  (_a[GL.UNSIGNED_INT_SAMPLER_2D] = getSamplerSetter),
  (_a[GL.UNSIGNED_INT_SAMPLER_3D] = getSamplerSetter),
  (_a[GL.UNSIGNED_INT_SAMPLER_CUBE] = getSamplerSetter),
  (_a[GL.UNSIGNED_INT_SAMPLER_2D_ARRAY] = getSamplerSetter),
  _a);
function getUniformSetter(gl, location, info) {
  var setter = UNIFORM_SETTERS[info.type];
  if (!setter) {
    throw new Error('Unknown GLSL uniform type '.concat(info.type));
  }
  return setter().bind(null, gl, location);
}
var dtypes = {
  '[object Int8Array]': 5120,
  '[object Int16Array]': 5122,
  '[object Int32Array]': 5124,
  '[object Uint8Array]': 5121,
  '[object Uint8ClampedArray]': 5121,
  '[object Uint16Array]': 5123,
  '[object Uint32Array]': 5125,
  '[object Float32Array]': 5126,
  '[object Float64Array]': 5121,
  '[object ArrayBuffer]': 5121,
};
function isTypedArray(x) {
  return Object.prototype.toString.call(x) in dtypes;
}
function defineStr(k, v) {
  return '#define '.concat(k, ' ').concat(v);
}
function getDefines(shader) {
  var defines = {};
  shader.replace(
    /^\s*#define\s*(\S*)\s*(\S*)\s*$/gm,
    function (_, name, value) {
      var v = Number(value);
      defines[name] = isNaN(v) ? value : v;
      return '';
    },
  );
  return defines;
}
function getAttributeLocations(vert, defines) {
  var locations = [];
  vert.replace(
    /^\s*layout\(location\s*=\s*(\S*)\)\s*in\s+\S+\s*(.*);$/gm,
    function (_, location, name) {
      var l = Number(location);
      locations.push({ location: isNaN(l) ? defines[location] : l, name });
      return '';
    },
  );
  return locations;
}
function getUniforms(vert) {
  var uniformNames = [];
  var structs = [];
  vert.replace(
    /\s*struct\s*(.*)\s*{((?:\s*.*\s*)*?)};/g,
    function (_, type, uniformStr) {
      var uniforms = [];
      uniformStr
        .trim()
        .replace('\r\n', '\n')
        .split('\n')
        .forEach(function (line) {
          var _a2 = __read(line.trim().split(/\s+/), 2),
            type2 = _a2[0],
            name = _a2[1];
          uniforms.push({
            type: type2.trim(),
            name: name.replace(';', '').trim(),
          });
        });
      structs.push({
        type: type.trim(),
        uniforms,
      });
      return '';
    },
  );
  vert.replace(
    /\s*uniform(?:\s+)(?:\w+)(?:\s?){([^]*?)};?/g,
    function (_, uniforms) {
      uniforms
        .trim()
        .replace('\r\n', '\n')
        .split('\n')
        .forEach(function (line) {
          var result = line.trim().split(' ');
          var type = result[0] || '';
          var name = result[1] || '';
          var isArray = name.indexOf('[') > -1;
          name = name.replace(';', '').replace('[', '').trim();
          if (type.startsWith('#')) {
            return;
          }
          if (type) {
            var struct = structs.find(function (struct2) {
              return type === struct2.type;
            });
            if (struct) {
              if (isArray) {
                var _loop_1 = function (i2) {
                  struct.uniforms.forEach(function (uniform) {
                    uniformNames.push(
                      ''
                        .concat(name, '[')
                        .concat(i2, '].')
                        .concat(uniform.name),
                    );
                  });
                };
                for (var i = 0; i < 5; i++) {
                  _loop_1(i);
                }
              } else {
                struct.uniforms.forEach(function (uniform) {
                  uniformNames.push(''.concat(name, '.').concat(uniform.name));
                });
              }
            }
          }
          if (name) {
            uniformNames.push(name);
          }
        });
      return '';
    },
  );
  return uniformNames;
}
function parseBinding(layout) {
  if (layout === void 0) return null;
  var g = /binding\s*=\s*(\d+)/.exec(layout);
  if (g !== null) {
    var bindingNum = parseInt(g[1], 10);
    if (!Number.isNaN(bindingNum)) return bindingNum;
  }
  return null;
}
function getSeparateSamplerTypes(combinedSamplerType) {
  var samplerType = '';
  var textureType = combinedSamplerType;
  return [textureType, samplerType];
}
function preprocessShader_GLSL(
  vendorInfo,
  type,
  source,
  defines,
  usePrecision,
) {
  var _a2;
  if (defines === void 0) {
    defines = null;
  }
  if (usePrecision === void 0) {
    usePrecision = true;
  }
  var isGLSL100 = vendorInfo.glslVersion === '#version 100';
  var useMRT =
    type === 'frag' &&
    ((_a2 = source.match(
      /^\s*layout\(location\s*=\s*\d*\)\s*out\s+vec4\s*(.*);$/gm,
    )) === null || _a2 === void 0
      ? void 0
      : _a2.length) > 1;
  var lines = source
    .replace('\r\n', '\n')
    .split('\n')
    .map(function (n) {
      return n.replace(/[/][/].*$/, '');
    })
    .filter(function (n) {
      var isEmpty = !n || /^\s+$/.test(n);
      return !isEmpty;
    });
  var definesString = '';
  if (defines !== null)
    definesString = Object.keys(defines)
      .map(function (key) {
        return defineStr(key, defines[key]);
      })
      .join('\n');
  var precision =
    lines.find(function (line) {
      return line.startsWith('precision');
    }) || 'precision mediump float;';
  var rest = usePrecision
    ? lines
        .filter(function (line) {
          return !line.startsWith('precision');
        })
        .join('\n')
    : lines.join('\n');
  var extraDefines = '';
  if (vendorInfo.viewportOrigin === ViewportOrigin.UPPER_LEFT) {
    extraDefines += ''.concat(defineStr('VIEWPORT_ORIGIN_TL', '1'), '\n');
  }
  if (vendorInfo.clipSpaceNearZ === ClipSpaceNearZ.ZERO) {
    extraDefines += ''.concat(defineStr('CLIPSPACE_NEAR_ZERO', '1'), '\n');
  }
  if (vendorInfo.explicitBindingLocations) {
    var set_1 = 0,
      implicitBinding_1 = 0,
      location_1 = 0;
    rest = rest.replace(
      /^\s*(layout\((.*)\))?\s*uniform(.+{)$/gm,
      function (substr, cap, layout, rest2) {
        var layout2 = layout ? ''.concat(layout, ', ') : '';
        return 'layout('
          .concat(layout2, 'set = ')
          .concat(set_1, ', binding = ')
          .concat(implicitBinding_1++, ') uniform ')
          .concat(rest2);
      },
    );
    set_1++;
    implicitBinding_1 = 0;
    assert(vendorInfo.separateSamplerTextures);
    rest = rest.replace(
      /^\s*(layout\((.*)\))?\s*uniform sampler(\w+) (.*);/gm,
      function (substr, cap, layout, combinedSamplerType, samplerName) {
        var binding = parseBinding(layout);
        if (binding === null) binding = implicitBinding_1++;
        var _a3 = __read(getSeparateSamplerTypes(combinedSamplerType), 2),
          textureType = _a3[0],
          samplerType = _a3[1];
        return type === 'frag'
          ? '\nlayout(set = '
              .concat(set_1, ', binding = ')
              .concat(binding * 2 + 0, ') uniform texture')
              .concat(textureType, ' T_')
              .concat(samplerName, ';\nlayout(set = ')
              .concat(set_1, ', binding = ')
              .concat(binding * 2 + 1, ') uniform sampler')
              .concat(samplerType, ' S_')
              .concat(samplerName, ';')
              .trim()
          : '';
      },
    );
    rest = rest.replace(
      type === 'frag' ? /^\s*\b(varying|in)\b/gm : /^\s*\b(varying|out)\b/gm,
      function (substr, tok) {
        return 'layout(location = '.concat(location_1++, ') ').concat(tok);
      },
    );
    extraDefines += ''.concat(defineStr('gl_VertexID', 'gl_VertexIndex'), '\n');
    extraDefines += ''.concat(
      defineStr('gl_InstanceID', 'gl_InstanceIndex'),
      '\n',
    );
    precision = precision.replace(/^precision (.*) sampler(.*);$/gm, '');
  } else {
    var implicitBinding_2 = 0;
    rest = rest.replace(
      /^\s*(layout\((.*)\))?\s*uniform sampler(\w+) (.*);/gm,
      function (substr, cap, layout, combinedSamplerType, samplerName) {
        var binding = parseBinding(layout);
        if (binding === null) binding = implicitBinding_2++;
        return 'uniform sampler'
          .concat(combinedSamplerType, ' ')
          .concat(samplerName, '; // BINDING=')
          .concat(binding);
      },
    );
  }
  rest = rest.replace(
    /\bPU_SAMPLER_(\w+)\((.*?)\)/g,
    function (substr, combinedSamplerType, samplerName) {
      return 'SAMPLER_'
        .concat(combinedSamplerType, '(P_')
        .concat(samplerName, ')');
    },
  );
  rest = rest.replace(
    /\bPF_SAMPLER_(\w+)\((.*?)\)/g,
    function (substr, combinedSamplerType, samplerName) {
      return 'PP_SAMPLER_'
        .concat(combinedSamplerType, '(P_')
        .concat(samplerName, ')');
    },
  );
  rest = rest.replace(/\bPU_TEXTURE\((.*?)\)/g, function (substr, samplerName) {
    return 'TEXTURE(P_'.concat(samplerName, ')');
  });
  if (vendorInfo.separateSamplerTextures) {
    rest = rest.replace(
      /\bPD_SAMPLER_(\w+)\((.*?)\)/g,
      function (substr, combinedSamplerType, samplerName) {
        var _a3 = __read(getSeparateSamplerTypes(combinedSamplerType), 2),
          textureType = _a3[0],
          samplerType = _a3[1];
        return 'texture'
          .concat(textureType, ' T_P_')
          .concat(samplerName, ', sampler')
          .concat(samplerType, ' S_P_')
          .concat(samplerName);
      },
    );
    rest = rest.replace(
      /\bPP_SAMPLER_(\w+)\((.*?)\)/g,
      function (substr, combinedSamplerType, samplerName) {
        return 'T_'.concat(samplerName, ', S_').concat(samplerName);
      },
    );
    rest = rest.replace(
      /\bSAMPLER_(\w+)\((.*?)\)/g,
      function (substr, combinedSamplerType, samplerName) {
        return 'sampler'
          .concat(combinedSamplerType, '(T_')
          .concat(samplerName, ', S_')
          .concat(samplerName, ')');
      },
    );
    rest = rest.replace(/\bTEXTURE\((.*?)\)/g, function (substr, samplerName) {
      return 'T_'.concat(samplerName);
    });
  } else {
    var samplerNames_1 = [];
    rest = rest.replace(
      /\bPD_SAMPLER_(\w+)\((.*?)\)/g,
      function (substr, combinedSamplerType, samplerName) {
        return 'sampler'.concat(combinedSamplerType, ' P_').concat(samplerName);
      },
    );
    rest = rest.replace(
      /\bPP_SAMPLER_(\w+)\((.*?)\)/g,
      function (substr, combinedSamplerType, samplerName) {
        return samplerName;
      },
    );
    rest = rest.replace(
      /\bSAMPLER_(\w+)\((.*?)\)/g,
      function (substr, combinedSamplerType, samplerName) {
        samplerNames_1.push([samplerName, combinedSamplerType]);
        return samplerName;
      },
    );
    if (isGLSL100) {
      samplerNames_1.forEach(function (_a3) {
        var _b = __read(_a3, 2),
          samplerName = _b[0],
          combinedSamplerType = _b[1];
        rest = rest.replace(
          new RegExp('texture\\('.concat(samplerName), 'g'),
          function () {
            return 'texture'
              .concat(combinedSamplerType, '(')
              .concat(samplerName);
          },
        );
      });
    }
    rest = rest.replace(/\bTEXTURE\((.*?)\)/g, function (substr, samplerName) {
      return samplerName;
    });
  }
  var concat = ''
    .concat(isGLSL100 ? '' : vendorInfo.glslVersion, '\n')
    .concat(
      isGLSL100 && useMRT ? '#extension GL_EXT_draw_buffers : require\n' : '',
      '\n',
    )
    .concat(
      isGLSL100 && type === 'frag'
        ? '#extension GL_OES_standard_derivatives : enable\n'
        : '',
    )
    .concat(usePrecision ? precision : '', '\n')
    .concat(extraDefines ? extraDefines : '')
    .concat(definesString ? definesString + '\n' : '', '\n')
    .concat(rest, '\n')
    .trim();
  if (vendorInfo.explicitBindingLocations && type === 'frag') {
    concat = concat.replace(/^\b(out)\b/g, function (substr, tok) {
      return 'layout(location = 0) '.concat(tok);
    });
  }
  if (isGLSL100) {
    if (type === 'frag') {
      concat = concat.replace(
        /^\s*in\s+(\S+)\s*(.*);$/gm,
        function (_, dataType, name) {
          return 'varying '.concat(dataType, ' ').concat(name, ';\n');
        },
      );
    }
    if (type === 'vert') {
      concat = concat.replace(
        /^\s*out\s+(\S+)\s*(.*);$/gm,
        function (_, dataType, name) {
          return 'varying '.concat(dataType, ' ').concat(name, ';\n');
        },
      );
      concat = concat.replace(
        // /^\s*layout\(location\s*=\s*\d*\)\s*in\s*(.*)\s*(.*);$/gm,
        /^\s*layout\(location\s*=\s*\S*\)\s*in\s+(\S+)\s*(.*);$/gm,
        function (_, dataType, name) {
          return 'attribute '.concat(dataType, ' ').concat(name, ';\n');
        },
      );
    }
    concat = concat.replace(
      /\s*uniform\s*.*\s*{((?:\s*.*\s*)*?)};/g,
      function (substr, uniforms) {
        return uniforms.trim().replace(/^.*$/gm, function (uniform) {
          var trimmed = uniform.trim();
          if (trimmed.startsWith('#')) {
            return trimmed;
          }
          return uniform ? 'uniform '.concat(trimmed) : '';
        });
      },
    );
    if (type === 'frag') {
      if (useMRT) {
        var gBuffers_1 = [];
        concat = concat.replace(
          /^\s*layout\(location\s*=\s*\d*\)\s*out\s+vec4\s*(.*);$/gm,
          function (_, buffer) {
            gBuffers_1.push(buffer);
            return 'vec4 '.concat(buffer, ';\n');
          },
        );
        var lastIndexOfMain = concat.lastIndexOf('}');
        concat =
          concat.substring(0, lastIndexOfMain) +
          '\n    '.concat(
            gBuffers_1
              .map(function (gBuffer, i) {
                return 'gl_FragData['
                  .concat(i, '] = ')
                  .concat(gBuffer, ';\n    ');
              })
              .join('\n'),
          ) +
          concat.substring(lastIndexOfMain);
      } else {
        var glFragColor_1;
        concat = concat.replace(
          /^\s*out\s+(\S+)\s*(.*);$/gm,
          function (_, dataType, name) {
            glFragColor_1 = name;
            return ''.concat(dataType, ' ').concat(name, ';\n');
          },
        );
        if (glFragColor_1) {
          var lastIndexOfMain = concat.lastIndexOf('}');
          concat =
            concat.substring(0, lastIndexOfMain) +
            '\n  gl_FragColor = vec4('.concat(glFragColor_1, ');\n') +
            concat.substring(lastIndexOfMain);
        }
      }
    }
    concat = concat.replace(/^\s*layout\((.*)\)/gm, '');
  }
  return concat;
}
function preprocessProgram_GLSL(vendorInfo, vert, frag, defines) {
  if (defines === void 0) {
    defines = null;
  }
  var preprocessedVert = preprocessShader_GLSL(
    vendorInfo,
    'vert',
    vert,
    defines,
  );
  var preprocessedFrag = preprocessShader_GLSL(
    vendorInfo,
    'frag',
    frag,
    defines,
  );
  return { vert, frag, preprocessedVert, preprocessedFrag };
}
var ResourceBase_GL =
  /** @class */
  (function (_super) {
    __extends(ResourceBase_GL2, _super);
    function ResourceBase_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device;
      var _this = _super.call(this) || this;
      _this.id = id;
      _this.device = device;
      if (_this.device['resourceCreationTracker'] !== null) {
        _this.device['resourceCreationTracker'].trackResourceCreated(_this);
      }
      return _this;
    }
    ResourceBase_GL2.prototype.destroy = function () {
      if (this.device['resourceCreationTracker'] !== null) {
        this.device['resourceCreationTracker'].trackResourceDestroyed(this);
      }
    };
    return ResourceBase_GL2;
  })(eventemitter3_default);
var Bindings_GL =
  /** @class */
  (function (_super) {
    __extends(Bindings_GL2, _super);
    function Bindings_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Bindings;
      var uniformBufferBindings = descriptor.uniformBufferBindings,
        samplerBindings = descriptor.samplerBindings;
      _this.uniformBufferBindings = uniformBufferBindings || [];
      _this.samplerBindings = samplerBindings || [];
      _this.bindingLayouts = _this.createBindingLayouts();
      return _this;
    }
    Bindings_GL2.prototype.createBindingLayouts = function () {
      var firstUniformBuffer = 0;
      var firstSampler = 0;
      var bindingLayoutTables = [];
      var numUniformBuffers = this.uniformBufferBindings.length;
      var numSamplers = this.samplerBindings.length;
      bindingLayoutTables.push({
        firstUniformBuffer,
        numUniformBuffers,
        firstSampler,
        numSamplers,
      });
      firstUniformBuffer += numUniformBuffers;
      firstSampler += numSamplers;
      return {
        numUniformBuffers: firstUniformBuffer,
        numSamplers: firstSampler,
        bindingLayoutTables,
      };
    };
    return Bindings_GL2;
  })(ResourceBase_GL);
function isWebGL2(gl) {
  if (
    typeof WebGL2RenderingContext !== 'undefined' &&
    gl instanceof WebGL2RenderingContext
  ) {
    return true;
  }
  return Boolean(gl && gl._version === 2);
}
function isTextureFormatCompressed(fmt) {
  var typeFlags = getFormatTypeFlags(fmt);
  switch (typeFlags) {
    case FormatTypeFlags.BC1:
    case FormatTypeFlags.BC2:
    case FormatTypeFlags.BC3:
    case FormatTypeFlags.BC4_UNORM:
    case FormatTypeFlags.BC4_SNORM:
    case FormatTypeFlags.BC5_UNORM:
    case FormatTypeFlags.BC5_SNORM:
      return true;
    default:
      return false;
  }
}
function isFormatSizedInteger(fmt) {
  var flags = getFormatFlags(fmt);
  if (flags & FormatFlags.Normalized) return false;
  var typeFlags = getFormatTypeFlags(fmt);
  if (
    typeFlags === FormatTypeFlags.S8 ||
    typeFlags === FormatTypeFlags.S16 ||
    typeFlags === FormatTypeFlags.S32
  )
    return true;
  if (
    typeFlags === FormatTypeFlags.U8 ||
    typeFlags === FormatTypeFlags.U16 ||
    typeFlags === FormatTypeFlags.U32
  )
    return true;
  return false;
}
function translateBufferHint(hint) {
  switch (hint) {
    case BufferFrequencyHint.STATIC:
      return GL.STATIC_DRAW;
    case BufferFrequencyHint.DYNAMIC:
      return GL.DYNAMIC_DRAW;
  }
}
function translateBufferUsageToTarget(usage) {
  if (usage & BufferUsage.INDEX) {
    return GL.ELEMENT_ARRAY_BUFFER;
  } else if (usage & BufferUsage.VERTEX) {
    return GL.ARRAY_BUFFER;
  } else if (usage & BufferUsage.UNIFORM) {
    return GL.UNIFORM_BUFFER;
  }
}
function translatePrimitiveTopology(topology) {
  switch (topology) {
    case PrimitiveTopology.TRIANGLES:
      return GL.TRIANGLES;
    case PrimitiveTopology.POINTS:
      return GL.POINTS;
    case PrimitiveTopology.TRIANGLE_STRIP:
      return GL.TRIANGLE_STRIP;
    case PrimitiveTopology.LINES:
      return GL.LINES;
    case PrimitiveTopology.LINE_STRIP:
      return GL.LINE_STRIP;
    default:
      throw new Error('Unknown primitive topology mode');
  }
}
function translateType(flags) {
  switch (flags) {
    case FormatTypeFlags.U8:
      return GL.UNSIGNED_BYTE;
    case FormatTypeFlags.U16:
      return GL.UNSIGNED_SHORT;
    case FormatTypeFlags.U32:
      return GL.UNSIGNED_INT;
    case FormatTypeFlags.S8:
      return GL.BYTE;
    case FormatTypeFlags.S16:
      return GL.SHORT;
    case FormatTypeFlags.S32:
      return GL.INT;
    case FormatTypeFlags.F16:
      return GL.HALF_FLOAT;
    case FormatTypeFlags.F32:
      return GL.FLOAT;
    default:
      throw new Error('whoops');
  }
}
function translateSize(flags) {
  switch (flags) {
    case FormatCompFlags.R:
      return 1;
    case FormatCompFlags.RG:
      return 2;
    case FormatCompFlags.RGB:
      return 3;
    case FormatCompFlags.RGBA:
      return 4;
    default:
      return 1;
  }
}
function translateVertexFormat$1(fmt) {
  var typeFlags = getFormatTypeFlags(fmt);
  var compFlags = getFormatCompFlags(fmt);
  var flags = getFormatFlags(fmt);
  var type = translateType(typeFlags);
  var size2 = translateSize(compFlags);
  var normalized = !!(flags & FormatFlags.Normalized);
  return { size: size2, type, normalized };
}
function translateIndexFormat$1(format) {
  switch (format) {
    case Format.U8_R:
      return GL.UNSIGNED_BYTE;
    case Format.U16_R:
      return GL.UNSIGNED_SHORT;
    case Format.U32_R:
      return GL.UNSIGNED_INT;
    default:
      throw new Error('whoops');
  }
}
function translateAddressMode$1(wrapMode) {
  switch (wrapMode) {
    case AddressMode.CLAMP_TO_EDGE:
      return GL.CLAMP_TO_EDGE;
    case AddressMode.REPEAT:
      return GL.REPEAT;
    case AddressMode.MIRRORED_REPEAT:
      return GL.MIRRORED_REPEAT;
    default:
      throw new Error('whoops');
  }
}
function translateFilterMode(filter, mipmapFilter) {
  if (
    mipmapFilter === MipmapFilterMode.LINEAR &&
    filter === FilterMode.BILINEAR
  ) {
    return GL.LINEAR_MIPMAP_LINEAR;
  }
  if (mipmapFilter === MipmapFilterMode.LINEAR && filter === FilterMode.POINT) {
    return GL.NEAREST_MIPMAP_LINEAR;
  }
  if (
    mipmapFilter === MipmapFilterMode.NEAREST &&
    filter === FilterMode.BILINEAR
  ) {
    return GL.LINEAR_MIPMAP_NEAREST;
  }
  if (
    mipmapFilter === MipmapFilterMode.NEAREST &&
    filter === FilterMode.POINT
  ) {
    return GL.NEAREST_MIPMAP_NEAREST;
  }
  if (
    mipmapFilter === MipmapFilterMode.NO_MIP &&
    filter === FilterMode.BILINEAR
  ) {
    return GL.LINEAR;
  }
  if (mipmapFilter === MipmapFilterMode.NO_MIP && filter === FilterMode.POINT) {
    return GL.NEAREST;
  }
  throw new Error('Unknown texture filter mode');
}
function getPlatformBuffer$1(buffer_, byteOffset) {
  if (byteOffset === void 0) {
    byteOffset = 0;
  }
  var buffer = buffer_;
  return buffer.gl_buffer_pages[(byteOffset / buffer.pageByteSize) | 0];
}
function getPlatformTexture(texture_) {
  var texture = texture_;
  return texture.gl_texture;
}
function getPlatformSampler$1(sampler_) {
  var sampler = sampler_;
  return sampler.gl_sampler;
}
function assignPlatformName(o, name) {
  o.name = name;
  o.__SPECTOR_Metadata = { name };
}
function findall(haystack, needle) {
  var results = [];
  while (true) {
    var result = needle.exec(haystack);
    if (!result) break;
    results.push(result);
  }
  return results;
}
function isBlendStateNone(blendState) {
  return (
    blendState.blendMode == BlendMode.ADD &&
    blendState.blendSrcFactor == BlendFactor.ONE &&
    blendState.blendDstFactor === BlendFactor.ZERO
  );
}
function translateQueryPoolType$1(type) {
  switch (type) {
    case QueryPoolType.OcclusionConservative:
      return GL.ANY_SAMPLES_PASSED_CONSERVATIVE;
    default:
      throw new Error('whoops');
  }
}
function translateTextureDimension$1(dimension) {
  if (dimension === TextureDimension.TEXTURE_2D) return GL.TEXTURE_2D;
  else if (dimension === TextureDimension.TEXTURE_2D_ARRAY)
    return GL.TEXTURE_2D_ARRAY;
  else if (dimension === TextureDimension.TEXTURE_CUBE_MAP)
    return GL.TEXTURE_CUBE_MAP;
  else if (dimension === TextureDimension.TEXTURE_3D) return GL.TEXTURE_3D;
  else throw new Error('whoops');
}
function isBlockCompressSized(w, h, bw, bh) {
  if (w % bw !== 0) return false;
  if (h % bh !== 0) return false;
  return true;
}
var Buffer_GL =
  /** @class */
  (function (_super) {
    __extends(Buffer_GL2, _super);
    function Buffer_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Buffer;
      var viewOrSize = descriptor.viewOrSize,
        usage = descriptor.usage,
        _b = descriptor.hint,
        hint = _b === void 0 ? BufferFrequencyHint.STATIC : _b;
      var uniformBufferMaxPageByteSize = device.uniformBufferMaxPageByteSize,
        gl = device.gl;
      var isUBO = usage & BufferUsage.UNIFORM;
      if (!isUBO) {
        if (isWebGL2(gl)) {
          gl.bindVertexArray(null);
        } else {
          device.OES_vertex_array_object.bindVertexArrayOES(null);
        }
      }
      var byteSize = is_number_default(viewOrSize)
        ? align(viewOrSize, 4)
        : align(viewOrSize.byteLength, 4);
      _this.gl_buffer_pages = [];
      var pageByteSize;
      if (isUBO) {
        var byteSizeLeft = byteSize;
        while (byteSizeLeft > 0) {
          _this.gl_buffer_pages.push(
            _this.createBufferPage(
              Math.min(byteSizeLeft, uniformBufferMaxPageByteSize),
              usage,
              hint,
            ),
          );
          byteSizeLeft -= uniformBufferMaxPageByteSize;
        }
        pageByteSize = uniformBufferMaxPageByteSize;
      } else {
        _this.gl_buffer_pages.push(
          _this.createBufferPage(byteSize, usage, hint),
        );
        pageByteSize = byteSize;
      }
      _this.pageByteSize = pageByteSize;
      _this.byteSize = byteSize;
      _this.usage = usage;
      _this.gl_target = translateBufferUsageToTarget(usage);
      if (!is_number_default(viewOrSize)) {
        _this.setSubData(0, new Uint8Array(viewOrSize.buffer));
      }
      if (!isUBO) {
        if (isWebGL2(gl)) {
          gl.bindVertexArray(_this.device['currentBoundVAO']);
        } else {
          device.OES_vertex_array_object.bindVertexArrayOES(
            _this.device['currentBoundVAO'],
          );
        }
      }
      return _this;
    }
    Buffer_GL2.prototype.setSubData = function (
      dstByteOffset,
      data,
      srcByteOffset,
      byteSize,
    ) {
      if (srcByteOffset === void 0) {
        srcByteOffset = 0;
      }
      if (byteSize === void 0) {
        byteSize = data.byteLength - srcByteOffset;
      }
      var gl = this.device.gl;
      var dstPageByteSize = this.pageByteSize;
      var virtBufferByteOffsetEnd = dstByteOffset + byteSize;
      var virtBufferByteOffset = dstByteOffset;
      var physBufferByteOffset = dstByteOffset % dstPageByteSize;
      while (virtBufferByteOffset < virtBufferByteOffsetEnd) {
        var target = isWebGL2(gl) ? gl.COPY_WRITE_BUFFER : this.gl_target;
        var buffer = getPlatformBuffer$1(this, virtBufferByteOffset);
        if (buffer.ubo) {
          return;
        }
        gl.bindBuffer(target, buffer);
        if (isWebGL2(gl)) {
          gl.bufferSubData(
            target,
            physBufferByteOffset,
            data,
            srcByteOffset,
            Math.min(
              virtBufferByteOffsetEnd - virtBufferByteOffset,
              dstPageByteSize,
            ),
          );
        } else {
          gl.bufferSubData(target, physBufferByteOffset, data);
        }
        virtBufferByteOffset += dstPageByteSize;
        physBufferByteOffset = 0;
        srcByteOffset += dstPageByteSize;
        this.device['debugGroupStatisticsBufferUpload']();
      }
    };
    Buffer_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      for (var i = 0; i < this.gl_buffer_pages.length; i++) {
        if (!this.gl_buffer_pages[i].ubo) {
          this.device.gl.deleteBuffer(this.gl_buffer_pages[i]);
        }
      }
      this.gl_buffer_pages = [];
    };
    Buffer_GL2.prototype.createBufferPage = function (byteSize, usage, hint) {
      var gl = this.device.gl;
      var isUBO = usage & BufferUsage.UNIFORM;
      if (!isWebGL2(gl) && isUBO) {
        return {
          ubo: true,
        };
      } else {
        var gl_buffer = this.device.ensureResourceExists(gl.createBuffer());
        var gl_target = translateBufferUsageToTarget(usage);
        var gl_hint = translateBufferHint(hint);
        gl.bindBuffer(gl_target, gl_buffer);
        gl.bufferData(gl_target, byteSize, gl_hint);
        return gl_buffer;
      }
    };
    return Buffer_GL2;
  })(ResourceBase_GL);
var InputLayout_GL =
  /** @class */
  (function (_super) {
    __extends(InputLayout_GL2, _super);
    function InputLayout_GL2(_a2) {
      var e_1, _b, e_2, _c;
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _d;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.InputLayout;
      var vertexBufferDescriptors = descriptor.vertexBufferDescriptors,
        indexBufferFormat = descriptor.indexBufferFormat,
        program = descriptor.program;
      assert(
        indexBufferFormat === Format.U16_R ||
          indexBufferFormat === Format.U32_R ||
          indexBufferFormat === null,
      );
      var indexBufferType =
        indexBufferFormat !== null
          ? translateIndexFormat$1(indexBufferFormat)
          : null;
      var indexBufferCompByteSize =
        indexBufferFormat !== null
          ? getFormatCompByteSize(indexBufferFormat)
          : null;
      var gl = _this.device.gl;
      var vao = _this.device.ensureResourceExists(
        isWebGL2(gl)
          ? gl.createVertexArray()
          : device.OES_vertex_array_object.createVertexArrayOES(),
      );
      if (isWebGL2(gl)) {
        gl.bindVertexArray(vao);
      } else {
        device.OES_vertex_array_object.bindVertexArrayOES(vao);
      }
      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        getPlatformBuffer$1(_this.device['fallbackVertexBuffer']),
      );
      try {
        for (
          var _e = __values(descriptor.vertexBufferDescriptors), _f = _e.next();
          !_f.done;
          _f = _e.next()
        ) {
          var vertexBufferDescriptor = _f.value;
          var stepMode = vertexBufferDescriptor.stepMode,
            attributes = vertexBufferDescriptor.attributes;
          try {
            for (
              var attributes_1 = ((e_2 = void 0), __values(attributes)),
                attributes_1_1 = attributes_1.next();
              !attributes_1_1.done;
              attributes_1_1 = attributes_1.next()
            ) {
              var attribute = attributes_1_1.value;
              var shaderLocation = attribute.shaderLocation,
                format = attribute.format,
                _g = attribute.divisor,
                divisor = _g === void 0 ? 1 : _g;
              var location_1 = isWebGL2(gl)
                ? shaderLocation
                : (_d = program.attributes[shaderLocation]) === null ||
                  _d === void 0
                ? void 0
                : _d.location;
              var vertexFormat = translateVertexFormat$1(format);
              attribute.vertexFormat = vertexFormat;
              if (!is_nil_default(location_1)) {
                if (isFormatSizedInteger(format)) {
                }
                var size2 = vertexFormat.size,
                  type = vertexFormat.type,
                  normalized = vertexFormat.normalized;
                gl.vertexAttribPointer(
                  location_1,
                  size2,
                  type,
                  normalized,
                  0,
                  0,
                );
                if (stepMode === VertexStepMode.INSTANCE) {
                  if (isWebGL2(gl)) {
                    gl.vertexAttribDivisor(location_1, divisor);
                  } else {
                    device.ANGLE_instanced_arrays.vertexAttribDivisorANGLE(
                      location_1,
                      divisor,
                    );
                  }
                }
                gl.enableVertexAttribArray(location_1);
              }
            }
          } catch (e_2_1) {
            e_2 = { error: e_2_1 };
          } finally {
            try {
              if (
                attributes_1_1 &&
                !attributes_1_1.done &&
                (_c = attributes_1.return)
              )
                _c.call(attributes_1);
            } finally {
              if (e_2) throw e_2.error;
            }
          }
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      if (isWebGL2(gl)) {
        gl.bindVertexArray(null);
      } else {
        device.OES_vertex_array_object.bindVertexArrayOES(null);
      }
      _this.vertexBufferDescriptors = vertexBufferDescriptors;
      _this.vao = vao;
      _this.indexBufferFormat = indexBufferFormat;
      _this.indexBufferType = indexBufferType;
      _this.indexBufferCompByteSize = indexBufferCompByteSize;
      _this.program = program;
      return _this;
    }
    InputLayout_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      if (this.device['currentBoundVAO'] === this.vao) {
        if (isWebGL2(this.device.gl)) {
          this.device.gl.bindVertexArray(null);
          this.device.gl.deleteVertexArray(this.vao);
        } else {
          this.device.OES_vertex_array_object.bindVertexArrayOES(null);
          this.device.OES_vertex_array_object.deleteVertexArrayOES(this.vao);
        }
        this.device['currentBoundVAO'] = null;
      }
    };
    return InputLayout_GL2;
  })(ResourceBase_GL);
var Texture_GL =
  /** @class */
  (function (_super) {
    __extends(Texture_GL2, _super);
    function Texture_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor,
        fake = _a2.fake;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Texture;
      descriptor = __assign(
        {
          dimension: TextureDimension.TEXTURE_2D,
          depthOrArrayLayers: 1,
          mipLevelCount: 1,
        },
        descriptor,
      );
      var gl = _this.device.gl;
      var gl_target;
      var gl_texture;
      var mipLevelCount = _this.clampmipLevelCount(descriptor);
      _this.immutable = descriptor.usage === TextureUsage.RENDER_TARGET;
      _this.pixelStore = descriptor.pixelStore;
      _this.format = descriptor.format;
      _this.dimension = descriptor.dimension;
      _this.formatKind = getFormatSamplerKind(descriptor.format);
      _this.width = descriptor.width;
      _this.height = descriptor.height;
      _this.depthOrArrayLayers = descriptor.depthOrArrayLayers;
      _this.mipmaps = mipLevelCount >= 1;
      if (!fake) {
        gl_texture = _this.device.ensureResourceExists(gl.createTexture());
        var gl_type = _this.device.translateTextureType(descriptor.format);
        var internalformat = _this.device.translateTextureInternalFormat(
          descriptor.format,
        );
        _this.device.setActiveTexture(gl.TEXTURE0);
        _this.device['currentTextures'][0] = null;
        _this.preprocessImage();
        if (descriptor.dimension === TextureDimension.TEXTURE_2D) {
          gl_target = GL.TEXTURE_2D;
          gl.bindTexture(gl_target, gl_texture);
          if (_this.immutable) {
            if (isWebGL2(gl)) {
              gl.texStorage2D(
                gl_target,
                mipLevelCount,
                internalformat,
                descriptor.width,
                descriptor.height,
              );
            } else {
              var level =
                internalformat === GL.DEPTH_COMPONENT || _this.isNPOT() ? 0 : 0;
              if (
                (_this.format === Format.D32F ||
                  _this.format === Format.D24_S8) &&
                !isWebGL2(gl) &&
                !device.WEBGL_depth_texture
              );
              else {
                gl.texImage2D(
                  gl_target,
                  level,
                  internalformat,
                  descriptor.width,
                  descriptor.height,
                  0,
                  internalformat,
                  gl_type,
                  null,
                );
                if (_this.mipmaps) {
                  _this.mipmaps = false;
                  gl.texParameteri(
                    GL.TEXTURE_2D,
                    GL.TEXTURE_MIN_FILTER,
                    GL.LINEAR,
                  );
                  gl.texParameteri(
                    GL.TEXTURE_2D,
                    GL.TEXTURE_WRAP_S,
                    GL.CLAMP_TO_EDGE,
                  );
                  gl.texParameteri(
                    GL.TEXTURE_2D,
                    GL.TEXTURE_WRAP_T,
                    GL.CLAMP_TO_EDGE,
                  );
                }
              }
            }
          }
          assert(descriptor.depthOrArrayLayers === 1);
        } else if (descriptor.dimension === TextureDimension.TEXTURE_2D_ARRAY) {
          gl_target = GL.TEXTURE_2D_ARRAY;
          gl.bindTexture(gl_target, gl_texture);
          if (_this.immutable) {
            if (isWebGL2(gl)) {
              gl.texStorage3D(
                gl_target,
                mipLevelCount,
                internalformat,
                descriptor.width,
                descriptor.height,
                descriptor.depthOrArrayLayers,
              );
            }
          }
        } else if (descriptor.dimension === TextureDimension.TEXTURE_3D) {
          gl_target = GL.TEXTURE_3D;
          gl.bindTexture(gl_target, gl_texture);
          if (_this.immutable) {
            if (isWebGL2(gl)) {
              gl.texStorage3D(
                gl_target,
                mipLevelCount,
                internalformat,
                descriptor.width,
                descriptor.height,
                descriptor.depthOrArrayLayers,
              );
            }
          }
        } else if (descriptor.dimension === TextureDimension.TEXTURE_CUBE_MAP) {
          gl_target = GL.TEXTURE_CUBE_MAP;
          gl.bindTexture(gl_target, gl_texture);
          if (_this.immutable) {
            if (isWebGL2(gl)) {
              gl.texStorage2D(
                gl_target,
                mipLevelCount,
                internalformat,
                descriptor.width,
                descriptor.height,
              );
            }
          }
          assert(descriptor.depthOrArrayLayers === 6);
        } else {
          throw new Error('whoops');
        }
      }
      _this.gl_texture = gl_texture;
      _this.gl_target = gl_target;
      _this.mipLevelCount = mipLevelCount;
      return _this;
    }
    Texture_GL2.prototype.setImageData = function (levelDatas, lod) {
      if (lod === void 0) {
        lod = 0;
      }
      var gl = this.device.gl;
      isTextureFormatCompressed(this.format);
      var is3D =
        this.gl_target === GL.TEXTURE_3D ||
        this.gl_target === GL.TEXTURE_2D_ARRAY;
      var isCube = this.gl_target === GL.TEXTURE_CUBE_MAP;
      var isTA = isTypedArray(levelDatas[0]);
      this.device.setActiveTexture(gl.TEXTURE0);
      this.device['currentTextures'][0] = null;
      var data = levelDatas[0];
      var width;
      var height;
      if (isTA) {
        width = this.width;
        height = this.height;
      } else {
        width = data.width;
        height = data.height;
        this.width = width;
        this.height = height;
      }
      gl.bindTexture(this.gl_target, this.gl_texture);
      var gl_format = this.device.translateTextureFormat(this.format);
      var gl_internal_format = isWebGL2(gl)
        ? this.device.translateInternalTextureFormat(this.format)
        : gl_format;
      var gl_type = this.device.translateTextureType(this.format);
      this.preprocessImage();
      for (var z = 0; z < this.depthOrArrayLayers; z++) {
        var levelData = levelDatas[z];
        var gl_target = this.gl_target;
        if (isCube) {
          gl_target = GL.TEXTURE_CUBE_MAP_POSITIVE_X + (z % 6);
        }
        if (this.immutable) {
          gl.texSubImage2D(
            gl_target,
            lod,
            0,
            0,
            width,
            height,
            gl_format,
            gl_type,
            levelData,
          );
        } else {
          if (isWebGL2(gl)) {
            if (is3D) {
              gl.texImage3D(
                gl_target,
                lod,
                gl_internal_format,
                width,
                height,
                this.depthOrArrayLayers,
                0,
                // border must be 0
                gl_format,
                // TODO: can be different with gl_format
                gl_type,
                levelData,
              );
            } else {
              gl.texImage2D(
                gl_target,
                lod,
                gl_internal_format,
                width,
                height,
                0,
                // border must be 0
                gl_format,
                // TODO: can be different with gl_format
                gl_type,
                levelData,
              );
            }
          } else {
            if (isTA) {
              gl.texImage2D(
                gl_target,
                lod,
                gl_format,
                width,
                height,
                0,
                gl_format,
                gl_type,
                levelData,
              );
            } else {
              gl.texImage2D(
                gl_target,
                lod,
                gl_format,
                gl_format,
                gl_type,
                levelData,
              );
            }
          }
        }
      }
      if (this.mipmaps) {
        this.generateMipmap(is3D);
      }
    };
    Texture_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      this.device.gl.deleteTexture(getPlatformTexture(this));
    };
    Texture_GL2.prototype.clampmipLevelCount = function (descriptor) {
      if (
        descriptor.dimension === TextureDimension.TEXTURE_2D_ARRAY &&
        descriptor.depthOrArrayLayers > 1
      ) {
        var typeFlags = getFormatTypeFlags(descriptor.format);
        if (typeFlags === FormatTypeFlags.BC1) {
          var w = descriptor.width,
            h = descriptor.height;
          for (var i = 0; i < descriptor.mipLevelCount; i++) {
            if (w <= 2 || h <= 2) return i - 1;
            w = Math.max((w / 2) | 0, 1);
            h = Math.max((h / 2) | 0, 1);
          }
        }
      }
      return descriptor.mipLevelCount;
    };
    Texture_GL2.prototype.preprocessImage = function () {
      var gl = this.device.gl;
      if (this.pixelStore) {
        if (this.pixelStore.unpackFlipY) {
          gl.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
        }
        if (this.pixelStore.packAlignment) {
          gl.pixelStorei(GL.PACK_ALIGNMENT, this.pixelStore.packAlignment);
        }
        if (this.pixelStore.unpackAlignment) {
          gl.pixelStorei(GL.UNPACK_ALIGNMENT, this.pixelStore.unpackAlignment);
        }
      }
    };
    Texture_GL2.prototype.generateMipmap = function (is3D) {
      if (is3D === void 0) {
        is3D = false;
      }
      var gl = this.device.gl;
      if (!isWebGL2(gl) && this.isNPOT()) {
        return this;
      }
      if (this.gl_texture && this.gl_target) {
        gl.bindTexture(this.gl_target, this.gl_texture);
        if (is3D) {
          gl.texParameteri(this.gl_target, GL.TEXTURE_BASE_LEVEL, 0);
          gl.texParameteri(
            this.gl_target,
            GL.TEXTURE_MAX_LEVEL,
            Math.log2(this.width),
          );
          gl.texParameteri(
            this.gl_target,
            GL.TEXTURE_MIN_FILTER,
            GL.LINEAR_MIPMAP_LINEAR,
          );
          gl.texParameteri(this.gl_target, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
        } else {
          gl.texParameteri(
            GL.TEXTURE_2D,
            GL.TEXTURE_MIN_FILTER,
            GL.NEAREST_MIPMAP_LINEAR,
          );
        }
        gl.generateMipmap(this.gl_target);
        gl.bindTexture(this.gl_target, null);
      }
      return this;
    };
    Texture_GL2.prototype.isNPOT = function () {
      var gl = this.device.gl;
      if (isWebGL2(gl)) {
        return false;
      }
      return !isPowerOfTwo(this.width) || !isPowerOfTwo(this.height);
    };
    return Texture_GL2;
  })(ResourceBase_GL);
var RenderTarget_GL =
  /** @class */
  (function (_super) {
    __extends(RenderTarget_GL2, _super);
    function RenderTarget_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.RenderTarget;
      _this.gl_renderbuffer = null;
      _this.texture = null;
      var gl = _this.device.gl;
      var format = descriptor.format,
        width = descriptor.width,
        height = descriptor.height,
        _b = descriptor.sampleCount,
        sampleCount = _b === void 0 ? 1 : _b,
        texture = descriptor.texture;
      var useRenderbuffer = false;
      if (
        (format === Format.D32F || format === Format.D24_S8) &&
        texture &&
        !isWebGL2(gl) &&
        !device.WEBGL_depth_texture
      ) {
        texture.destroy();
        _this.texture = null;
        useRenderbuffer = true;
      }
      if (!useRenderbuffer && texture) {
        _this.texture = texture;
      } else {
        _this.gl_renderbuffer = _this.device.ensureResourceExists(
          gl.createRenderbuffer(),
        );
        gl.bindRenderbuffer(gl.RENDERBUFFER, _this.gl_renderbuffer);
        var gl_format = _this.device.translateTextureInternalFormat(
          format,
          true,
        );
        if (isWebGL2(gl)) {
          if (sampleCount > 1) {
            gl.renderbufferStorageMultisample(
              GL.RENDERBUFFER,
              sampleCount,
              gl_format,
              width,
              height,
            );
          } else {
            gl.renderbufferStorage(GL.RENDERBUFFER, gl_format, width, height);
          }
        } else {
          gl.renderbufferStorage(GL.RENDERBUFFER, gl_format, width, height);
        }
      }
      _this.format = format;
      _this.width = width;
      _this.height = height;
      _this.sampleCount = sampleCount;
      return _this;
    }
    RenderTarget_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      if (this.gl_renderbuffer !== null) {
        this.device.gl.deleteRenderbuffer(this.gl_renderbuffer);
      }
      if (this.texture) {
        this.texture.destroy();
      }
    };
    return RenderTarget_GL2;
  })(ResourceBase_GL);
var ProgramCompileState_GL;
(function (ProgramCompileState_GL2) {
  ProgramCompileState_GL2[(ProgramCompileState_GL2['NeedsCompile'] = 0)] =
    'NeedsCompile';
  ProgramCompileState_GL2[(ProgramCompileState_GL2['Compiling'] = 1)] =
    'Compiling';
  ProgramCompileState_GL2[(ProgramCompileState_GL2['NeedsBind'] = 2)] =
    'NeedsBind';
  ProgramCompileState_GL2[(ProgramCompileState_GL2['ReadyToUse'] = 3)] =
    'ReadyToUse';
})(ProgramCompileState_GL || (ProgramCompileState_GL = {}));
var Program_GL =
  /** @class */
  (function (_super) {
    __extends(Program_GL2, _super);
    function Program_GL2(_a2, rawVertexGLSL) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.rawVertexGLSL = rawVertexGLSL;
      _this.type = ResourceType.Program;
      _this.uniformSetters = {};
      _this.attributes = [];
      var gl = _this.device.gl;
      _this.descriptor = descriptor;
      _this.gl_program = _this.device.ensureResourceExists(gl.createProgram());
      _this.gl_shader_vert = null;
      _this.gl_shader_frag = null;
      _this.compileState = ProgramCompileState_GL.NeedsCompile;
      _this.tryCompileProgram();
      return _this;
    }
    Program_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      this.device.gl.deleteProgram(this.gl_program);
      this.device.gl.deleteShader(this.gl_shader_vert);
      this.device.gl.deleteShader(this.gl_shader_frag);
    };
    Program_GL2.prototype.tryCompileProgram = function () {
      assert(this.compileState === ProgramCompileState_GL.NeedsCompile);
      var _a2 = this.descriptor,
        vertex = _a2.vertex,
        fragment = _a2.fragment;
      var gl = this.device.gl;
      if (
        (vertex === null || vertex === void 0 ? void 0 : vertex.glsl) &&
        (fragment === null || fragment === void 0 ? void 0 : fragment.glsl)
      ) {
        this.gl_shader_vert = this.compileShader(
          vertex.postprocess ? vertex.postprocess(vertex.glsl) : vertex.glsl,
          gl.VERTEX_SHADER,
        );
        this.gl_shader_frag = this.compileShader(
          fragment.postprocess
            ? fragment.postprocess(fragment.glsl)
            : fragment.glsl,
          gl.FRAGMENT_SHADER,
        );
        gl.attachShader(this.gl_program, this.gl_shader_vert);
        gl.attachShader(this.gl_program, this.gl_shader_frag);
        gl.linkProgram(this.gl_program);
        this.compileState = ProgramCompileState_GL.Compiling;
        if (!isWebGL2(gl)) {
          this.readUniformLocationsFromLinkedProgram();
          this.readAttributesFromLinkedProgram();
        }
      }
    };
    Program_GL2.prototype.readAttributesFromLinkedProgram = function () {
      var _a2;
      var gl = this.device.gl;
      var count = gl.getProgramParameter(this.gl_program, gl.ACTIVE_ATTRIBUTES);
      var defines = getDefines(this.descriptor.vertex.glsl);
      var locations = getAttributeLocations(
        // Use raw GLSL
        this.rawVertexGLSL,
        defines,
      );
      var _loop_1 = function (index2) {
        var _b = gl.getActiveAttrib(this_1.gl_program, index2),
          name_1 = _b.name,
          type = _b.type,
          size2 = _b.size;
        var location_1 = gl.getAttribLocation(this_1.gl_program, name_1);
        var definedLocation =
          (_a2 = locations.find(function (l) {
            return l.name === name_1;
          })) === null || _a2 === void 0
            ? void 0
            : _a2.location;
        if (location_1 >= 0 && !is_nil_default(definedLocation)) {
          this_1.attributes[definedLocation] = {
            name: name_1,
            location: location_1,
            type,
            size: size2,
          };
        }
      };
      var this_1 = this;
      for (var index = 0; index < count; index++) {
        _loop_1(index);
      }
    };
    Program_GL2.prototype.readUniformLocationsFromLinkedProgram = function () {
      var gl = this.device.gl;
      var numUniforms = gl.getProgramParameter(
        this.gl_program,
        gl.ACTIVE_UNIFORMS,
      );
      for (var i = 0; i < numUniforms; i++) {
        var info = gl.getActiveUniform(this.gl_program, i);
        var name_2 = parseUniformName(info.name).name;
        var location_2 = gl.getUniformLocation(this.gl_program, name_2);
        this.uniformSetters[name_2] = getUniformSetter(gl, location_2, info);
        if (info && info.size > 1) {
          for (var l = 0; l < info.size; l++) {
            location_2 = gl.getUniformLocation(
              this.gl_program,
              ''.concat(name_2, '[').concat(l, ']'),
            );
            this.uniformSetters[''.concat(name_2, '[').concat(l, ']')] =
              getUniformSetter(gl, location_2, info);
          }
        }
      }
    };
    Program_GL2.prototype.compileShader = function (contents, type) {
      var gl = this.device.gl;
      var shader = this.device.ensureResourceExists(gl.createShader(type));
      gl.shaderSource(shader, contents);
      gl.compileShader(shader);
      return shader;
    };
    Program_GL2.prototype.setUniformsLegacy = function (uniforms) {
      if (uniforms === void 0) {
        uniforms = {};
      }
      var gl = this.device.gl;
      if (!isWebGL2(gl)) {
        var programUsed = false;
        for (var uniformName in uniforms) {
          if (!programUsed) {
            gl.useProgram(this.gl_program);
            programUsed = true;
          }
          var uniform = uniforms[uniformName];
          var uniformSetter = this.uniformSetters[uniformName];
          if (uniformSetter) {
            var value = uniform;
            if (value instanceof Texture_GL) {
              value = value.textureIndex;
            }
            uniformSetter(value);
          }
        }
      }
      return this;
    };
    return Program_GL2;
  })(ResourceBase_GL);
var QueryPool_GL =
  /** @class */
  (function (_super) {
    __extends(QueryPool_GL2, _super);
    function QueryPool_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.QueryPool;
      var gl = _this.device.gl;
      if (isWebGL2(gl)) {
        var elemCount = descriptor.elemCount,
          type = descriptor.type;
        _this.gl_query = nArray(elemCount, function () {
          return _this.device.ensureResourceExists(gl.createQuery());
        });
        _this.gl_query_type = translateQueryPoolType$1(type);
      }
      return _this;
    }
    QueryPool_GL2.prototype.queryResultOcclusion = function (dstOffs) {
      var gl = this.device.gl;
      if (isWebGL2(gl)) {
        var gl_query = this.gl_query[dstOffs];
        if (!gl.getQueryParameter(gl_query, gl.QUERY_RESULT_AVAILABLE)) {
          return null;
        }
        return !!gl.getQueryParameter(gl_query, gl.QUERY_RESULT);
      }
      return null;
    };
    QueryPool_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      var gl = this.device.gl;
      if (isWebGL2(gl)) {
        for (var i = 0; i < this.gl_query.length; i++) {
          gl.deleteQuery(this.gl_query[i]);
        }
      }
    };
    return QueryPool_GL2;
  })(ResourceBase_GL);
var Readback_GL =
  /** @class */
  (function (_super) {
    __extends(Readback_GL2, _super);
    function Readback_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Readback;
      _this.gl_pbo = null;
      _this.gl_sync = null;
      return _this;
    }
    Readback_GL2.prototype.clientWaitAsync = function (
      sync,
      flags,
      interval_ms,
    ) {
      if (flags === void 0) {
        flags = 0;
      }
      if (interval_ms === void 0) {
        interval_ms = 10;
      }
      var gl = this.device.gl;
      return new Promise(function (resolve, reject) {
        function test() {
          var res = gl.clientWaitSync(sync, flags, 0);
          if (res == gl.WAIT_FAILED) {
            reject();
            return;
          }
          if (res == gl.TIMEOUT_EXPIRED) {
            setTimeout(
              test,
              clamp_default(interval_ms, 0, gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL),
            );
            return;
          }
          resolve();
        }
        test();
      });
    };
    Readback_GL2.prototype.getBufferSubDataAsync = function (
      target,
      buffer,
      srcByteOffset,
      dstBuffer,
      dstOffset,
      length,
    ) {
      return __awaiter(this, void 0, void 0, function () {
        var gl;
        return __generator(this, function (_a2) {
          switch (_a2.label) {
            case 0:
              gl = this.device.gl;
              if (!isWebGL2(gl)) return [3, 2];
              this.gl_sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
              gl.flush();
              return [4, this.clientWaitAsync(this.gl_sync, 0, 10)];
            case 1:
              _a2.sent();
              gl.bindBuffer(target, buffer);
              gl.getBufferSubData(
                target,
                srcByteOffset,
                dstBuffer,
                dstOffset,
                length,
              );
              gl.bindBuffer(target, null);
              return [2, dstBuffer];
            case 2:
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    };
    Readback_GL2.prototype.readTexture = function (
      t,
      x,
      y,
      width,
      height,
      dstBuffer,
      dstOffset,
      length,
    ) {
      if (dstOffset === void 0) {
        dstOffset = 0;
      }
      if (length === void 0) {
        length = dstBuffer.byteLength || 0;
      }
      return __awaiter(this, void 0, void 0, function () {
        var gl, texture, gl_format, gl_type, formatByteSize;
        return __generator(this, function (_a2) {
          gl = this.device.gl;
          texture = t;
          gl_format = this.device.translateTextureFormat(texture.format);
          gl_type = this.device.translateTextureType(texture.format);
          formatByteSize = getFormatByteSize(texture.format);
          if (isWebGL2(gl)) {
            this.gl_pbo = this.device.ensureResourceExists(gl.createBuffer());
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.gl_pbo);
            gl.bufferData(gl.PIXEL_PACK_BUFFER, length, gl.STREAM_READ);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
            gl.bindFramebuffer(
              GL.READ_FRAMEBUFFER,
              this.device['readbackFramebuffer'],
            );
            gl.framebufferTexture2D(
              GL.READ_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              GL.TEXTURE_2D,
              texture.gl_texture,
              0,
            );
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.gl_pbo);
            gl.readPixels(
              x,
              y,
              width,
              height,
              gl_format,
              gl_type,
              dstOffset * formatByteSize,
            );
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
            return [
              2,
              this.getBufferSubDataAsync(
                gl.PIXEL_PACK_BUFFER,
                this.gl_pbo,
                0,
                dstBuffer,
                dstOffset,
                0,
              ),
            ];
          } else {
            return [
              2,
              this.readTextureSync(
                t,
                x,
                y,
                width,
                height,
                dstBuffer,
                dstOffset,
                length,
              ),
            ];
          }
        });
      });
    };
    Readback_GL2.prototype.readTextureSync = function (
      t,
      x,
      y,
      width,
      height,
      dstBuffer,
      dstOffset,
      length,
    ) {
      if (length === void 0) {
        length = dstBuffer.byteLength || 0;
      }
      var gl = this.device.gl;
      var texture = t;
      var gl_type = this.device.translateTextureType(texture.format);
      gl.bindFramebuffer(GL.FRAMEBUFFER, this.device['readbackFramebuffer']);
      gl.framebufferTexture2D(
        GL.FRAMEBUFFER,
        GL.COLOR_ATTACHMENT0,
        GL.TEXTURE_2D,
        texture.gl_texture,
        0,
      );
      gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl_type, dstBuffer);
      return dstBuffer;
    };
    Readback_GL2.prototype.readBuffer = function (
      b,
      srcByteOffset,
      dstBuffer,
      dstOffset,
      length,
    ) {
      return __awaiter(this, void 0, void 0, function () {
        var gl;
        return __generator(this, function (_a2) {
          gl = this.device.gl;
          if (isWebGL2(gl)) {
            return [
              2,
              this.getBufferSubDataAsync(
                gl.ARRAY_BUFFER,
                getPlatformBuffer$1(b, srcByteOffset),
                srcByteOffset,
                dstBuffer,
                dstOffset,
                length,
              ),
            ];
          }
          return [2, Promise.reject()];
        });
      });
    };
    Readback_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      if (isWebGL2(this.device.gl)) {
        if (this.gl_sync !== null) {
          this.device.gl.deleteSync(this.gl_sync);
        }
        if (this.gl_pbo !== null) {
          this.device.gl.deleteBuffer(this.gl_pbo);
        }
      }
    };
    return Readback_GL2;
  })(ResourceBase_GL);
var RenderPipeline_GL =
  /** @class */
  (function (_super) {
    __extends(RenderPipeline_GL2, _super);
    function RenderPipeline_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _b, _c;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.RenderPipeline;
      _this.drawMode = translatePrimitiveTopology(
        (_b = descriptor.topology) !== null && _b !== void 0
          ? _b
          : PrimitiveTopology.TRIANGLES,
      );
      _this.program = descriptor.program;
      _this.inputLayout = descriptor.inputLayout;
      _this.megaState = __assign(
        __assign({}, copyMegaState(defaultMegaState)),
        descriptor.megaStateDescriptor,
      );
      _this.colorAttachmentFormats = descriptor.colorAttachmentFormats.slice();
      _this.depthStencilAttachmentFormat =
        descriptor.depthStencilAttachmentFormat;
      _this.sampleCount =
        (_c = descriptor.sampleCount) !== null && _c !== void 0 ? _c : 1;
      return _this;
    }
    return RenderPipeline_GL2;
  })(ResourceBase_GL);
var ComputePipeline_GL =
  /** @class */
  (function (_super) {
    __extends(ComputePipeline_GL2, _super);
    function ComputePipeline_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.ComputePipeline;
      _this.descriptor = descriptor;
      return _this;
    }
    return ComputePipeline_GL2;
  })(ResourceBase_GL);
var ResourceCreationTracker =
  /** @class */
  (function () {
    function ResourceCreationTracker2() {
      this.liveObjects = /* @__PURE__ */ new Set();
      this.creationStacks = /* @__PURE__ */ new Map();
      this.deletionStacks = /* @__PURE__ */ new Map();
    }
    ResourceCreationTracker2.prototype.trackResourceCreated = function (o) {
      this.creationStacks.set(o, new Error().stack);
      this.liveObjects.add(o);
    };
    ResourceCreationTracker2.prototype.trackResourceDestroyed = function (o) {
      if (this.deletionStacks.has(o))
        console.warn(
          'Object double freed:',
          o,
          '\n\nCreation stack: ',
          this.creationStacks.get(o),
          '\n\nDeletion stack: ',
          this.deletionStacks.get(o),
          '\n\nThis stack: ',
          new Error().stack,
        );
      this.deletionStacks.set(o, new Error().stack);
      this.liveObjects.delete(o);
    };
    ResourceCreationTracker2.prototype.checkForLeaks = function () {
      var e_1, _a2;
      try {
        for (
          var _b = __values(this.liveObjects.values()), _c = _b.next();
          !_c.done;
          _c = _b.next()
        ) {
          var o = _c.value;
          console.warn(
            'Object leaked:',
            o,
            'Creation stack:',
            this.creationStacks.get(o),
          );
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (_c && !_c.done && (_a2 = _b.return)) _a2.call(_b);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
    };
    ResourceCreationTracker2.prototype.setResourceLeakCheck = function (o, v) {
      if (v) {
        this.liveObjects.add(o);
      } else {
        this.liveObjects.delete(o);
      }
    };
    return ResourceCreationTracker2;
  })();
var Sampler_GL =
  /** @class */
  (function (_super) {
    __extends(Sampler_GL2, _super);
    function Sampler_GL2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _b, _c;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Sampler;
      var gl = _this.device.gl;
      if (isWebGL2(gl)) {
        var gl_sampler = _this.device.ensureResourceExists(gl.createSampler());
        gl.samplerParameteri(
          gl_sampler,
          GL.TEXTURE_WRAP_S,
          translateAddressMode$1(descriptor.addressModeU),
        );
        gl.samplerParameteri(
          gl_sampler,
          GL.TEXTURE_WRAP_T,
          translateAddressMode$1(descriptor.addressModeV),
        );
        gl.samplerParameteri(
          gl_sampler,
          GL.TEXTURE_WRAP_R,
          translateAddressMode$1(
            (_b = descriptor.addressModeW) !== null && _b !== void 0
              ? _b
              : descriptor.addressModeU,
          ),
        );
        gl.samplerParameteri(
          gl_sampler,
          GL.TEXTURE_MIN_FILTER,
          translateFilterMode(descriptor.minFilter, descriptor.mipmapFilter),
        );
        gl.samplerParameteri(
          gl_sampler,
          GL.TEXTURE_MAG_FILTER,
          translateFilterMode(descriptor.magFilter, MipmapFilterMode.NO_MIP),
        );
        if (descriptor.lodMinClamp !== void 0) {
          gl.samplerParameterf(
            gl_sampler,
            GL.TEXTURE_MIN_LOD,
            descriptor.lodMinClamp,
          );
        }
        if (descriptor.lodMaxClamp !== void 0) {
          gl.samplerParameterf(
            gl_sampler,
            GL.TEXTURE_MAX_LOD,
            descriptor.lodMaxClamp,
          );
        }
        if (descriptor.compareFunction !== void 0) {
          gl.samplerParameteri(
            gl_sampler,
            gl.TEXTURE_COMPARE_MODE,
            gl.COMPARE_REF_TO_TEXTURE,
          );
          gl.samplerParameteri(
            gl_sampler,
            gl.TEXTURE_COMPARE_FUNC,
            descriptor.compareFunction,
          );
        }
        var maxAnisotropy =
          (_c = descriptor.maxAnisotropy) !== null && _c !== void 0 ? _c : 1;
        if (
          maxAnisotropy > 1 &&
          _this.device.EXT_texture_filter_anisotropic !== null
        ) {
          assert(
            descriptor.minFilter === FilterMode.BILINEAR &&
              descriptor.magFilter === FilterMode.BILINEAR &&
              descriptor.mipmapFilter === MipmapFilterMode.LINEAR,
          );
          gl.samplerParameterf(
            gl_sampler,
            _this.device.EXT_texture_filter_anisotropic
              .TEXTURE_MAX_ANISOTROPY_EXT,
            maxAnisotropy,
          );
        }
        _this.gl_sampler = gl_sampler;
      } else {
        _this.descriptor = descriptor;
      }
      return _this;
    }
    Sampler_GL2.prototype.setTextureParameters = function (
      gl_target,
      width,
      height,
    ) {
      var _a2;
      var gl = this.device.gl;
      var descriptor = this.descriptor;
      if (this.isNPOT(width, height)) {
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
      } else {
        gl.texParameteri(
          gl_target,
          GL.TEXTURE_MIN_FILTER,
          translateFilterMode(descriptor.minFilter, descriptor.mipmapFilter),
        );
      }
      gl.texParameteri(
        GL.TEXTURE_2D,
        GL.TEXTURE_WRAP_S,
        translateAddressMode$1(descriptor.addressModeU),
      );
      gl.texParameteri(
        GL.TEXTURE_2D,
        GL.TEXTURE_WRAP_T,
        translateAddressMode$1(descriptor.addressModeV),
      );
      gl.texParameteri(
        gl_target,
        GL.TEXTURE_MAG_FILTER,
        translateFilterMode(descriptor.magFilter, MipmapFilterMode.NO_MIP),
      );
      var maxAnisotropy =
        (_a2 = descriptor.maxAnisotropy) !== null && _a2 !== void 0 ? _a2 : 1;
      if (
        maxAnisotropy > 1 &&
        this.device.EXT_texture_filter_anisotropic !== null
      ) {
        assert(
          descriptor.minFilter === FilterMode.BILINEAR &&
            descriptor.magFilter === FilterMode.BILINEAR &&
            descriptor.mipmapFilter === MipmapFilterMode.LINEAR,
        );
        gl.texParameteri(
          gl_target,
          this.device.EXT_texture_filter_anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
          maxAnisotropy,
        );
      }
    };
    Sampler_GL2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      if (isWebGL2(this.device.gl)) {
        this.device.gl.deleteSampler(getPlatformSampler$1(this));
      }
    };
    Sampler_GL2.prototype.isNPOT = function (width, height) {
      return !isPowerOfTwo(width) || !isPowerOfTwo(height);
    };
    return Sampler_GL2;
  })(ResourceBase_GL);
var ComputePass_GL =
  /** @class */
  (function () {
    function ComputePass_GL2() {}
    ComputePass_GL2.prototype.dispatchWorkgroups = function (
      workgroupCountX,
      workgroupCountY,
      workgroupCountZ,
    ) {};
    ComputePass_GL2.prototype.dispatchWorkgroupsIndirect = function (
      indirectBuffer,
      indirectOffset,
    ) {};
    ComputePass_GL2.prototype.setPipeline = function (pipeline_) {};
    ComputePass_GL2.prototype.setBindings = function (bindings_) {};
    ComputePass_GL2.prototype.pushDebugGroup = function (name) {};
    ComputePass_GL2.prototype.popDebugGroup = function () {};
    ComputePass_GL2.prototype.insertDebugMarker = function (markerLabel) {};
    return ComputePass_GL2;
  })();
var RenderBundle_GL =
  /** @class */
  (function (_super) {
    __extends(RenderBundle_GL2, _super);
    function RenderBundle_GL2() {
      var _this = (_super !== null && _super.apply(this, arguments)) || this;
      _this.type = ResourceType.RenderBundle;
      _this.commands = [];
      return _this;
    }
    RenderBundle_GL2.prototype.push = function (f) {
      this.commands.push(f);
    };
    RenderBundle_GL2.prototype.replay = function () {
      this.commands.forEach(function (f) {
        return f();
      });
    };
    return RenderBundle_GL2;
  })(ResourceBase_GL);
var UBO_PAGE_MAX_BYTE_SIZE = 65536;
var UNIFROM_BLOCK_REGEXP = /uniform(?:\s+)(\w+)(?:\s?){([^]*?)}/g;
var Device_GL =
  /** @class */
  (function () {
    function Device_GL2(gl, configuration) {
      if (configuration === void 0) {
        configuration = {};
      }
      this.shaderDebug = false;
      this.OES_vertex_array_object = null;
      this.ANGLE_instanced_arrays = null;
      this.OES_texture_float = null;
      this.OES_draw_buffers_indexed = null;
      this.WEBGL_draw_buffers = null;
      this.WEBGL_depth_texture = null;
      this.WEBGL_color_buffer_float = null;
      this.EXT_color_buffer_half_float = null;
      this.WEBGL_compressed_texture_s3tc = null;
      this.WEBGL_compressed_texture_s3tc_srgb = null;
      this.EXT_texture_compression_rgtc = null;
      this.EXT_texture_filter_anisotropic = null;
      this.KHR_parallel_shader_compile = null;
      this.EXT_texture_norm16 = null;
      this.EXT_color_buffer_float = null;
      this.OES_texture_float_linear = null;
      this.OES_texture_half_float_linear = null;
      this.scTexture = null;
      this.scPlatformFramebuffer = null;
      this.currentActiveTexture = null;
      this.currentBoundVAO = null;
      this.currentProgram = null;
      this.resourceCreationTracker = null;
      this.resourceUniqueId = 0;
      this.currentColorAttachments = [];
      this.currentColorAttachmentLevels = [];
      this.currentColorResolveTos = [];
      this.currentColorResolveToLevels = [];
      this.currentSampleCount = -1;
      this.currentIndexBufferByteOffset = null;
      this.currentMegaState = copyMegaState(defaultMegaState);
      this.currentSamplers = [];
      this.currentTextures = [];
      this.currentUniformBuffers = [];
      this.currentUniformBufferByteOffsets = [];
      this.currentUniformBufferByteSizes = [];
      this.currentScissorEnabled = false;
      this.currentStencilRef = null;
      this.currentRenderPassDescriptor = null;
      this.currentRenderPassDescriptorStack = [];
      this.debugGroupStack = [];
      this.resolveColorAttachmentsChanged = false;
      this.resolveDepthStencilAttachmentsChanged = false;
      this.explicitBindingLocations = false;
      this.separateSamplerTextures = false;
      this.viewportOrigin = ViewportOrigin.LOWER_LEFT;
      this.clipSpaceNearZ = ClipSpaceNearZ.NEGATIVE_ONE;
      this.supportMRT = false;
      this.inBlitRenderPass = false;
      this.supportedSampleCounts = [];
      this.occlusionQueriesRecommended = false;
      this.computeShadersSupported = false;
      this.gl = gl;
      this.contextAttributes = assertExists(gl.getContextAttributes());
      if (!isWebGL2(gl)) {
        this.OES_vertex_array_object = gl.getExtension(
          'OES_vertex_array_object',
        );
        this.ANGLE_instanced_arrays = gl.getExtension('ANGLE_instanced_arrays');
        this.OES_texture_float = gl.getExtension('OES_texture_float');
        this.WEBGL_draw_buffers = gl.getExtension('WEBGL_draw_buffers');
        this.WEBGL_depth_texture = gl.getExtension('WEBGL_depth_texture');
        this.WEBGL_color_buffer_float = gl.getExtension(
          'WEBGL_color_buffer_float',
        );
        this.EXT_color_buffer_half_float = gl.getExtension(
          'EXT_color_buffer_half_float',
        );
        gl.getExtension('EXT_frag_depth');
        gl.getExtension('OES_element_index_uint');
        gl.getExtension('OES_standard_derivatives');
      } else {
        this.EXT_texture_norm16 = gl.getExtension('EXT_texture_norm16');
        this.EXT_color_buffer_float = gl.getExtension('EXT_color_buffer_float');
      }
      this.WEBGL_compressed_texture_s3tc = gl.getExtension(
        'WEBGL_compressed_texture_s3tc',
      );
      this.WEBGL_compressed_texture_s3tc_srgb = gl.getExtension(
        'WEBGL_compressed_texture_s3tc_srgb',
      );
      this.EXT_texture_compression_rgtc = gl.getExtension(
        'EXT_texture_compression_rgtc',
      );
      this.EXT_texture_filter_anisotropic = gl.getExtension(
        'EXT_texture_filter_anisotropic',
      );
      this.EXT_texture_norm16 = gl.getExtension('EXT_texture_norm16');
      this.OES_texture_float_linear = gl.getExtension(
        'OES_texture_float_linear',
      );
      this.OES_texture_half_float_linear = gl.getExtension(
        'OES_texture_half_float_linear',
      );
      this.KHR_parallel_shader_compile = gl.getExtension(
        'KHR_parallel_shader_compile',
      );
      if (isWebGL2(gl)) {
        this.platformString = 'WebGL2';
        this.glslVersion = '#version 300 es';
      } else {
        this.platformString = 'WebGL1';
        this.glslVersion = '#version 100';
      }
      this.scTexture = new Texture_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor: {
          width: 0,
          height: 0,
          depthOrArrayLayers: 1,
          dimension: TextureDimension.TEXTURE_2D,
          mipLevelCount: 1,
          usage: TextureUsage.RENDER_TARGET,
          format:
            this.contextAttributes.alpha === false
              ? Format.U8_RGB_RT
              : Format.U8_RGBA_RT,
        },
        fake: true,
      });
      this.scTexture.formatKind = SamplerFormatKind.Float;
      this.scTexture.gl_target = null;
      this.scTexture.gl_texture = null;
      this.resolveColorReadFramebuffer = this.ensureResourceExists(
        gl.createFramebuffer(),
      );
      this.resolveColorDrawFramebuffer = this.ensureResourceExists(
        gl.createFramebuffer(),
      );
      this.resolveDepthStencilReadFramebuffer = this.ensureResourceExists(
        gl.createFramebuffer(),
      );
      this.resolveDepthStencilDrawFramebuffer = this.ensureResourceExists(
        gl.createFramebuffer(),
      );
      this.renderPassDrawFramebuffer = this.ensureResourceExists(
        gl.createFramebuffer(),
      );
      this.readbackFramebuffer = this.ensureResourceExists(
        gl.createFramebuffer(),
      );
      this.fallbackTexture2D = this.createFallbackTexture(
        TextureDimension.TEXTURE_2D,
        SamplerFormatKind.Float,
      );
      this.fallbackTexture2DDepth = this.createFallbackTexture(
        TextureDimension.TEXTURE_2D,
        SamplerFormatKind.Depth,
      );
      this.fallbackVertexBuffer = this.createBuffer({
        viewOrSize: 1,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      if (isWebGL2(gl)) {
        this.fallbackTexture2DArray = this.createFallbackTexture(
          TextureDimension.TEXTURE_2D_ARRAY,
          SamplerFormatKind.Float,
        );
        this.fallbackTexture3D = this.createFallbackTexture(
          TextureDimension.TEXTURE_3D,
          SamplerFormatKind.Float,
        );
        this.fallbackTextureCube = this.createFallbackTexture(
          TextureDimension.TEXTURE_CUBE_MAP,
          SamplerFormatKind.Float,
        );
      }
      this.currentMegaState.depthCompare = CompareFunction.LESS;
      this.currentMegaState.depthWrite = false;
      this.currentMegaState.attachmentsState[0].channelWriteMask =
        ChannelWriteMask.ALL;
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.STENCIL_TEST);
      this.checkLimits();
      if (configuration.shaderDebug) {
        this.shaderDebug = true;
      }
      if (configuration.trackResources) {
        this.resourceCreationTracker = new ResourceCreationTracker();
      }
    }
    Device_GL2.prototype.destroy = function () {
      if (this.blitBindings) {
        this.blitBindings.destroy();
      }
      if (this.blitInputLayout) {
        this.blitInputLayout.destroy();
      }
      if (this.blitRenderPipeline) {
        this.blitRenderPipeline.destroy();
      }
      if (this.blitVertexBuffer) {
        this.blitVertexBuffer.destroy();
      }
      if (this.blitProgram) {
        this.blitProgram.destroy();
      }
    };
    Device_GL2.prototype.createFallbackTexture = function (
      dimension,
      formatKind,
    ) {
      var depthOrArrayLayers =
        dimension === TextureDimension.TEXTURE_CUBE_MAP ? 6 : 1;
      var format =
        formatKind === SamplerFormatKind.Depth
          ? Format.D32F
          : Format.U8_RGBA_NORM;
      var texture = this.createTexture({
        dimension,
        format,
        usage: TextureUsage.SAMPLED,
        width: 1,
        height: 1,
        depthOrArrayLayers,
        mipLevelCount: 1,
      });
      if (formatKind === SamplerFormatKind.Float) {
        texture.setImageData([new Uint8Array(4 * depthOrArrayLayers)]);
      }
      return getPlatformTexture(texture);
    };
    Device_GL2.prototype.getNextUniqueId = function () {
      return ++this.resourceUniqueId;
    };
    Device_GL2.prototype.checkLimits = function () {
      var gl = this.gl;
      this.maxVertexAttribs = gl.getParameter(GL.MAX_VERTEX_ATTRIBS);
      if (isWebGL2(gl)) {
        this.uniformBufferMaxPageByteSize = Math.min(
          gl.getParameter(GL.MAX_UNIFORM_BLOCK_SIZE),
          UBO_PAGE_MAX_BYTE_SIZE,
        );
        this.uniformBufferWordAlignment =
          gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT) / 4;
        var supportedSampleCounts = gl.getInternalformatParameter(
          gl.RENDERBUFFER,
          gl.DEPTH32F_STENCIL8,
          gl.SAMPLES,
        );
        this.supportedSampleCounts = supportedSampleCounts
          ? __spreadArray([], __read(supportedSampleCounts), false)
          : [];
        this.occlusionQueriesRecommended = true;
      } else {
        this.uniformBufferWordAlignment = 64;
        this.uniformBufferMaxPageByteSize = UBO_PAGE_MAX_BYTE_SIZE;
      }
      this.uniformBufferMaxPageWordSize = this.uniformBufferMaxPageByteSize / 4;
      if (!this.supportedSampleCounts.includes(1)) {
        this.supportedSampleCounts.push(1);
      }
      this.supportedSampleCounts.sort(function (a, b) {
        return a - b;
      });
    };
    Device_GL2.prototype.configureSwapChain = function (
      width,
      height,
      platformFramebuffer,
    ) {
      var texture = this.scTexture;
      texture.width = width;
      texture.height = height;
      this.scPlatformFramebuffer = nullify(platformFramebuffer);
    };
    Device_GL2.prototype.getDevice = function () {
      return this;
    };
    Device_GL2.prototype.getCanvas = function () {
      return this.gl.canvas;
    };
    Device_GL2.prototype.getOnscreenTexture = function () {
      return this.scTexture;
    };
    Device_GL2.prototype.beginFrame = function () {};
    Device_GL2.prototype.endFrame = function () {};
    Device_GL2.prototype.translateTextureInternalFormat = function (
      fmt,
      isRenderbufferStorage,
    ) {
      if (isRenderbufferStorage === void 0) {
        isRenderbufferStorage = false;
      }
      switch (fmt) {
        case Format.ALPHA:
          return GL.ALPHA;
        case Format.U8_LUMINANCE:
        case Format.F16_LUMINANCE:
        case Format.F32_LUMINANCE:
          return GL.LUMINANCE;
        case Format.F16_R:
          return GL.R16F;
        case Format.F16_RG:
          return GL.RG16F;
        case Format.F16_RGB:
          return GL.RGB16F;
        case Format.F16_RGBA:
          return GL.RGBA16F;
        case Format.F32_R:
          return GL.R32F;
        case Format.F32_RG:
          return GL.RG32F;
        case Format.F32_RGB:
          return GL.RGB32F;
        case Format.F32_RGBA:
          return isWebGL2(this.gl)
            ? GL.RGBA32F
            : isRenderbufferStorage
            ? this.WEBGL_color_buffer_float.RGBA32F_EXT
            : GL.RGBA;
        case Format.U8_R_NORM:
          return GL.R8;
        case Format.U8_RG_NORM:
          return GL.RG8;
        case Format.U8_RGB_NORM:
        case Format.U8_RGB_RT:
          return GL.RGB8;
        case Format.U8_RGB_SRGB:
          return GL.SRGB8;
        case Format.U8_RGBA_NORM:
        case Format.U8_RGBA_RT:
          return isWebGL2(this.gl)
            ? GL.RGBA8
            : isRenderbufferStorage
            ? GL.RGBA4
            : GL.RGBA;
        case Format.U8_RGBA:
          return GL.RGBA;
        case Format.U8_RGBA_SRGB:
        case Format.U8_RGBA_RT_SRGB:
          return GL.SRGB8_ALPHA8;
        case Format.U16_R:
          return GL.R16UI;
        case Format.U16_R_NORM:
          return this.EXT_texture_norm16.R16_EXT;
        case Format.U16_RG_NORM:
          return this.EXT_texture_norm16.RG16_EXT;
        case Format.U16_RGBA_NORM:
          return this.EXT_texture_norm16.RGBA16_EXT;
        case Format.U16_RGBA_5551:
          return GL.RGB5_A1;
        case Format.U16_RGB_565:
          return GL.RGB565;
        case Format.U32_R:
          return GL.R32UI;
        case Format.S8_RGBA_NORM:
          return GL.RGBA8_SNORM;
        case Format.S8_RG_NORM:
          return GL.RG8_SNORM;
        case Format.BC1:
          return this.WEBGL_compressed_texture_s3tc
            .COMPRESSED_RGBA_S3TC_DXT1_EXT;
        case Format.BC1_SRGB:
          return this.WEBGL_compressed_texture_s3tc_srgb
            .COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
        case Format.BC2:
          return this.WEBGL_compressed_texture_s3tc
            .COMPRESSED_RGBA_S3TC_DXT3_EXT;
        case Format.BC2_SRGB:
          return this.WEBGL_compressed_texture_s3tc_srgb
            .COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
        case Format.BC3:
          return this.WEBGL_compressed_texture_s3tc
            .COMPRESSED_RGBA_S3TC_DXT5_EXT;
        case Format.BC3_SRGB:
          return this.WEBGL_compressed_texture_s3tc_srgb
            .COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
        case Format.BC4_UNORM:
          return this.EXT_texture_compression_rgtc.COMPRESSED_RED_RGTC1_EXT;
        case Format.BC4_SNORM:
          return this.EXT_texture_compression_rgtc
            .COMPRESSED_SIGNED_RED_RGTC1_EXT;
        case Format.BC5_UNORM:
          return this.EXT_texture_compression_rgtc
            .COMPRESSED_RED_GREEN_RGTC2_EXT;
        case Format.BC5_SNORM:
          return this.EXT_texture_compression_rgtc
            .COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
        case Format.D32F_S8:
          return isWebGL2(this.gl)
            ? GL.DEPTH32F_STENCIL8
            : this.WEBGL_depth_texture
            ? GL.DEPTH_STENCIL
            : GL.DEPTH_COMPONENT16;
        case Format.D24_S8:
          return isWebGL2(this.gl)
            ? GL.DEPTH24_STENCIL8
            : this.WEBGL_depth_texture
            ? GL.DEPTH_STENCIL
            : GL.DEPTH_COMPONENT16;
        case Format.D32F:
          return isWebGL2(this.gl)
            ? GL.DEPTH_COMPONENT32F
            : this.WEBGL_depth_texture
            ? GL.DEPTH_COMPONENT
            : GL.DEPTH_COMPONENT16;
        case Format.D24:
          return isWebGL2(this.gl)
            ? GL.DEPTH_COMPONENT24
            : this.WEBGL_depth_texture
            ? GL.DEPTH_COMPONENT
            : GL.DEPTH_COMPONENT16;
        default:
          throw new Error('whoops');
      }
    };
    Device_GL2.prototype.translateTextureType = function (fmt) {
      var typeFlags = getFormatTypeFlags(fmt);
      switch (typeFlags) {
        case FormatTypeFlags.U8:
          return GL.UNSIGNED_BYTE;
        case FormatTypeFlags.U16:
          return GL.UNSIGNED_SHORT;
        case FormatTypeFlags.U32:
          return GL.UNSIGNED_INT;
        case FormatTypeFlags.S8:
          return GL.BYTE;
        case FormatTypeFlags.F16:
          return GL.HALF_FLOAT;
        case FormatTypeFlags.F32:
          return GL.FLOAT;
        case FormatTypeFlags.U16_PACKED_5551:
          return GL.UNSIGNED_SHORT_5_5_5_1;
        case FormatTypeFlags.D32F:
          return isWebGL2(this.gl)
            ? GL.FLOAT
            : this.WEBGL_depth_texture
            ? GL.UNSIGNED_INT
            : GL.UNSIGNED_BYTE;
        case FormatTypeFlags.D24:
          return isWebGL2(this.gl)
            ? GL.UNSIGNED_INT_24_8
            : this.WEBGL_depth_texture
            ? GL.UNSIGNED_SHORT
            : GL.UNSIGNED_BYTE;
        case FormatTypeFlags.D24S8:
          return isWebGL2(this.gl)
            ? GL.UNSIGNED_INT_24_8
            : this.WEBGL_depth_texture
            ? GL.UNSIGNED_INT_24_8_WEBGL
            : GL.UNSIGNED_BYTE;
        case FormatTypeFlags.D32FS8:
          return GL.FLOAT_32_UNSIGNED_INT_24_8_REV;
        default:
          throw new Error('whoops');
      }
    };
    Device_GL2.prototype.translateInternalTextureFormat = function (fmt) {
      switch (fmt) {
        case Format.F32_R:
          return GL.R32F;
        case Format.F32_RG:
          return GL.RG32F;
        case Format.F32_RGB:
          return GL.RGB32F;
        case Format.F32_RGBA:
          return GL.RGBA32F;
        case Format.F16_R:
          return GL.R16F;
        case Format.F16_RG:
          return GL.RG16F;
        case Format.F16_RGB:
          return GL.RGB16F;
        case Format.F16_RGBA:
          return GL.RGBA16F;
      }
      return this.translateTextureFormat(fmt);
    };
    Device_GL2.prototype.translateTextureFormat = function (fmt) {
      if (
        isTextureFormatCompressed(fmt) ||
        fmt === Format.F32_LUMINANCE ||
        fmt === Format.U8_LUMINANCE
      ) {
        return this.translateTextureInternalFormat(fmt);
      }
      var supportDepthTexture =
        isWebGL2(this.gl) || (!isWebGL2(this.gl) && !!this.WEBGL_depth_texture);
      switch (fmt) {
        case Format.D24_S8:
        case Format.D32F_S8:
          return supportDepthTexture ? GL.DEPTH_STENCIL : GL.RGBA;
        case Format.D24:
        case Format.D32F:
          return supportDepthTexture ? GL.DEPTH_COMPONENT : GL.RGBA;
      }
      var isInteger2 = isFormatSizedInteger(fmt);
      var compFlags = getFormatCompFlags(fmt);
      switch (compFlags) {
        case FormatCompFlags.A:
          return GL.ALPHA;
        case FormatCompFlags.R:
          return isInteger2 ? GL.RED_INTEGER : GL.RED;
        case FormatCompFlags.RG:
          return isInteger2 ? GL.RG_INTEGER : GL.RG;
        case FormatCompFlags.RGB:
          return isInteger2 ? GL.RGB_INTEGER : GL.RGB;
        case FormatCompFlags.RGBA:
          return GL.RGBA;
      }
    };
    Device_GL2.prototype.setActiveTexture = function (texture) {
      if (this.currentActiveTexture !== texture) {
        this.gl.activeTexture(texture);
        this.currentActiveTexture = texture;
      }
    };
    Device_GL2.prototype.bindVAO = function (vao) {
      if (this.currentBoundVAO !== vao) {
        if (isWebGL2(this.gl)) {
          this.gl.bindVertexArray(vao);
        } else {
          this.OES_vertex_array_object.bindVertexArrayOES(vao);
        }
        this.currentBoundVAO = vao;
      }
    };
    Device_GL2.prototype.programCompiled = function (program) {
      assert(program.compileState !== ProgramCompileState_GL.NeedsCompile);
      if (program.compileState === ProgramCompileState_GL.Compiling) {
        program.compileState = ProgramCompileState_GL.NeedsBind;
        if (this.shaderDebug) {
          this.checkProgramCompilationForErrors(program);
        }
      }
    };
    Device_GL2.prototype.useProgram = function (program) {
      if (this.currentProgram === program) return;
      this.programCompiled(program);
      this.gl.useProgram(program.gl_program);
      this.currentProgram = program;
    };
    Device_GL2.prototype.ensureResourceExists = function (resource) {
      if (resource === null) {
        var error = this.gl.getError();
        throw new Error(
          'Created resource is null; GL error encountered: '.concat(error),
        );
      } else {
        return resource;
      }
    };
    Device_GL2.prototype.createBuffer = function (descriptor) {
      return new Buffer_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createTexture = function (descriptor) {
      return new Texture_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createSampler = function (descriptor) {
      return new Sampler_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createRenderTarget = function (descriptor) {
      return new RenderTarget_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createRenderTargetFromTexture = function (texture) {
      var _a2 = texture,
        format = _a2.format,
        width = _a2.width,
        height = _a2.height,
        mipLevelCount = _a2.mipLevelCount;
      assert(mipLevelCount === 1);
      return this.createRenderTarget({
        format,
        width,
        height,
        sampleCount: 1,
        texture,
      });
    };
    Device_GL2.prototype.createProgram = function (descriptor) {
      var _a2, _b, _c;
      var rawVertexGLSL =
        (_a2 = descriptor.vertex) === null || _a2 === void 0
          ? void 0
          : _a2.glsl;
      if (
        (_b = descriptor.vertex) === null || _b === void 0 ? void 0 : _b.glsl
      ) {
        descriptor.vertex.glsl = preprocessShader_GLSL(
          this.queryVendorInfo(),
          'vert',
          descriptor.vertex.glsl,
        );
      }
      if (
        (_c = descriptor.fragment) === null || _c === void 0 ? void 0 : _c.glsl
      ) {
        descriptor.fragment.glsl = preprocessShader_GLSL(
          this.queryVendorInfo(),
          'frag',
          descriptor.fragment.glsl,
        );
      }
      return this.createProgramSimple(descriptor, rawVertexGLSL);
    };
    Device_GL2.prototype.createProgramSimple = function (
      descriptor,
      rawVertexGLSL,
    ) {
      var program = new Program_GL(
        {
          id: this.getNextUniqueId(),
          device: this,
          descriptor,
        },
        rawVertexGLSL,
      );
      return program;
    };
    Device_GL2.prototype.createBindings = function (descriptor) {
      return new Bindings_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createInputLayout = function (descriptor) {
      return new InputLayout_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createRenderPipeline = function (descriptor) {
      return new RenderPipeline_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createComputePass = function () {
      return new ComputePass_GL();
    };
    Device_GL2.prototype.createComputePipeline = function (descriptor) {
      return new ComputePipeline_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_GL2.prototype.createReadback = function () {
      return new Readback_GL({
        id: this.getNextUniqueId(),
        device: this,
      });
    };
    Device_GL2.prototype.createQueryPool = function (type, elemCount) {
      return new QueryPool_GL({
        id: this.getNextUniqueId(),
        device: this,
        descriptor: {
          type,
          elemCount,
        },
      });
    };
    Device_GL2.prototype.formatRenderPassDescriptor = function (descriptor) {
      var _a2, _b, _c, _d, _e, _f;
      var colorAttachment = descriptor.colorAttachment;
      descriptor.depthClearValue =
        (_a2 = descriptor.depthClearValue) !== null && _a2 !== void 0
          ? _a2
          : 'load';
      descriptor.stencilClearValue =
        (_b = descriptor.stencilClearValue) !== null && _b !== void 0
          ? _b
          : 'load';
      for (var i = 0; i < colorAttachment.length; i++) {
        if (!descriptor.colorAttachmentLevel) {
          descriptor.colorAttachmentLevel = [];
        }
        descriptor.colorAttachmentLevel[i] =
          (_c = descriptor.colorAttachmentLevel[i]) !== null && _c !== void 0
            ? _c
            : 0;
        if (!descriptor.colorResolveToLevel) {
          descriptor.colorResolveToLevel = [];
        }
        descriptor.colorResolveToLevel[i] =
          (_d = descriptor.colorResolveToLevel[i]) !== null && _d !== void 0
            ? _d
            : 0;
        if (!descriptor.colorClearColor) {
          descriptor.colorClearColor = [];
        }
        descriptor.colorClearColor[i] =
          (_e = descriptor.colorClearColor[i]) !== null && _e !== void 0
            ? _e
            : 'load';
        if (!descriptor.colorStore) {
          descriptor.colorStore = [];
        }
        descriptor.colorStore[i] =
          (_f = descriptor.colorStore[i]) !== null && _f !== void 0
            ? _f
            : false;
      }
    };
    Device_GL2.prototype.createRenderBundle = function () {
      return new RenderBundle_GL({
        id: this.getNextUniqueId(),
        device: this,
      });
    };
    Device_GL2.prototype.beginBundle = function (bundle) {
      this.renderBundle = bundle;
    };
    Device_GL2.prototype.endBundle = function () {
      this.renderBundle = void 0;
    };
    Device_GL2.prototype.executeBundles = function (renderBundles) {
      renderBundles.forEach(function (renderBundle) {
        renderBundle.replay();
      });
    };
    Device_GL2.prototype.createRenderPass = function (descriptor) {
      if (this.currentRenderPassDescriptor !== null) {
        this.currentRenderPassDescriptorStack.push(
          this.currentRenderPassDescriptor,
        );
      }
      this.currentRenderPassDescriptor = descriptor;
      this.formatRenderPassDescriptor(descriptor);
      var colorAttachment = descriptor.colorAttachment,
        colorAttachmentLevel = descriptor.colorAttachmentLevel,
        colorClearColor = descriptor.colorClearColor,
        colorResolveTo = descriptor.colorResolveTo,
        colorResolveToLevel = descriptor.colorResolveToLevel,
        depthStencilAttachment = descriptor.depthStencilAttachment,
        depthClearValue = descriptor.depthClearValue,
        stencilClearValue = descriptor.stencilClearValue,
        depthStencilResolveTo = descriptor.depthStencilResolveTo;
      this.setRenderPassParametersBegin(colorAttachment.length);
      for (var i = 0; i < colorAttachment.length; i++) {
        this.setRenderPassParametersColor(
          i,
          colorAttachment[i],
          colorAttachmentLevel[i],
          colorResolveTo[i],
          colorResolveToLevel[i],
        );
      }
      this.setRenderPassParametersDepthStencil(
        depthStencilAttachment,
        depthStencilResolveTo,
      );
      this.validateCurrentAttachments();
      for (var i = 0; i < colorAttachment.length; i++) {
        var clearColor = colorClearColor[i];
        if (clearColor === 'load') continue;
        this.setRenderPassParametersClearColor(
          i,
          clearColor.r,
          clearColor.g,
          clearColor.b,
          clearColor.a,
        );
      }
      this.setRenderPassParametersClearDepthStencil(
        depthClearValue,
        stencilClearValue,
      );
      return this;
    };
    Device_GL2.prototype.submitPass = function (pass) {
      assert(this.currentRenderPassDescriptor !== null);
      this.endPass();
      if (this.currentRenderPassDescriptorStack.length) {
        this.currentRenderPassDescriptor =
          this.currentRenderPassDescriptorStack.pop();
      } else {
        this.currentRenderPassDescriptor = null;
      }
    };
    Device_GL2.prototype.copySubTexture2D = function (
      dst_,
      dstX,
      dstY,
      src_,
      srcX,
      srcY,
    ) {
      var gl = this.gl;
      var dst = dst_;
      var src = src_;
      assert(src.mipLevelCount === 1);
      assert(dst.mipLevelCount === 1);
      if (isWebGL2(gl)) {
        if (dst === this.scTexture) {
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scPlatformFramebuffer);
        } else {
          gl.bindFramebuffer(
            gl.DRAW_FRAMEBUFFER,
            this.resolveColorDrawFramebuffer,
          );
          this.bindFramebufferAttachment(
            gl.DRAW_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            dst,
            0,
          );
        }
        gl.bindFramebuffer(
          gl.READ_FRAMEBUFFER,
          this.resolveColorReadFramebuffer,
        );
        this.bindFramebufferAttachment(
          gl.READ_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          src,
          0,
        );
        gl.blitFramebuffer(
          srcX,
          srcY,
          srcX + src.width,
          srcY + src.height,
          dstX,
          dstY,
          dstX + src.width,
          dstY + src.height,
          gl.COLOR_BUFFER_BIT,
          gl.LINEAR,
        );
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      } else {
        if (dst === this.scTexture) {
          var rt = this.createRenderTargetFromTexture(src_);
          this.submitBlitRenderPass(rt, dst);
        }
      }
    };
    Device_GL2.prototype.queryLimits = function () {
      return this;
    };
    Device_GL2.prototype.queryTextureFormatSupported = function (
      format,
      width,
      height,
    ) {
      switch (format) {
        case Format.BC1_SRGB:
        case Format.BC2_SRGB:
        case Format.BC3_SRGB:
          if (this.WEBGL_compressed_texture_s3tc_srgb !== null)
            return isBlockCompressSized(width, height, 4, 4);
          return false;
        case Format.BC1:
        case Format.BC2:
        case Format.BC3:
          if (this.WEBGL_compressed_texture_s3tc !== null)
            return isBlockCompressSized(width, height, 4, 4);
          return false;
        case Format.BC4_UNORM:
        case Format.BC4_SNORM:
        case Format.BC5_UNORM:
        case Format.BC5_SNORM:
          if (this.EXT_texture_compression_rgtc !== null)
            return isBlockCompressSized(width, height, 4, 4);
          return false;
        case Format.U16_R_NORM:
        case Format.U16_RG_NORM:
        case Format.U16_RGBA_NORM:
          return this.EXT_texture_norm16 !== null;
        case Format.F32_R:
        case Format.F32_RG:
        case Format.F32_RGB:
        case Format.F32_RGBA:
          return this.OES_texture_float_linear !== null;
        case Format.F16_R:
        case Format.F16_RG:
        case Format.F16_RGB:
        case Format.F16_RGBA:
          return this.OES_texture_half_float_linear !== null;
        default:
          return true;
      }
    };
    Device_GL2.prototype.queryProgramReady = function (program) {
      var gl = this.gl;
      if (program.compileState === ProgramCompileState_GL.NeedsCompile) {
        throw new Error('whoops');
      }
      if (program.compileState === ProgramCompileState_GL.Compiling) {
        var complete = void 0;
        if (this.KHR_parallel_shader_compile !== null) {
          complete = gl.getProgramParameter(
            program.gl_program,
            this.KHR_parallel_shader_compile.COMPLETION_STATUS_KHR,
          );
        } else {
          complete = true;
        }
        if (complete) {
          this.programCompiled(program);
        }
        return complete;
      }
      return (
        program.compileState === ProgramCompileState_GL.NeedsBind ||
        program.compileState === ProgramCompileState_GL.ReadyToUse
      );
    };
    Device_GL2.prototype.queryPlatformAvailable = function () {
      return this.gl.isContextLost();
    };
    Device_GL2.prototype.queryVendorInfo = function () {
      return this;
    };
    Device_GL2.prototype.queryRenderPass = function (o) {
      return this.currentRenderPassDescriptor;
    };
    Device_GL2.prototype.queryRenderTarget = function (o) {
      var renderTarget = o;
      return renderTarget;
    };
    Device_GL2.prototype.setResourceName = function (o, name) {
      o.name = name;
      if (o.type === ResourceType.Buffer) {
        var gl_buffer_pages = o.gl_buffer_pages;
        for (var i = 0; i < gl_buffer_pages.length; i++)
          assignPlatformName(
            gl_buffer_pages[i],
            ''.concat(name, ' Page ').concat(i),
          );
      } else if (o.type === ResourceType.Texture) {
        assignPlatformName(getPlatformTexture(o), name);
      } else if (o.type === ResourceType.Sampler) {
        assignPlatformName(getPlatformSampler$1(o), name);
      } else if (o.type === ResourceType.RenderTarget) {
        var gl_renderbuffer = o.gl_renderbuffer;
        if (gl_renderbuffer !== null) assignPlatformName(gl_renderbuffer, name);
      } else if (o.type === ResourceType.InputLayout) {
        assignPlatformName(o.vao, name);
      }
    };
    Device_GL2.prototype.setResourceLeakCheck = function (o, v) {
      if (this.resourceCreationTracker !== null)
        this.resourceCreationTracker.setResourceLeakCheck(o, v);
    };
    Device_GL2.prototype.checkForLeaks = function () {
      if (this.resourceCreationTracker !== null)
        this.resourceCreationTracker.checkForLeaks();
    };
    Device_GL2.prototype.pushDebugGroup = function (name) {};
    Device_GL2.prototype.popDebugGroup = function () {};
    Device_GL2.prototype.insertDebugMarker = function (markerLabel) {};
    Device_GL2.prototype.programPatched = function (o, descriptor) {
      assert(this.shaderDebug);
    };
    Device_GL2.prototype.getBufferData = function (
      buffer,
      dstBuffer,
      wordOffset,
    ) {
      if (wordOffset === void 0) {
        wordOffset = 0;
      }
      var gl = this.gl;
      if (isWebGL2(gl)) {
        gl.bindBuffer(
          gl.COPY_READ_BUFFER,
          getPlatformBuffer$1(buffer, wordOffset * 4),
        );
        gl.getBufferSubData(gl.COPY_READ_BUFFER, wordOffset * 4, dstBuffer);
      }
    };
    Device_GL2.prototype.debugGroupStatisticsDrawCall = function (count) {
      if (count === void 0) {
        count = 1;
      }
      for (var i = this.debugGroupStack.length - 1; i >= 0; i--)
        this.debugGroupStack[i].drawCallCount += count;
    };
    Device_GL2.prototype.debugGroupStatisticsBufferUpload = function (count) {
      if (count === void 0) {
        count = 1;
      }
      for (var i = this.debugGroupStack.length - 1; i >= 0; i--)
        this.debugGroupStack[i].bufferUploadCount += count;
    };
    Device_GL2.prototype.debugGroupStatisticsTextureBind = function (count) {
      if (count === void 0) {
        count = 1;
      }
      for (var i = this.debugGroupStack.length - 1; i >= 0; i--)
        this.debugGroupStack[i].textureBindCount += count;
    };
    Device_GL2.prototype.debugGroupStatisticsTriangles = function (count) {
      for (var i = this.debugGroupStack.length - 1; i >= 0; i--)
        this.debugGroupStack[i].triangleCount += count;
    };
    Device_GL2.prototype.reportShaderError = function (shader, str) {
      var gl = this.gl;
      var status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      if (!status) {
        console.error(prependLineNo(str));
        var debug_shaders = gl.getExtension('WEBGL_debug_shaders');
        if (debug_shaders)
          console.error(debug_shaders.getTranslatedShaderSource(shader));
        console.error(gl.getShaderInfoLog(shader));
      }
      return status;
    };
    Device_GL2.prototype.checkProgramCompilationForErrors = function (program) {
      var gl = this.gl;
      var prog = program.gl_program;
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        var descriptor = program.descriptor;
        if (
          !this.reportShaderError(
            program.gl_shader_vert,
            descriptor.vertex.glsl,
          )
        )
          return;
        if (
          !this.reportShaderError(
            program.gl_shader_frag,
            descriptor.fragment.glsl,
          )
        )
          return;
        console.error(gl.getProgramInfoLog(program.gl_program));
      }
    };
    Device_GL2.prototype.bindFramebufferAttachment = function (
      framebuffer,
      binding,
      attachment,
      level,
    ) {
      var gl = this.gl;
      if (is_nil_default(attachment)) {
        gl.framebufferRenderbuffer(framebuffer, binding, gl.RENDERBUFFER, null);
      } else if (attachment.type === ResourceType.RenderTarget) {
        if (attachment.gl_renderbuffer !== null) {
          gl.framebufferRenderbuffer(
            framebuffer,
            binding,
            gl.RENDERBUFFER,
            attachment.gl_renderbuffer,
          );
        } else if (attachment.texture !== null) {
          gl.framebufferTexture2D(
            framebuffer,
            binding,
            GL.TEXTURE_2D,
            getPlatformTexture(attachment.texture),
            level,
          );
        }
      } else if (attachment.type === ResourceType.Texture) {
        var texture = getPlatformTexture(attachment);
        if (attachment.dimension === TextureDimension.TEXTURE_2D) {
          gl.framebufferTexture2D(
            framebuffer,
            binding,
            GL.TEXTURE_2D,
            texture,
            level,
          );
        } else if (
          isWebGL2(gl) &&
          attachment.dimension === TextureDimension.TEXTURE_2D_ARRAY
        );
      }
    };
    Device_GL2.prototype.bindFramebufferDepthStencilAttachment = function (
      framebuffer,
      attachment,
    ) {
      var gl = this.gl;
      var flags = !is_nil_default(attachment)
        ? getFormatFlags(attachment.format)
        : FormatFlags.Depth | FormatFlags.Stencil;
      var depth = !!(flags & FormatFlags.Depth);
      var stencil = !!(flags & FormatFlags.Stencil);
      if (depth && stencil) {
        var supportDepthTexture =
          isWebGL2(this.gl) ||
          (!isWebGL2(this.gl) && !!this.WEBGL_depth_texture);
        if (supportDepthTexture) {
          this.bindFramebufferAttachment(
            framebuffer,
            gl.DEPTH_STENCIL_ATTACHMENT,
            attachment,
            0,
          );
        } else {
          this.bindFramebufferAttachment(
            framebuffer,
            gl.DEPTH_ATTACHMENT,
            attachment,
            0,
          );
        }
      } else if (depth) {
        this.bindFramebufferAttachment(
          framebuffer,
          gl.DEPTH_ATTACHMENT,
          attachment,
          0,
        );
        this.bindFramebufferAttachment(
          framebuffer,
          gl.STENCIL_ATTACHMENT,
          null,
          0,
        );
      } else if (stencil) {
        this.bindFramebufferAttachment(
          framebuffer,
          gl.STENCIL_ATTACHMENT,
          attachment,
          0,
        );
        this.bindFramebufferAttachment(
          framebuffer,
          gl.DEPTH_ATTACHMENT,
          null,
          0,
        );
      }
    };
    Device_GL2.prototype.validateCurrentAttachments = function () {
      var sampleCount = -1,
        width = -1,
        height = -1;
      for (var i = 0; i < this.currentColorAttachments.length; i++) {
        var attachment = this.currentColorAttachments[i];
        if (attachment === null) continue;
        if (sampleCount === -1) {
          sampleCount = attachment.sampleCount;
          width = attachment.width;
          height = attachment.height;
        } else {
          assert(sampleCount === attachment.sampleCount);
          assert(width === attachment.width);
          assert(height === attachment.height);
        }
      }
      if (this.currentDepthStencilAttachment) {
        if (sampleCount === -1) {
          sampleCount = this.currentDepthStencilAttachment.sampleCount;
        } else {
          assert(
            sampleCount === this.currentDepthStencilAttachment.sampleCount,
          );
          assert(width === this.currentDepthStencilAttachment.width);
          assert(height === this.currentDepthStencilAttachment.height);
        }
      }
      this.currentSampleCount = sampleCount;
    };
    Device_GL2.prototype.setRenderPassParametersBegin = function (
      numColorAttachments,
    ) {
      var gl = this.gl;
      if (isWebGL2(gl)) {
        gl.bindFramebuffer(GL.DRAW_FRAMEBUFFER, this.renderPassDrawFramebuffer);
      } else {
        if (!this.inBlitRenderPass) {
          gl.bindFramebuffer(GL.FRAMEBUFFER, this.renderPassDrawFramebuffer);
        }
      }
      if (isWebGL2(gl)) {
        gl.drawBuffers([
          GL.COLOR_ATTACHMENT0,
          GL.COLOR_ATTACHMENT1,
          GL.COLOR_ATTACHMENT2,
          GL.COLOR_ATTACHMENT3,
        ]);
      } else {
        if (!this.inBlitRenderPass && this.WEBGL_draw_buffers) {
          this.WEBGL_draw_buffers.drawBuffersWEBGL([
            GL.COLOR_ATTACHMENT0_WEBGL,
            GL.COLOR_ATTACHMENT1_WEBGL,
            GL.COLOR_ATTACHMENT2_WEBGL,
            GL.COLOR_ATTACHMENT3_WEBGL,
            // gl_FragData[3]
          ]);
        }
      }
      if (!this.inBlitRenderPass) {
        for (
          var i = numColorAttachments;
          i < this.currentColorAttachments.length;
          i++
        ) {
          var target = isWebGL2(gl) ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER;
          var attachment = isWebGL2(gl)
            ? GL.COLOR_ATTACHMENT0
            : GL.COLOR_ATTACHMENT0_WEBGL;
          gl.framebufferRenderbuffer(
            target,
            attachment + i,
            GL.RENDERBUFFER,
            null,
          );
          gl.framebufferTexture2D(
            target,
            attachment + i,
            GL.TEXTURE_2D,
            null,
            0,
          );
        }
      }
      this.currentColorAttachments.length = numColorAttachments;
    };
    Device_GL2.prototype.setRenderPassParametersColor = function (
      i,
      colorAttachment,
      attachmentLevel,
      colorResolveTo,
      resolveToLevel,
    ) {
      var gl = this.gl;
      var gl2 = isWebGL2(gl);
      if (
        this.currentColorAttachments[i] !== colorAttachment ||
        this.currentColorAttachmentLevels[i] !== attachmentLevel
      ) {
        this.currentColorAttachments[i] = colorAttachment;
        this.currentColorAttachmentLevels[i] = attachmentLevel;
        if (gl2 || (!gl2 && this.WEBGL_draw_buffers)) {
          this.bindFramebufferAttachment(
            gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
            (gl2 ? GL.COLOR_ATTACHMENT0 : GL.COLOR_ATTACHMENT0_WEBGL) + i,
            colorAttachment,
            attachmentLevel,
          );
        }
        this.resolveColorAttachmentsChanged = true;
      }
      if (
        this.currentColorResolveTos[i] !== colorResolveTo ||
        this.currentColorResolveToLevels[i] !== resolveToLevel
      ) {
        this.currentColorResolveTos[i] = colorResolveTo;
        this.currentColorResolveToLevels[i] = resolveToLevel;
        if (colorResolveTo !== null) {
          this.resolveColorAttachmentsChanged = true;
        }
      }
    };
    Device_GL2.prototype.setRenderPassParametersDepthStencil = function (
      depthStencilAttachment,
      depthStencilResolveTo,
    ) {
      var gl = this.gl;
      if (this.currentDepthStencilAttachment !== depthStencilAttachment) {
        this.currentDepthStencilAttachment = depthStencilAttachment;
        if (!this.inBlitRenderPass) {
          this.bindFramebufferDepthStencilAttachment(
            isWebGL2(gl) ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
            this.currentDepthStencilAttachment,
          );
        }
        this.resolveDepthStencilAttachmentsChanged = true;
      }
      if (this.currentDepthStencilResolveTo !== depthStencilResolveTo) {
        this.currentDepthStencilResolveTo = depthStencilResolveTo;
        if (depthStencilResolveTo) {
          this.resolveDepthStencilAttachmentsChanged = true;
        }
      }
    };
    Device_GL2.prototype.setRenderPassParametersClearColor = function (
      slot,
      r,
      g,
      b,
      a,
    ) {
      var gl = this.gl;
      if (this.OES_draw_buffers_indexed !== null) {
        var attachment = this.currentMegaState.attachmentsState[slot];
        if (
          attachment &&
          attachment.channelWriteMask !== ChannelWriteMask.ALL
        ) {
          this.OES_draw_buffers_indexed.colorMaskiOES(
            slot,
            true,
            true,
            true,
            true,
          );
          attachment.channelWriteMask = ChannelWriteMask.ALL;
        }
      } else {
        var attachment = this.currentMegaState.attachmentsState[0];
        if (
          attachment &&
          attachment.channelWriteMask !== ChannelWriteMask.ALL
        ) {
          gl.colorMask(true, true, true, true);
          attachment.channelWriteMask = ChannelWriteMask.ALL;
        }
      }
      this.setScissorRectEnabled(false);
      if (isWebGL2(gl)) {
        gl.clearBufferfv(gl.COLOR, slot, [r, g, b, a]);
      } else {
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    };
    Device_GL2.prototype.setRenderPassParametersClearDepthStencil = function (
      depthClearValue,
      stencilClearValue,
    ) {
      if (depthClearValue === void 0) {
        depthClearValue = 'load';
      }
      if (stencilClearValue === void 0) {
        stencilClearValue = 'load';
      }
      var gl = this.gl;
      if (depthClearValue !== 'load') {
        assert(!!this.currentDepthStencilAttachment);
        if (!this.currentMegaState.depthWrite) {
          gl.depthMask(true);
          this.currentMegaState.depthWrite = true;
        }
        if (isWebGL2(gl)) {
          gl.clearBufferfv(gl.DEPTH, 0, [depthClearValue]);
        } else {
          gl.clearDepth(depthClearValue);
          gl.clear(gl.DEPTH_BUFFER_BIT);
        }
      }
      if (stencilClearValue !== 'load') {
        assert(!!this.currentDepthStencilAttachment);
        if (!this.currentMegaState.stencilWrite) {
          gl.enable(gl.STENCIL_TEST);
          gl.stencilMask(255);
          this.currentMegaState.stencilWrite = true;
        }
        if (isWebGL2(gl)) {
          gl.clearBufferiv(gl.STENCIL, 0, [stencilClearValue]);
        } else {
          gl.clearStencil(stencilClearValue);
          gl.clear(gl.STENCIL_BUFFER_BIT);
        }
      }
    };
    Device_GL2.prototype.setBindings = function (bindings_) {
      var _this = this;
      var _a2;
      if (this.renderBundle) {
        this.renderBundle.push(function () {
          return _this.setBindings(bindings_);
        });
        return;
      }
      var gl = this.gl;
      var _b = bindings_,
        uniformBufferBindings = _b.uniformBufferBindings,
        samplerBindings = _b.samplerBindings,
        bindingLayouts = _b.bindingLayouts;
      assert(0 < bindingLayouts.bindingLayoutTables.length);
      var bindingLayoutTable = bindingLayouts.bindingLayoutTables[0];
      assert(
        uniformBufferBindings.length >= bindingLayoutTable.numUniformBuffers,
      );
      assert(samplerBindings.length >= bindingLayoutTable.numSamplers);
      for (var i = 0; i < uniformBufferBindings.length; i++) {
        var binding = uniformBufferBindings[i];
        if (binding.size === 0) continue;
        var index = bindingLayoutTable.firstUniformBuffer + i;
        var buffer = binding.buffer;
        var byteOffset = binding.offset || 0;
        var byteSize = binding.size || buffer.byteSize;
        if (
          buffer !== this.currentUniformBuffers[index] ||
          byteOffset !== this.currentUniformBufferByteOffsets[index] ||
          byteSize !== this.currentUniformBufferByteSizes[index]
        ) {
          var platformBufferByteOffset = byteOffset % buffer.pageByteSize;
          var platformBuffer =
            buffer.gl_buffer_pages[(byteOffset / buffer.pageByteSize) | 0];
          assert(platformBufferByteOffset + byteSize <= buffer.pageByteSize);
          if (isWebGL2(gl)) {
            gl.bindBufferRange(
              gl.UNIFORM_BUFFER,
              index,
              platformBuffer,
              platformBufferByteOffset,
              byteSize,
            );
          }
          this.currentUniformBuffers[index] = buffer;
          this.currentUniformBufferByteOffsets[index] = byteOffset;
          this.currentUniformBufferByteSizes[index] = byteSize;
        }
      }
      for (var i = 0; i < bindingLayoutTable.numSamplers; i++) {
        var binding = samplerBindings[i];
        var samplerIndex = bindingLayoutTable.firstSampler + i;
        var gl_sampler =
          binding !== null && binding.sampler !== null
            ? getPlatformSampler$1(binding.sampler)
            : null;
        var gl_texture =
          binding !== null && binding.texture !== null
            ? getPlatformTexture(binding.texture)
            : null;
        if (this.currentSamplers[samplerIndex] !== gl_sampler) {
          if (isWebGL2(gl)) {
            gl.bindSampler(samplerIndex, gl_sampler);
          }
          this.currentSamplers[samplerIndex] = gl_sampler;
        }
        if (this.currentTextures[samplerIndex] !== gl_texture) {
          this.setActiveTexture(gl.TEXTURE0 + samplerIndex);
          if (gl_texture !== null) {
            var _c = assertExists(binding).texture,
              gl_target = _c.gl_target,
              width = _c.width,
              height = _c.height;
            binding.texture.textureIndex = samplerIndex;
            gl.bindTexture(gl_target, gl_texture);
            if (!isWebGL2(gl)) {
              (_a2 = binding.sampler) === null || _a2 === void 0
                ? void 0
                : _a2.setTextureParameters(gl_target, width, height);
            }
            this.debugGroupStatisticsTextureBind();
          } else {
            var samplerEntry = __assign(
              __assign({}, binding),
              defaultBindingLayoutSamplerDescriptor,
            );
            var dimension = samplerEntry.dimension,
              formatKind = samplerEntry.formatKind;
            var gl_target = translateTextureDimension$1(dimension);
            gl.bindTexture(
              gl_target,
              this.getFallbackTexture(
                __assign({ gl_target, formatKind }, samplerEntry),
              ),
            );
          }
          this.currentTextures[samplerIndex] = gl_texture;
        }
      }
    };
    Device_GL2.prototype.setViewport = function (x, y, w, h) {
      var gl = this.gl;
      gl.viewport(x, y, w, h);
    };
    Device_GL2.prototype.setScissorRect = function (x, y, w, h) {
      var gl = this.gl;
      this.setScissorRectEnabled(true);
      gl.scissor(x, y, w, h);
    };
    Device_GL2.prototype.applyAttachmentStateIndexed = function (
      i,
      currentAttachmentState,
      newAttachmentState,
    ) {
      var gl = this.gl;
      var dbi = this.OES_draw_buffers_indexed;
      if (
        currentAttachmentState.channelWriteMask !==
        newAttachmentState.channelWriteMask
      ) {
        dbi.colorMaskiOES(
          i,
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.RED),
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.GREEN),
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.BLUE),
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.ALPHA),
        );
        currentAttachmentState.channelWriteMask =
          newAttachmentState.channelWriteMask;
      }
      var blendModeChanged =
        currentAttachmentState.rgbBlendState.blendMode !==
          newAttachmentState.rgbBlendState.blendMode ||
        currentAttachmentState.alphaBlendState.blendMode !==
          newAttachmentState.alphaBlendState.blendMode;
      var blendFuncChanged =
        currentAttachmentState.rgbBlendState.blendSrcFactor !==
          newAttachmentState.rgbBlendState.blendSrcFactor ||
        currentAttachmentState.alphaBlendState.blendSrcFactor !==
          newAttachmentState.alphaBlendState.blendSrcFactor ||
        currentAttachmentState.rgbBlendState.blendDstFactor !==
          newAttachmentState.rgbBlendState.blendDstFactor ||
        currentAttachmentState.alphaBlendState.blendDstFactor !==
          newAttachmentState.alphaBlendState.blendDstFactor;
      if (blendFuncChanged || blendModeChanged) {
        if (
          isBlendStateNone(currentAttachmentState.rgbBlendState) &&
          isBlendStateNone(currentAttachmentState.alphaBlendState)
        )
          dbi.enableiOES(i, gl.BLEND);
        else if (
          isBlendStateNone(newAttachmentState.rgbBlendState) &&
          isBlendStateNone(newAttachmentState.alphaBlendState)
        )
          dbi.disableiOES(i, gl.BLEND);
      }
      if (blendModeChanged) {
        dbi.blendEquationSeparateiOES(
          i,
          newAttachmentState.rgbBlendState.blendMode,
          newAttachmentState.alphaBlendState.blendMode,
        );
        currentAttachmentState.rgbBlendState.blendMode =
          newAttachmentState.rgbBlendState.blendMode;
        currentAttachmentState.alphaBlendState.blendMode =
          newAttachmentState.alphaBlendState.blendMode;
      }
      if (blendFuncChanged) {
        dbi.blendFuncSeparateiOES(
          i,
          newAttachmentState.rgbBlendState.blendSrcFactor,
          newAttachmentState.rgbBlendState.blendDstFactor,
          newAttachmentState.alphaBlendState.blendSrcFactor,
          newAttachmentState.alphaBlendState.blendDstFactor,
        );
        currentAttachmentState.rgbBlendState.blendSrcFactor =
          newAttachmentState.rgbBlendState.blendSrcFactor;
        currentAttachmentState.alphaBlendState.blendSrcFactor =
          newAttachmentState.alphaBlendState.blendSrcFactor;
        currentAttachmentState.rgbBlendState.blendDstFactor =
          newAttachmentState.rgbBlendState.blendDstFactor;
        currentAttachmentState.alphaBlendState.blendDstFactor =
          newAttachmentState.alphaBlendState.blendDstFactor;
      }
    };
    Device_GL2.prototype.applyAttachmentState = function (
      currentAttachmentState,
      newAttachmentState,
    ) {
      var gl = this.gl;
      if (
        currentAttachmentState.channelWriteMask !==
        newAttachmentState.channelWriteMask
      ) {
        gl.colorMask(
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.RED),
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.GREEN),
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.BLUE),
          !!(newAttachmentState.channelWriteMask & ChannelWriteMask.ALPHA),
        );
        currentAttachmentState.channelWriteMask =
          newAttachmentState.channelWriteMask;
      }
      var blendModeChanged =
        currentAttachmentState.rgbBlendState.blendMode !==
          newAttachmentState.rgbBlendState.blendMode ||
        currentAttachmentState.alphaBlendState.blendMode !==
          newAttachmentState.alphaBlendState.blendMode;
      var blendFuncChanged =
        currentAttachmentState.rgbBlendState.blendSrcFactor !==
          newAttachmentState.rgbBlendState.blendSrcFactor ||
        currentAttachmentState.alphaBlendState.blendSrcFactor !==
          newAttachmentState.alphaBlendState.blendSrcFactor ||
        currentAttachmentState.rgbBlendState.blendDstFactor !==
          newAttachmentState.rgbBlendState.blendDstFactor ||
        currentAttachmentState.alphaBlendState.blendDstFactor !==
          newAttachmentState.alphaBlendState.blendDstFactor;
      if (blendFuncChanged || blendModeChanged) {
        if (
          isBlendStateNone(currentAttachmentState.rgbBlendState) &&
          isBlendStateNone(currentAttachmentState.alphaBlendState)
        ) {
          gl.enable(gl.BLEND);
        } else if (
          isBlendStateNone(newAttachmentState.rgbBlendState) &&
          isBlendStateNone(newAttachmentState.alphaBlendState)
        ) {
          gl.disable(gl.BLEND);
        }
      }
      if (blendModeChanged) {
        gl.blendEquationSeparate(
          newAttachmentState.rgbBlendState.blendMode,
          newAttachmentState.alphaBlendState.blendMode,
        );
        currentAttachmentState.rgbBlendState.blendMode =
          newAttachmentState.rgbBlendState.blendMode;
        currentAttachmentState.alphaBlendState.blendMode =
          newAttachmentState.alphaBlendState.blendMode;
      }
      if (blendFuncChanged) {
        gl.blendFuncSeparate(
          newAttachmentState.rgbBlendState.blendSrcFactor,
          newAttachmentState.rgbBlendState.blendDstFactor,
          newAttachmentState.alphaBlendState.blendSrcFactor,
          newAttachmentState.alphaBlendState.blendDstFactor,
        );
        currentAttachmentState.rgbBlendState.blendSrcFactor =
          newAttachmentState.rgbBlendState.blendSrcFactor;
        currentAttachmentState.alphaBlendState.blendSrcFactor =
          newAttachmentState.alphaBlendState.blendSrcFactor;
        currentAttachmentState.rgbBlendState.blendDstFactor =
          newAttachmentState.rgbBlendState.blendDstFactor;
        currentAttachmentState.alphaBlendState.blendDstFactor =
          newAttachmentState.alphaBlendState.blendDstFactor;
      }
    };
    Device_GL2.prototype.setMegaState = function (newMegaState) {
      var gl = this.gl;
      var currentMegaState = this.currentMegaState;
      if (this.OES_draw_buffers_indexed !== null) {
        for (var i = 0; i < newMegaState.attachmentsState.length; i++)
          this.applyAttachmentStateIndexed(
            i,
            currentMegaState.attachmentsState[0],
            newMegaState.attachmentsState[0],
          );
      } else {
        assert(newMegaState.attachmentsState.length === 1);
        this.applyAttachmentState(
          currentMegaState.attachmentsState[0],
          newMegaState.attachmentsState[0],
        );
      }
      if (
        !colorEqual(currentMegaState.blendConstant, newMegaState.blendConstant)
      ) {
        gl.blendColor(
          newMegaState.blendConstant.r,
          newMegaState.blendConstant.g,
          newMegaState.blendConstant.b,
          newMegaState.blendConstant.a,
        );
        colorCopy(currentMegaState.blendConstant, newMegaState.blendConstant);
      }
      if (currentMegaState.depthCompare !== newMegaState.depthCompare) {
        gl.depthFunc(newMegaState.depthCompare);
        currentMegaState.depthCompare = newMegaState.depthCompare;
      }
      if (!!currentMegaState.depthWrite !== !!newMegaState.depthWrite) {
        gl.depthMask(newMegaState.depthWrite);
        currentMegaState.depthWrite = newMegaState.depthWrite;
      }
      if (!!currentMegaState.stencilWrite !== !!newMegaState.stencilWrite) {
        gl.stencilMask(newMegaState.stencilWrite ? 255 : 0);
        currentMegaState.stencilWrite = newMegaState.stencilWrite;
      }
      if (
        !stencilFaceStateEquals(
          currentMegaState.stencilFront,
          newMegaState.stencilFront,
        )
      ) {
        var _a2 = newMegaState.stencilFront,
          passOp = _a2.passOp,
          failOp = _a2.failOp,
          depthFailOp = _a2.depthFailOp,
          compare = _a2.compare;
        if (
          currentMegaState.stencilFront.passOp !== passOp ||
          currentMegaState.stencilFront.failOp !== failOp ||
          currentMegaState.stencilFront.depthFailOp !== depthFailOp
        ) {
          gl.stencilOpSeparate(gl.FRONT, failOp, depthFailOp, passOp);
          currentMegaState.stencilFront.passOp = passOp;
          currentMegaState.stencilFront.failOp = failOp;
          currentMegaState.stencilFront.depthFailOp = depthFailOp;
        }
        if (currentMegaState.stencilFront.compare !== compare) {
          this.setStencilReference(0);
          currentMegaState.stencilFront.compare = compare;
        }
      }
      if (
        !stencilFaceStateEquals(
          currentMegaState.stencilBack,
          newMegaState.stencilBack,
        )
      ) {
        var _b = newMegaState.stencilBack,
          passOp = _b.passOp,
          failOp = _b.failOp,
          depthFailOp = _b.depthFailOp,
          compare = _b.compare;
        if (
          currentMegaState.stencilBack.passOp !== passOp ||
          currentMegaState.stencilBack.failOp !== failOp ||
          currentMegaState.stencilBack.depthFailOp !== depthFailOp
        ) {
          gl.stencilOpSeparate(gl.BACK, failOp, depthFailOp, passOp);
          currentMegaState.stencilBack.passOp = passOp;
          currentMegaState.stencilBack.failOp = failOp;
          currentMegaState.stencilBack.depthFailOp = depthFailOp;
        }
        if (currentMegaState.stencilBack.compare !== compare) {
          this.setStencilReference(0);
          currentMegaState.stencilBack.compare = compare;
        }
      }
      if (
        currentMegaState.stencilFront.mask !== newMegaState.stencilFront.mask ||
        currentMegaState.stencilBack.mask !== newMegaState.stencilBack.mask
      ) {
        currentMegaState.stencilFront.mask = newMegaState.stencilFront.mask;
        currentMegaState.stencilBack.mask = newMegaState.stencilBack.mask;
        this.applyStencil();
      }
      if (currentMegaState.cullMode !== newMegaState.cullMode) {
        if (currentMegaState.cullMode === CullMode.NONE) {
          gl.enable(gl.CULL_FACE);
        } else if (newMegaState.cullMode === CullMode.NONE) {
          gl.disable(gl.CULL_FACE);
        }
        if (newMegaState.cullMode === CullMode.BACK) {
          gl.cullFace(gl.BACK);
        } else if (newMegaState.cullMode === CullMode.FRONT) {
          gl.cullFace(gl.FRONT);
        } else if (newMegaState.cullMode === CullMode.FRONT_AND_BACK) {
          gl.cullFace(gl.FRONT_AND_BACK);
        }
        currentMegaState.cullMode = newMegaState.cullMode;
      }
      if (currentMegaState.frontFace !== newMegaState.frontFace) {
        gl.frontFace(newMegaState.frontFace);
        currentMegaState.frontFace = newMegaState.frontFace;
      }
      if (currentMegaState.polygonOffset !== newMegaState.polygonOffset) {
        if (newMegaState.polygonOffset) {
          gl.polygonOffset(1, 1);
          gl.enable(gl.POLYGON_OFFSET_FILL);
        } else {
          gl.disable(gl.POLYGON_OFFSET_FILL);
        }
        currentMegaState.polygonOffset = newMegaState.polygonOffset;
      }
    };
    Device_GL2.prototype.validatePipelineFormats = function (pipeline) {
      for (var i = 0; i < this.currentColorAttachments.length; i++) {
        var attachment = this.currentColorAttachments[i];
        if (attachment === null) continue;
      }
      if (this.currentDepthStencilAttachment) {
        assert(
          this.currentDepthStencilAttachment.format ===
            pipeline.depthStencilAttachmentFormat,
        );
      }
      if (this.currentSampleCount !== -1) {
        assert(this.currentSampleCount === pipeline.sampleCount);
      }
    };
    Device_GL2.prototype.setPipeline = function (o) {
      var _this = this;
      if (this.renderBundle) {
        this.renderBundle.push(function () {
          return _this.setPipeline(o);
        });
        return;
      }
      this.currentPipeline = o;
      this.validatePipelineFormats(this.currentPipeline);
      this.setMegaState(this.currentPipeline.megaState);
      var program = this.currentPipeline.program;
      this.useProgram(program);
      if (program.compileState === ProgramCompileState_GL.NeedsBind) {
        var gl = this.gl;
        var prog = program.gl_program;
        var deviceProgram = program.descriptor;
        var uniformBlocks = findall(
          deviceProgram.vertex.glsl,
          UNIFROM_BLOCK_REGEXP,
        );
        if (isWebGL2(gl)) {
          for (var i = 0; i < uniformBlocks.length; i++) {
            var _a2 = __read(uniformBlocks[i], 2),
              blockName = _a2[1];
            var blockIdx = gl.getUniformBlockIndex(prog, blockName);
            if (blockIdx !== -1 && blockIdx !== 4294967295) {
              gl.uniformBlockBinding(prog, blockIdx, i);
            }
          }
        }
        var samplers = findall(
          deviceProgram.fragment.glsl,
          /^uniform .*sampler\S+ (\w+);\s* \/\/ BINDING=(\d+)$/gm,
        );
        for (var i = 0; i < samplers.length; i++) {
          var _b = __read(samplers[i], 3),
            name_1 = _b[1],
            location_1 = _b[2];
          var samplerUniformLocation = gl.getUniformLocation(prog, name_1);
          gl.uniform1i(samplerUniformLocation, parseInt(location_1));
        }
        program.compileState = ProgramCompileState_GL.ReadyToUse;
      }
    };
    Device_GL2.prototype.setVertexInput = function (
      inputLayout_,
      vertexBuffers,
      indexBuffer,
    ) {
      var e_1, _a2;
      var _this = this;
      var _b;
      if (this.renderBundle) {
        this.renderBundle.push(function () {
          return _this.setVertexInput(inputLayout_, vertexBuffers, indexBuffer);
        });
        return;
      }
      if (inputLayout_ !== null) {
        assert(this.currentPipeline.inputLayout === inputLayout_);
        var inputLayout = inputLayout_;
        this.bindVAO(inputLayout.vao);
        var gl = this.gl;
        for (var i = 0; i < inputLayout.vertexBufferDescriptors.length; i++) {
          var vertexBufferDescriptor = inputLayout.vertexBufferDescriptors[i];
          var arrayStride = vertexBufferDescriptor.arrayStride,
            attributes = vertexBufferDescriptor.attributes;
          try {
            for (
              var attributes_1 = ((e_1 = void 0), __values(attributes)),
                attributes_1_1 = attributes_1.next();
              !attributes_1_1.done;
              attributes_1_1 = attributes_1.next()
            ) {
              var attribute = attributes_1_1.value;
              var shaderLocation = attribute.shaderLocation,
                offset = attribute.offset;
              var location_2 = isWebGL2(gl)
                ? shaderLocation
                : (_b = inputLayout.program.attributes[shaderLocation]) ===
                    null || _b === void 0
                ? void 0
                : _b.location;
              if (!is_nil_default(location_2)) {
                var vertexBuffer = vertexBuffers[i];
                if (vertexBuffer === null) continue;
                var format = attribute.vertexFormat;
                gl.bindBuffer(
                  gl.ARRAY_BUFFER,
                  getPlatformBuffer$1(vertexBuffer.buffer),
                );
                var bufferOffset = (vertexBuffer.offset || 0) + offset;
                gl.vertexAttribPointer(
                  location_2,
                  format.size,
                  format.type,
                  format.normalized,
                  arrayStride,
                  bufferOffset,
                );
              }
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (
                attributes_1_1 &&
                !attributes_1_1.done &&
                (_a2 = attributes_1.return)
              )
                _a2.call(attributes_1);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        }
        assert(
          (indexBuffer !== null) === (inputLayout.indexBufferFormat !== null),
        );
        if (indexBuffer !== null) {
          var buffer = indexBuffer.buffer;
          assert(buffer.usage === BufferUsage.INDEX);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, getPlatformBuffer$1(buffer));
          this.currentIndexBufferByteOffset = indexBuffer.offset || 0;
        } else {
          this.currentIndexBufferByteOffset = null;
        }
      } else {
        assert(this.currentPipeline.inputLayout === null);
        assert(indexBuffer === null);
        this.bindVAO(null);
        this.currentIndexBufferByteOffset = 0;
      }
    };
    Device_GL2.prototype.setStencilReference = function (value) {
      if (this.currentStencilRef === value) {
        return;
      }
      this.currentStencilRef = value;
      this.applyStencil();
    };
    Device_GL2.prototype.draw = function (
      vertexCount,
      instanceCount,
      firstVertex,
      firstInstance,
    ) {
      var _a2;
      var _this = this;
      if (this.renderBundle) {
        this.renderBundle.push(function () {
          return _this.draw(
            vertexCount,
            instanceCount,
            firstVertex,
            firstInstance,
          );
        });
        return;
      }
      var gl = this.gl;
      var pipeline = this.currentPipeline;
      if (instanceCount) {
        var params = [
          pipeline.drawMode,
          firstVertex || 0,
          vertexCount,
          instanceCount,
        ];
        if (isWebGL2(gl)) {
          gl.drawArraysInstanced.apply(
            gl,
            __spreadArray([], __read(params), false),
          );
        } else {
          (_a2 = this.ANGLE_instanced_arrays).drawArraysInstancedANGLE.apply(
            _a2,
            __spreadArray([], __read(params), false),
          );
        }
      } else {
        gl.drawArrays(pipeline.drawMode, firstVertex, vertexCount);
      }
      this.debugGroupStatisticsDrawCall();
      this.debugGroupStatisticsTriangles(
        (vertexCount / 3) * Math.max(instanceCount, 1),
      );
    };
    Device_GL2.prototype.drawIndexed = function (
      indexCount,
      instanceCount,
      firstIndex,
      baseVertex,
      firstInstance,
    ) {
      var _a2;
      var _this = this;
      if (this.renderBundle) {
        this.renderBundle.push(function () {
          return _this.drawIndexed(
            indexCount,
            instanceCount,
            firstIndex,
            baseVertex,
            firstInstance,
          );
        });
        return;
      }
      var gl = this.gl;
      var pipeline = this.currentPipeline,
        inputLayout = assertExists(pipeline.inputLayout);
      var byteOffset =
        assertExists(this.currentIndexBufferByteOffset) +
        firstIndex * inputLayout.indexBufferCompByteSize;
      if (instanceCount) {
        var params = [
          pipeline.drawMode,
          indexCount,
          inputLayout.indexBufferType,
          byteOffset,
          instanceCount,
        ];
        if (isWebGL2(gl)) {
          gl.drawElementsInstanced.apply(
            gl,
            __spreadArray([], __read(params), false),
          );
        } else {
          (_a2 = this.ANGLE_instanced_arrays).drawElementsInstancedANGLE.apply(
            _a2,
            __spreadArray([], __read(params), false),
          );
        }
      } else {
        gl.drawElements(
          pipeline.drawMode,
          indexCount,
          inputLayout.indexBufferType,
          byteOffset,
        );
      }
      this.debugGroupStatisticsDrawCall();
      this.debugGroupStatisticsTriangles(
        (indexCount / 3) * Math.max(instanceCount, 1),
      );
    };
    Device_GL2.prototype.drawIndirect = function (
      indirectBuffer,
      indirectOffset,
    ) {};
    Device_GL2.prototype.drawIndexedIndirect = function (
      indirectBuffer,
      indirectOffset,
    ) {};
    Device_GL2.prototype.beginOcclusionQuery = function (queryIndex) {
      var gl = this.gl;
      if (isWebGL2(gl)) {
        var queryPool = this.currentRenderPassDescriptor.occlusionQueryPool;
        gl.beginQuery(queryPool.gl_query_type, queryPool.gl_query[queryIndex]);
      }
    };
    Device_GL2.prototype.endOcclusionQuery = function () {
      var gl = this.gl;
      if (isWebGL2(gl)) {
        var queryPool = this.currentRenderPassDescriptor.occlusionQueryPool;
        gl.endQuery(queryPool.gl_query_type);
      }
    };
    Device_GL2.prototype.pipelineQueryReady = function (o) {
      var pipeline = o;
      return this.queryProgramReady(pipeline.program);
    };
    Device_GL2.prototype.pipelineForceReady = function (o) {};
    Device_GL2.prototype.endPass = function () {
      var gl = this.gl;
      var gl2 = isWebGL2(gl);
      var didUnbindDraw = false;
      for (var i = 0; i < this.currentColorAttachments.length; i++) {
        var colorResolveFrom = this.currentColorAttachments[i];
        if (colorResolveFrom !== null) {
          var colorResolveTo = this.currentColorResolveTos[i];
          var didBindRead = false;
          if (colorResolveTo !== null) {
            assert(
              colorResolveFrom.width === colorResolveTo.width &&
                colorResolveFrom.height === colorResolveTo.height,
            );
            this.setScissorRectEnabled(false);
            if (gl2) {
              gl.bindFramebuffer(
                gl.READ_FRAMEBUFFER,
                this.resolveColorReadFramebuffer,
              );
            }
            if (this.resolveColorAttachmentsChanged) {
              if (gl2) {
                this.bindFramebufferAttachment(
                  gl.READ_FRAMEBUFFER,
                  gl.COLOR_ATTACHMENT0,
                  colorResolveFrom,
                  this.currentColorAttachmentLevels[i],
                );
              }
            }
            didBindRead = true;
            if (colorResolveTo === this.scTexture) {
              gl.bindFramebuffer(
                gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
                this.scPlatformFramebuffer,
              );
            } else {
              gl.bindFramebuffer(
                gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
                this.resolveColorDrawFramebuffer,
              );
              if (this.resolveColorAttachmentsChanged)
                gl.framebufferTexture2D(
                  gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
                  gl.COLOR_ATTACHMENT0,
                  gl.TEXTURE_2D,
                  colorResolveTo.gl_texture,
                  this.currentColorResolveToLevels[i],
                );
            }
            if (gl2) {
              gl.blitFramebuffer(
                0,
                0,
                colorResolveFrom.width,
                colorResolveFrom.height,
                0,
                0,
                colorResolveTo.width,
                colorResolveTo.height,
                gl.COLOR_BUFFER_BIT,
                gl.LINEAR,
              );
              gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
            } else {
              this.submitBlitRenderPass(colorResolveFrom, colorResolveTo);
            }
            didUnbindDraw = true;
          }
          if (!this.currentRenderPassDescriptor.colorStore[i]) {
            if (!didBindRead) {
              gl.bindFramebuffer(
                gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER,
                this.resolveColorReadFramebuffer,
              );
              if (this.resolveColorAttachmentsChanged)
                this.bindFramebufferAttachment(
                  gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER,
                  gl.COLOR_ATTACHMENT0,
                  colorResolveFrom,
                  this.currentColorAttachmentLevels[i],
                );
            }
          }
          gl.bindFramebuffer(gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER, null);
        }
      }
      this.resolveColorAttachmentsChanged = false;
      var depthStencilResolveFrom = this.currentDepthStencilAttachment;
      if (depthStencilResolveFrom) {
        var depthStencilResolveTo = this.currentDepthStencilResolveTo;
        var didBindRead = false;
        if (depthStencilResolveTo) {
          assert(
            depthStencilResolveFrom.width === depthStencilResolveTo.width &&
              depthStencilResolveFrom.height === depthStencilResolveTo.height,
          );
          this.setScissorRectEnabled(false);
          gl.bindFramebuffer(
            gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER,
            this.resolveDepthStencilReadFramebuffer,
          );
          gl.bindFramebuffer(
            gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
            this.resolveDepthStencilDrawFramebuffer,
          );
          if (this.resolveDepthStencilAttachmentsChanged) {
            this.bindFramebufferDepthStencilAttachment(
              gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER,
              depthStencilResolveFrom,
            );
            this.bindFramebufferDepthStencilAttachment(
              gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER,
              depthStencilResolveTo,
            );
          }
          didBindRead = true;
          if (gl2) {
            gl.blitFramebuffer(
              0,
              0,
              depthStencilResolveFrom.width,
              depthStencilResolveFrom.height,
              0,
              0,
              depthStencilResolveTo.width,
              depthStencilResolveTo.height,
              gl.DEPTH_BUFFER_BIT,
              gl.NEAREST,
            );
          }
          gl.bindFramebuffer(gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER, null);
          didUnbindDraw = true;
        }
        if (!this.currentRenderPassDescriptor.depthStencilStore) {
          if (!didBindRead) {
            gl.bindFramebuffer(
              gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER,
              this.resolveDepthStencilReadFramebuffer,
            );
            if (this.resolveDepthStencilAttachmentsChanged)
              this.bindFramebufferDepthStencilAttachment(
                gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER,
                depthStencilResolveFrom,
              );
            didBindRead = true;
          }
          if (gl2) {
            gl.invalidateFramebuffer(gl.READ_FRAMEBUFFER, [
              gl.DEPTH_STENCIL_ATTACHMENT,
            ]);
          }
        }
        if (didBindRead)
          gl.bindFramebuffer(gl2 ? GL.READ_FRAMEBUFFER : GL.FRAMEBUFFER, null);
        this.resolveDepthStencilAttachmentsChanged = false;
      }
      if (!didUnbindDraw) {
        gl.bindFramebuffer(gl2 ? GL.DRAW_FRAMEBUFFER : GL.FRAMEBUFFER, null);
      }
    };
    Device_GL2.prototype.setScissorRectEnabled = function (v) {
      if (this.currentScissorEnabled === v) {
        return;
      }
      var gl = this.gl;
      if (v) {
        gl.enable(gl.SCISSOR_TEST);
      } else {
        gl.disable(gl.SCISSOR_TEST);
      }
      this.currentScissorEnabled = v;
    };
    Device_GL2.prototype.applyStencil = function () {
      if (is_nil_default(this.currentStencilRef)) {
        return;
      }
      this.gl.stencilFuncSeparate(
        GL.FRONT,
        this.currentMegaState.stencilFront.compare,
        this.currentStencilRef,
        this.currentMegaState.stencilFront.mask || 255,
      );
      this.gl.stencilFuncSeparate(
        GL.BACK,
        this.currentMegaState.stencilBack.compare,
        this.currentStencilRef,
        this.currentMegaState.stencilBack.mask || 255,
      );
    };
    Device_GL2.prototype.getFallbackTexture = function (samplerEntry) {
      var gl_target = samplerEntry.gl_target,
        formatKind = samplerEntry.formatKind;
      if (gl_target === GL.TEXTURE_2D)
        return formatKind === SamplerFormatKind.Depth
          ? this.fallbackTexture2DDepth
          : this.fallbackTexture2D;
      else if (gl_target === GL.TEXTURE_2D_ARRAY)
        return this.fallbackTexture2DArray;
      else if (gl_target === GL.TEXTURE_3D) return this.fallbackTexture3D;
      else if (gl_target === GL.TEXTURE_CUBE_MAP)
        return this.fallbackTextureCube;
      else throw new Error('whoops');
    };
    Device_GL2.prototype.submitBlitRenderPass = function (
      resolveFrom,
      resolveTo,
    ) {
      if (!this.blitRenderPipeline) {
        this.blitProgram = this.createProgram({
          vertex: {
            glsl: 'layout(location = 0) in vec2 a_Position;\nout vec2 v_TexCoord;\nvoid main() {\n  v_TexCoord = 0.5 * (a_Position + 1.0);\n  gl_Position = vec4(a_Position, 0., 1.);\n\n  #ifdef VIEWPORT_ORIGIN_TL\n    v_TexCoord.y = 1.0 - v_TexCoord.y;\n  #endif\n}',
          },
          fragment: {
            glsl: 'uniform sampler2D u_Texture;\nin vec2 v_TexCoord;\nout vec4 outputColor;\nvoid main() {\n  outputColor = texture(SAMPLER_2D(u_Texture), v_TexCoord);\n}',
          },
        });
        this.blitVertexBuffer = this.createBuffer({
          usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
          viewOrSize: new Float32Array([-4, -4, 4, -4, 0, 4]),
        });
        this.blitInputLayout = this.createInputLayout({
          vertexBufferDescriptors: [
            {
              arrayStride: 4 * 2,
              stepMode: VertexStepMode.VERTEX,
              attributes: [
                {
                  format: Format.F32_RG,
                  offset: 4 * 0,
                  shaderLocation: 0,
                },
              ],
            },
          ],
          indexBufferFormat: null,
          program: this.blitProgram,
        });
        this.blitRenderPipeline = this.createRenderPipeline({
          topology: PrimitiveTopology.TRIANGLES,
          sampleCount: 1,
          program: this.blitProgram,
          colorAttachmentFormats: [Format.U8_RGBA_RT],
          depthStencilAttachmentFormat: null,
          inputLayout: this.blitInputLayout,
          megaStateDescriptor: copyMegaState(defaultMegaState),
        });
        this.blitBindings = this.createBindings({
          samplerBindings: [
            {
              sampler: null,
              texture: resolveFrom.texture,
            },
          ],
          uniformBufferBindings: [],
        });
        this.blitProgram.setUniformsLegacy({
          u_Texture: resolveFrom,
        });
      }
      var currentRenderPassDescriptor = this.currentRenderPassDescriptor;
      this.currentRenderPassDescriptor = null;
      this.inBlitRenderPass = true;
      var blitRenderPass = this.createRenderPass({
        colorAttachment: [resolveFrom],
        colorResolveTo: [resolveTo],
        colorClearColor: [TransparentWhite],
      });
      var _a2 = this.getCanvas(),
        width = _a2.width,
        height = _a2.height;
      blitRenderPass.setPipeline(this.blitRenderPipeline);
      blitRenderPass.setBindings(this.blitBindings);
      blitRenderPass.setVertexInput(
        this.blitInputLayout,
        [{ buffer: this.blitVertexBuffer }],
        null,
      );
      blitRenderPass.setViewport(0, 0, width, height);
      this.gl.disable(this.gl.BLEND);
      blitRenderPass.draw(3, 0);
      this.gl.enable(this.gl.BLEND);
      this.currentRenderPassDescriptor = currentRenderPassDescriptor;
      this.inBlitRenderPass = false;
    };
    return Device_GL2;
  })();
var WebGLDeviceContribution =
  /** @class */
  (function () {
    function WebGLDeviceContribution2(pluginOptions) {
      this.pluginOptions = pluginOptions;
    }
    WebGLDeviceContribution2.prototype.createSwapChain = function ($canvas) {
      return __awaiter(this, void 0, void 0, function () {
        var _a2,
          targets,
          xrCompatible,
          _b,
          antialias,
          _c,
          preserveDrawingBuffer,
          _d,
          premultipliedAlpha,
          shaderDebug,
          trackResources,
          options,
          gl;
        return __generator(this, function (_e) {
          (_a2 = this.pluginOptions),
            (targets = _a2.targets),
            (xrCompatible = _a2.xrCompatible),
            (_b = _a2.antialias),
            (antialias = _b === void 0 ? false : _b),
            (_c = _a2.preserveDrawingBuffer),
            (preserveDrawingBuffer = _c === void 0 ? false : _c),
            (_d = _a2.premultipliedAlpha),
            (premultipliedAlpha = _d === void 0 ? true : _d),
            (shaderDebug = _a2.shaderDebug),
            (trackResources = _a2.trackResources);
          options = {
            // alpha: true,
            antialias,
            // @see https://stackoverflow.com/questions/27746091/preservedrawingbuffer-false-is-it-worth-the-effort
            preserveDrawingBuffer,
            // @see https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-use-the-stencil-buffer.html
            stencil: true,
            // @see https://webglfundamentals.org/webgl/lessons/webgl-and-alpha.html
            premultipliedAlpha,
            xrCompatible,
          };
          this.handleContextEvents($canvas);
          if (targets.includes('webgl2')) {
            gl =
              $canvas.getContext('webgl2', options) ||
              $canvas.getContext('experimental-webgl2', options);
          }
          if (!gl && targets.includes('webgl1')) {
            gl =
              $canvas.getContext('webgl', options) ||
              $canvas.getContext('experimental-webgl', options);
          }
          return [
            2,
            new Device_GL(gl, {
              shaderDebug,
              trackResources,
            }),
          ];
        });
      });
    };
    WebGLDeviceContribution2.prototype.handleContextEvents = function (
      $canvas,
    ) {
      var _a2 = this.pluginOptions,
        onContextLost = _a2.onContextLost,
        onContextRestored = _a2.onContextRestored,
        onContextCreationError = _a2.onContextCreationError;
      if (onContextCreationError) {
        $canvas.addEventListener(
          'webglcontextcreationerror',
          onContextCreationError,
          false,
        );
      }
      if (onContextLost) {
        $canvas.addEventListener('webglcontextlost', onContextLost, false);
      }
      if (onContextRestored) {
        $canvas.addEventListener(
          'webglcontextrestored',
          onContextRestored,
          false,
        );
      }
    };
    return WebGLDeviceContribution2;
  })();
var wasm;
var cachedTextDecoder =
  typeof TextDecoder !== 'undefined'
    ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
    : {
        decode: () => {
          throw Error('TextDecoder not available');
        },
      };
if (typeof TextDecoder !== 'undefined') {
  cachedTextDecoder.decode();
}
var cachedUint8Memory0 = null;
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
var heap = new Array(128).fill(void 0);
heap.push(void 0, null, true, false);
var heap_next = heap.length;
function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
function getObject(idx) {
  return heap[idx];
}
function dropObject(idx) {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
var WASM_VECTOR_LEN = 0;
var cachedTextEncoder =
  typeof TextEncoder !== 'undefined'
    ? new TextEncoder('utf-8')
    : {
        encode: () => {
          throw Error('TextEncoder not available');
        },
      };
var encodeString =
  typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
        return cachedTextEncoder.encodeInto(arg, view);
      }
    : function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
          read: arg.length,
          written: buf.length,
        };
      };
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0()
      .subarray(ptr2, ptr2 + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
var cachedInt32Memory0 = null;
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
function glsl_compile(source, stage, validation_enabled) {
  let deferred3_0;
  let deferred3_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passStringToWasm0(
      source,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc,
    );
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(
      stage,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc,
    );
    const len1 = WASM_VECTOR_LEN;
    wasm.glsl_compile(retptr, ptr0, len0, ptr1, len1, validation_enabled);
    var r0 = getInt32Memory0()[retptr / 4 + 0];
    var r1 = getInt32Memory0()[retptr / 4 + 1];
    deferred3_0 = r0;
    deferred3_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}
var WGSLComposer = class _WGSLComposer {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_WGSLComposer.prototype);
    obj.__wbg_ptr = ptr;
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_wgslcomposer_free(ptr);
  }
  /**
   */
  constructor() {
    const ret = wasm.wgslcomposer_new();
    return _WGSLComposer.__wrap(ret);
  }
  /**
   * @param {string} source
   * @returns {string}
   */
  wgsl_compile(source) {
    let deferred2_0;
    let deferred2_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(
        source,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len0 = WASM_VECTOR_LEN;
      wasm.wgslcomposer_wgsl_compile(retptr, this.__wbg_ptr, ptr0, len0);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      deferred2_0 = r0;
      deferred2_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
};
async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get('Content-Type') != 'application/wasm') {
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e,
          );
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbindgen_string_new = function (arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function (arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_log_1d3ae0273d8f4f8a = function (arg0) {
    console.log(getObject(arg0));
  };
  imports.wbg.__wbg_log_576ca876af0d4a77 = function (arg0, arg1) {
    console.log(getObject(arg0), getObject(arg1));
  };
  imports.wbg.__wbindgen_throw = function (arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
async function __wbg_init(input) {
  if (wasm !== void 0) return wasm;
  const imports = __wbg_get_imports();
  if (
    typeof input === 'string' ||
    (typeof Request === 'function' && input instanceof Request) ||
    (typeof URL === 'function' && input instanceof URL)
  ) {
    input = fetch(input);
  }
  const { instance, module } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module);
}
var GPUTextureUsage$1;
(function (GPUTextureUsage2) {
  GPUTextureUsage2[(GPUTextureUsage2['COPY_SRC'] = 1)] = 'COPY_SRC';
  GPUTextureUsage2[(GPUTextureUsage2['COPY_DST'] = 2)] = 'COPY_DST';
  GPUTextureUsage2[(GPUTextureUsage2['TEXTURE_BINDING'] = 4)] =
    'TEXTURE_BINDING';
  GPUTextureUsage2[(GPUTextureUsage2['STORAGE_BINDING'] = 8)] =
    'STORAGE_BINDING';
  GPUTextureUsage2[(GPUTextureUsage2['STORAGE'] = 8)] = 'STORAGE';
  GPUTextureUsage2[(GPUTextureUsage2['RENDER_ATTACHMENT'] = 16)] =
    'RENDER_ATTACHMENT';
})(GPUTextureUsage$1 || (GPUTextureUsage$1 = {}));
var GPUMapMode;
(function (GPUMapMode2) {
  GPUMapMode2[(GPUMapMode2['READ'] = 1)] = 'READ';
  GPUMapMode2[(GPUMapMode2['WRITE'] = 2)] = 'WRITE';
})(GPUMapMode || (GPUMapMode = {}));
function translateTextureUsage(usage) {
  var gpuUsage = 0;
  if (usage & TextureUsage.SAMPLED)
    gpuUsage |=
      GPUTextureUsage$1.TEXTURE_BINDING |
      GPUTextureUsage$1.COPY_DST |
      GPUTextureUsage$1.COPY_SRC;
  if (usage & TextureUsage.STORAGE)
    gpuUsage |=
      GPUTextureUsage$1.TEXTURE_BINDING |
      GPUTextureUsage$1.STORAGE_BINDING |
      GPUTextureUsage$1.COPY_SRC |
      GPUTextureUsage$1.COPY_DST;
  if (usage & TextureUsage.RENDER_TARGET)
    gpuUsage |=
      GPUTextureUsage$1.RENDER_ATTACHMENT |
      GPUTextureUsage$1.TEXTURE_BINDING |
      GPUTextureUsage$1.COPY_SRC |
      GPUTextureUsage$1.COPY_DST;
  return gpuUsage;
}
function translateTextureFormat(format) {
  if (format === Format.U8_R_NORM) return 'r8unorm';
  else if (format === Format.S8_R_NORM) return 'r8snorm';
  else if (format === Format.U8_RG_NORM) return 'rg8unorm';
  else if (format === Format.S8_RG_NORM) return 'rg8snorm';
  else if (format === Format.U32_R) return 'r32uint';
  else if (format === Format.S32_R) return 'r32sint';
  else if (format === Format.F32_R) return 'r32float';
  else if (format === Format.U16_RG) return 'rg16uint';
  else if (format === Format.S16_RG) return 'rg16sint';
  else if (format === Format.F16_RG) return 'rg16float';
  else if (format === Format.U8_RGBA_RT) return 'bgra8unorm';
  else if (format === Format.U8_RGBA_RT_SRGB) return 'bgra8unorm-srgb';
  else if (format === Format.U8_RGBA_NORM) return 'rgba8unorm';
  else if (format === Format.U8_RGBA_SRGB) return 'rgba8unorm-srgb';
  else if (format === Format.S8_RGBA_NORM) return 'rgba8snorm';
  else if (format === Format.U32_RG) return 'rg32uint';
  else if (format === Format.S32_RG) return 'rg32sint';
  else if (format === Format.F32_RG) return 'rg32float';
  else if (format === Format.U16_RGBA) return 'rgba16uint';
  else if (format === Format.S16_RGBA) return 'rgba16sint';
  else if (format === Format.F16_RGBA) return 'rgba16float';
  else if (format === Format.F32_RGBA) return 'rgba32float';
  else if (format === Format.U32_RGBA) return 'rgba32uint';
  else if (format === Format.S32_RGBA) return 'rgba32sint';
  else if (format === Format.D24) return 'depth24plus';
  else if (format === Format.D24_S8) return 'depth24plus-stencil8';
  else if (format === Format.D32F) return 'depth32float';
  else if (format === Format.D32F_S8) return 'depth32float-stencil8';
  else if (format === Format.BC1) return 'bc1-rgba-unorm';
  else if (format === Format.BC1_SRGB) return 'bc1-rgba-unorm-srgb';
  else if (format === Format.BC2) return 'bc2-rgba-unorm';
  else if (format === Format.BC2_SRGB) return 'bc2-rgba-unorm-srgb';
  else if (format === Format.BC3) return 'bc3-rgba-unorm';
  else if (format === Format.BC3_SRGB) return 'bc3-rgba-unorm-srgb';
  else if (format === Format.BC4_SNORM) return 'bc4-r-snorm';
  else if (format === Format.BC4_UNORM) return 'bc4-r-unorm';
  else if (format === Format.BC5_SNORM) return 'bc5-rg-snorm';
  else if (format === Format.BC5_UNORM) return 'bc5-rg-unorm';
  else throw 'whoops';
}
function translateTextureDimension(dimension) {
  if (dimension === TextureDimension.TEXTURE_2D) return '2d';
  else if (dimension === TextureDimension.TEXTURE_CUBE_MAP) return '2d';
  else if (dimension === TextureDimension.TEXTURE_2D_ARRAY) return '2d';
  else if (dimension === TextureDimension.TEXTURE_3D) return '3d';
  else throw new Error('whoops');
}
function translateTextureViewDimension(dimension) {
  if (dimension === TextureDimension.TEXTURE_2D) return '2d';
  else if (dimension === TextureDimension.TEXTURE_CUBE_MAP) return 'cube';
  else if (dimension === TextureDimension.TEXTURE_2D_ARRAY) return '2d-array';
  else if (dimension === TextureDimension.TEXTURE_3D) return '3d';
  else throw new Error('whoops');
}
function translateBufferUsage(usage_) {
  var usage = 0;
  if (usage_ & BufferUsage.INDEX) usage |= GPUBufferUsage.INDEX;
  if (usage_ & BufferUsage.VERTEX) usage |= GPUBufferUsage.VERTEX;
  if (usage_ & BufferUsage.UNIFORM) usage |= GPUBufferUsage.UNIFORM;
  if (usage_ & BufferUsage.STORAGE) usage |= GPUBufferUsage.STORAGE;
  if (usage_ & BufferUsage.COPY_SRC) usage |= GPUBufferUsage.COPY_SRC;
  if (usage_ & BufferUsage.INDIRECT) usage |= GPUBufferUsage.INDIRECT;
  usage |= GPUBufferUsage.COPY_DST;
  return usage;
}
function translateAddressMode(wrapMode) {
  if (wrapMode === AddressMode.CLAMP_TO_EDGE) return 'clamp-to-edge';
  else if (wrapMode === AddressMode.REPEAT) return 'repeat';
  else if (wrapMode === AddressMode.MIRRORED_REPEAT) return 'mirror-repeat';
  else throw new Error('whoops');
}
function translateMinMagFilter(texFilter) {
  if (texFilter === FilterMode.BILINEAR) return 'linear';
  else if (texFilter === FilterMode.POINT) return 'nearest';
  else throw new Error('whoops');
}
function translateMipFilter(mipmapFilter) {
  if (mipmapFilter === MipmapFilterMode.LINEAR) return 'linear';
  else if (mipmapFilter === MipmapFilterMode.NEAREST) return 'nearest';
  else if (mipmapFilter === MipmapFilterMode.NO_MIP) return 'nearest';
  else throw new Error('whoops');
}
function getPlatformBuffer(buffer_) {
  var buffer = buffer_;
  return buffer.gpuBuffer;
}
function getPlatformSampler(sampler_) {
  var sampler = sampler_;
  return sampler.gpuSampler;
}
function getPlatformQuerySet(queryPool_) {
  var queryPool = queryPool_;
  return queryPool.querySet;
}
function translateQueryPoolType(type) {
  if (type === QueryPoolType.OcclusionConservative) return 'occlusion';
  else throw new Error('whoops');
}
function translateTopology(topology) {
  switch (topology) {
    case PrimitiveTopology.TRIANGLES:
      return 'triangle-list';
    case PrimitiveTopology.POINTS:
      return 'point-list';
    case PrimitiveTopology.TRIANGLE_STRIP:
      return 'triangle-strip';
    case PrimitiveTopology.LINES:
      return 'line-list';
    case PrimitiveTopology.LINE_STRIP:
      return 'line-strip';
    default:
      throw new Error('Unknown primitive topology mode');
  }
}
function translateCullMode(cullMode) {
  if (cullMode === CullMode.NONE) return 'none';
  else if (cullMode === CullMode.FRONT) return 'front';
  else if (cullMode === CullMode.BACK) return 'back';
  else throw new Error('whoops');
}
function translateFrontFace(frontFaceMode) {
  if (frontFaceMode === FrontFace.CCW) return 'ccw';
  else if (frontFaceMode === FrontFace.CW) return 'cw';
  else throw new Error('whoops');
}
function translatePrimitiveState(topology, megaStateDescriptor) {
  return {
    topology: translateTopology(topology),
    cullMode: translateCullMode(megaStateDescriptor.cullMode),
    frontFace: translateFrontFace(megaStateDescriptor.frontFace),
  };
}
function translateBlendFactor(factor) {
  if (factor === BlendFactor.ZERO) return 'zero';
  else if (factor === BlendFactor.ONE) return 'one';
  else if (factor === BlendFactor.SRC) return 'src';
  else if (factor === BlendFactor.ONE_MINUS_SRC) return 'one-minus-src';
  else if (factor === BlendFactor.DST) return 'dst';
  else if (factor === BlendFactor.ONE_MINUS_DST) return 'one-minus-dst';
  else if (factor === BlendFactor.SRC_ALPHA) return 'src-alpha';
  else if (factor === BlendFactor.ONE_MINUS_SRC_ALPHA)
    return 'one-minus-src-alpha';
  else if (factor === BlendFactor.DST_ALPHA) return 'dst-alpha';
  else if (factor === BlendFactor.ONE_MINUS_DST_ALPHA)
    return 'one-minus-dst-alpha';
  else if (factor === BlendFactor.CONST) return 'constant';
  else if (factor === BlendFactor.ONE_MINUS_CONSTANT)
    return 'one-minus-constant';
  else if (factor === BlendFactor.SRC_ALPHA_SATURATE)
    return 'src-alpha-saturated';
  else throw new Error('whoops');
}
function translateBlendMode(mode) {
  if (mode === BlendMode.ADD) return 'add';
  else if (mode === BlendMode.SUBSTRACT) return 'subtract';
  else if (mode === BlendMode.REVERSE_SUBSTRACT) return 'reverse-subtract';
  else if (mode === BlendMode.MIN) return 'min';
  else if (mode === BlendMode.MAX) return 'max';
  else throw new Error('whoops');
}
function translateBlendComponent(ch) {
  return {
    operation: translateBlendMode(ch.blendMode),
    srcFactor: translateBlendFactor(ch.blendSrcFactor),
    dstFactor: translateBlendFactor(ch.blendDstFactor),
  };
}
function blendComponentIsNil(ch) {
  return (
    ch.blendMode === BlendMode.ADD &&
    ch.blendSrcFactor === BlendFactor.ONE &&
    ch.blendDstFactor === BlendFactor.ZERO
  );
}
function translateBlendState(attachmentState) {
  if (
    blendComponentIsNil(attachmentState.rgbBlendState) &&
    blendComponentIsNil(attachmentState.alphaBlendState)
  ) {
    return void 0;
  } else {
    return {
      color: translateBlendComponent(attachmentState.rgbBlendState),
      alpha: translateBlendComponent(attachmentState.alphaBlendState),
    };
  }
}
function translateColorState(attachmentState, format) {
  return {
    format: translateTextureFormat(format),
    blend: translateBlendState(attachmentState),
    writeMask: attachmentState.channelWriteMask,
  };
}
function translateTargets(colorAttachmentFormats, megaStateDescriptor) {
  return megaStateDescriptor.attachmentsState.map(function (
    attachmentState,
    i,
  ) {
    return translateColorState(attachmentState, colorAttachmentFormats[i]);
  });
}
function translateCompareFunction(compareFunction) {
  if (compareFunction === CompareFunction.NEVER) return 'never';
  else if (compareFunction === CompareFunction.LESS) return 'less';
  else if (compareFunction === CompareFunction.EQUAL) return 'equal';
  else if (compareFunction === CompareFunction.LEQUAL) return 'less-equal';
  else if (compareFunction === CompareFunction.GREATER) return 'greater';
  else if (compareFunction === CompareFunction.NOTEQUAL) return 'not-equal';
  else if (compareFunction === CompareFunction.GEQUAL) return 'greater-equal';
  else if (compareFunction === CompareFunction.ALWAYS) return 'always';
  else throw new Error('whoops');
}
function translateStencilOperation(stencilOp) {
  if (stencilOp === StencilOp.KEEP) return 'keep';
  else if (stencilOp === StencilOp.REPLACE) return 'replace';
  else if (stencilOp === StencilOp.ZERO) return 'zero';
  else if (stencilOp === StencilOp.DECREMENT_CLAMP) return 'decrement-clamp';
  else if (stencilOp === StencilOp.DECREMENT_WRAP) return 'decrement-wrap';
  else if (stencilOp === StencilOp.INCREMENT_CLAMP) return 'increment-clamp';
  else if (stencilOp === StencilOp.INCREMENT_WRAP) return 'increment-wrap';
  else if (stencilOp === StencilOp.INVERT) return 'invert';
  else throw new Error('whoops');
}
function translateDepthStencilState(format, megaStateDescriptor) {
  if (is_nil_default(format)) return void 0;
  return {
    /**
     * @see https://www.w3.org/TR/webgpu/#dom-gpudepthstencilstate-format
     */
    format: translateTextureFormat(format),
    depthWriteEnabled: !!megaStateDescriptor.depthWrite,
    depthCompare: translateCompareFunction(megaStateDescriptor.depthCompare),
    depthBias: megaStateDescriptor.polygonOffset ? 1 : 0,
    depthBiasSlopeScale: megaStateDescriptor.polygonOffset ? 1 : 0,
    stencilFront: {
      compare: translateCompareFunction(
        megaStateDescriptor.stencilFront.compare,
      ),
      passOp: translateStencilOperation(
        megaStateDescriptor.stencilFront.passOp,
      ),
      failOp: translateStencilOperation(
        megaStateDescriptor.stencilFront.failOp,
      ),
      depthFailOp: translateStencilOperation(
        megaStateDescriptor.stencilFront.depthFailOp,
      ),
    },
    stencilBack: {
      compare: translateCompareFunction(
        megaStateDescriptor.stencilBack.compare,
      ),
      passOp: translateStencilOperation(megaStateDescriptor.stencilBack.passOp),
      failOp: translateStencilOperation(megaStateDescriptor.stencilBack.failOp),
      depthFailOp: translateStencilOperation(
        megaStateDescriptor.stencilBack.depthFailOp,
      ),
    },
    stencilReadMask: 4294967295,
    stencilWriteMask: 4294967295,
    // stencilReadMask: 0xffffffff,
    // stencilWriteMask: megaStateDescriptor.stencilWrite ? 0xff : 0x00,
  };
}
function translateIndexFormat(format) {
  if (format === null) return void 0;
  else if (format === Format.U16_R) return 'uint16';
  else if (format === Format.U32_R) return 'uint32';
  else throw new Error('whoops');
}
function translateVertexStepMode(stepMode) {
  if (stepMode === VertexStepMode.VERTEX) return 'vertex';
  else if (stepMode === VertexStepMode.INSTANCE) return 'instance';
  else throw new Error('whoops');
}
function translateVertexFormat(format) {
  if (format === Format.U8_R) return 'uint8x2';
  else if (format === Format.U8_RG) return 'uint8x2';
  else if (format === Format.U8_RGB) return 'uint8x4';
  else if (format === Format.U8_RGBA) return 'uint8x4';
  else if (format === Format.U8_RG_NORM) return 'unorm8x2';
  else if (format === Format.U8_RGBA_NORM) return 'unorm8x4';
  else if (format === Format.S8_RGB_NORM) return 'snorm8x4';
  else if (format === Format.S8_RGBA_NORM) return 'snorm8x4';
  else if (format === Format.U16_RG_NORM) return 'unorm16x2';
  else if (format === Format.U16_RGBA_NORM) return 'unorm16x4';
  else if (format === Format.S16_RG_NORM) return 'snorm16x2';
  else if (format === Format.S16_RGBA_NORM) return 'snorm16x4';
  else if (format === Format.S16_RG) return 'uint16x2';
  else if (format === Format.F16_RG) return 'float16x2';
  else if (format === Format.F16_RGBA) return 'float16x4';
  else if (format === Format.F32_R) return 'float32';
  else if (format === Format.F32_RG) return 'float32x2';
  else if (format === Format.F32_RGB) return 'float32x3';
  else if (format === Format.F32_RGBA) return 'float32x4';
  else throw 'whoops';
}
function isFormatTextureCompressionBC(format) {
  var formatTypeFlags = getFormatTypeFlags(format);
  switch (formatTypeFlags) {
    case FormatTypeFlags.BC1:
    case FormatTypeFlags.BC2:
    case FormatTypeFlags.BC3:
    case FormatTypeFlags.BC4_SNORM:
    case FormatTypeFlags.BC4_UNORM:
    case FormatTypeFlags.BC5_SNORM:
    case FormatTypeFlags.BC5_UNORM:
      return true;
    default:
      return false;
  }
}
function getFormatBlockSize(format) {
  var formatTypeFlags = getFormatTypeFlags(format);
  switch (formatTypeFlags) {
    case FormatTypeFlags.BC1:
    case FormatTypeFlags.BC2:
    case FormatTypeFlags.BC3:
    case FormatTypeFlags.BC4_SNORM:
    case FormatTypeFlags.BC4_UNORM:
    case FormatTypeFlags.BC5_SNORM:
    case FormatTypeFlags.BC5_UNORM:
      return 4;
    default:
      return 1;
  }
}
function allocateAndCopyTypedBuffer(
  type,
  sizeOrDstBuffer,
  sizeInBytes,
  copyBuffer,
) {
  if (sizeInBytes === void 0) {
    sizeInBytes = false;
  }
  switch (type) {
    case Format.S8_R:
    case Format.S8_R_NORM:
    case Format.S8_RG_NORM:
    case Format.S8_RGB_NORM:
    case Format.S8_RGBA_NORM: {
      var buffer_1 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Int8Array(sizeOrDstBuffer)
          : new Int8Array(sizeOrDstBuffer);
      if (copyBuffer) {
        buffer_1.set(new Int8Array(copyBuffer));
      }
      return buffer_1;
    }
    case Format.U8_R:
    case Format.U8_R_NORM:
    case Format.U8_RG:
    case Format.U8_RG_NORM:
    case Format.U8_RGB:
    case Format.U8_RGB_NORM:
    case Format.U8_RGB_SRGB:
    case Format.U8_RGBA:
    case Format.U8_RGBA_NORM:
    case Format.U8_RGBA_SRGB: {
      var buffer_2 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Uint8Array(sizeOrDstBuffer)
          : new Uint8Array(sizeOrDstBuffer);
      if (copyBuffer) {
        buffer_2.set(new Uint8Array(copyBuffer));
      }
      return buffer_2;
    }
    case Format.S16_R:
    case Format.S16_RG:
    case Format.S16_RG_NORM:
    case Format.S16_RGB_NORM:
    case Format.S16_RGBA:
    case Format.S16_RGBA_NORM: {
      var buffer_3 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Int16Array(sizeOrDstBuffer)
          : new Int16Array(sizeInBytes ? sizeOrDstBuffer / 2 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer_3.set(new Int16Array(copyBuffer));
      }
      return buffer_3;
    }
    case Format.U16_R:
    case Format.U16_RGB:
    case Format.U16_RGBA_5551:
    case Format.U16_RGBA_NORM:
    case Format.U16_RG_NORM:
    case Format.U16_R_NORM: {
      var buffer_4 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Uint16Array(sizeOrDstBuffer)
          : new Uint16Array(
              sizeInBytes ? sizeOrDstBuffer / 2 : sizeOrDstBuffer,
            );
      if (copyBuffer) {
        buffer_4.set(new Uint16Array(copyBuffer));
      }
      return buffer_4;
    }
    case Format.S32_R: {
      var buffer_5 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Int32Array(sizeOrDstBuffer)
          : new Int32Array(sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer_5.set(new Int32Array(copyBuffer));
      }
      return buffer_5;
    }
    case Format.U32_R:
    case Format.U32_RG: {
      var buffer_6 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Uint32Array(sizeOrDstBuffer)
          : new Uint32Array(
              sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer,
            );
      if (copyBuffer) {
        buffer_6.set(new Uint32Array(copyBuffer));
      }
      return buffer_6;
    }
    case Format.F32_R:
    case Format.F32_RG:
    case Format.F32_RGB:
    case Format.F32_RGBA: {
      var buffer_7 =
        sizeOrDstBuffer instanceof ArrayBuffer
          ? new Float32Array(sizeOrDstBuffer)
          : new Float32Array(
              sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer,
            );
      if (copyBuffer) {
        buffer_7.set(new Float32Array(copyBuffer));
      }
      return buffer_7;
    }
  }
  var buffer =
    sizeOrDstBuffer instanceof ArrayBuffer
      ? new Uint8Array(sizeOrDstBuffer)
      : new Uint8Array(sizeOrDstBuffer);
  if (copyBuffer) {
    buffer.set(new Uint8Array(copyBuffer));
  }
  return buffer;
}
function halfFloat2Number(value) {
  var s = (value & 32768) >> 15;
  var e = (value & 31744) >> 10;
  var f = value & 1023;
  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  } else if (e == 31) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}
function getBlockInformationFromFormat(format) {
  switch (format) {
    case 'r8unorm':
    case 'r8snorm':
    case 'r8uint':
    case 'r8sint':
      return { width: 1, height: 1, length: 1 };
    case 'r16uint':
    case 'r16sint':
    case 'r16float':
    case 'rg8unorm':
    case 'rg8snorm':
    case 'rg8uint':
    case 'rg8sint':
      return { width: 1, height: 1, length: 2 };
    case 'r32uint':
    case 'r32sint':
    case 'r32float':
    case 'rg16uint':
    case 'rg16sint':
    case 'rg16float':
    case 'rgba8unorm':
    case 'rgba8unorm-srgb':
    case 'rgba8snorm':
    case 'rgba8uint':
    case 'rgba8sint':
    case 'bgra8unorm':
    case 'bgra8unorm-srgb':
    case 'rgb9e5ufloat':
    case 'rgb10a2unorm':
    case 'rg11b10ufloat':
      return { width: 1, height: 1, length: 4 };
    case 'rg32uint':
    case 'rg32sint':
    case 'rg32float':
    case 'rgba16uint':
    case 'rgba16sint':
    case 'rgba16float':
      return { width: 1, height: 1, length: 8 };
    case 'rgba32uint':
    case 'rgba32sint':
    case 'rgba32float':
      return { width: 1, height: 1, length: 16 };
    case 'stencil8':
      throw new Error('No fixed size for Stencil8 format!');
    case 'depth16unorm':
      return { width: 1, height: 1, length: 2 };
    case 'depth24plus':
      throw new Error('No fixed size for Depth24Plus format!');
    case 'depth24plus-stencil8':
      throw new Error('No fixed size for Depth24PlusStencil8 format!');
    case 'depth32float':
      return { width: 1, height: 1, length: 4 };
    case 'depth32float-stencil8':
      return { width: 1, height: 1, length: 5 };
    case 'bc7-rgba-unorm':
    case 'bc7-rgba-unorm-srgb':
    case 'bc6h-rgb-ufloat':
    case 'bc6h-rgb-float':
    case 'bc2-rgba-unorm':
    case 'bc2-rgba-unorm-srgb':
    case 'bc3-rgba-unorm':
    case 'bc3-rgba-unorm-srgb':
    case 'bc5-rg-unorm':
    case 'bc5-rg-snorm':
      return { width: 4, height: 4, length: 16 };
    case 'bc4-r-unorm':
    case 'bc4-r-snorm':
    case 'bc1-rgba-unorm':
    case 'bc1-rgba-unorm-srgb':
      return { width: 4, height: 4, length: 8 };
    default:
      return { width: 1, height: 1, length: 4 };
  }
}
var ResourceBase_WebGPU =
  /** @class */
  (function (_super) {
    __extends(ResourceBase_WebGPU2, _super);
    function ResourceBase_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device;
      var _this = _super.call(this) || this;
      _this.id = id;
      _this.device = device;
      return _this;
    }
    ResourceBase_WebGPU2.prototype.destroy = function () {};
    return ResourceBase_WebGPU2;
  })(eventemitter3_default);
var Bindings_WebGPU =
  /** @class */
  (function (_super) {
    __extends(Bindings_WebGPU2, _super);
    function Bindings_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _b, _c;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Bindings;
      var pipeline = descriptor.pipeline;
      assert(!!pipeline);
      var uniformBufferBindings = descriptor.uniformBufferBindings,
        storageBufferBindings = descriptor.storageBufferBindings,
        samplerBindings = descriptor.samplerBindings,
        storageTextureBindings = descriptor.storageTextureBindings;
      _this.numUniformBuffers =
        (uniformBufferBindings === null || uniformBufferBindings === void 0
          ? void 0
          : uniformBufferBindings.length) || 0;
      var gpuBindGroupEntries = [[], [], [], []];
      var numBindings = 0;
      if (uniformBufferBindings && uniformBufferBindings.length) {
        for (var i = 0; i < uniformBufferBindings.length; i++) {
          var _d = descriptor.uniformBufferBindings[i],
            binding = _d.binding,
            size2 = _d.size,
            offset = _d.offset,
            buffer = _d.buffer;
          var gpuBufferBinding = {
            buffer: getPlatformBuffer(buffer),
            offset: offset !== null && offset !== void 0 ? offset : 0,
            size: size2,
          };
          gpuBindGroupEntries[0].push({
            binding:
              binding !== null && binding !== void 0 ? binding : numBindings++,
            resource: gpuBufferBinding,
          });
        }
      }
      if (samplerBindings && samplerBindings.length) {
        numBindings = 0;
        for (var i = 0; i < samplerBindings.length; i++) {
          var samplerEntry = __assign(
            __assign({}, samplerBindings[i]),
            defaultBindingLayoutSamplerDescriptor,
          );
          var binding = descriptor.samplerBindings[i];
          var texture =
            binding.texture !== null
              ? binding.texture
              : _this.device['getFallbackTexture'](samplerEntry);
          samplerEntry.dimension = texture.dimension;
          samplerEntry.formatKind = getFormatSamplerKind(texture.format);
          var gpuTextureView = texture.gpuTextureView;
          gpuBindGroupEntries[1].push({
            binding:
              (_b = binding.textureBinding) !== null && _b !== void 0
                ? _b
                : numBindings++,
            resource: gpuTextureView,
          });
          if (binding.samplerBinding !== -1) {
            var sampler =
              binding.sampler !== null
                ? binding.sampler
                : _this.device['getFallbackSampler'](samplerEntry);
            var gpuSampler = getPlatformSampler(sampler);
            gpuBindGroupEntries[1].push({
              binding:
                (_c = binding.samplerBinding) !== null && _c !== void 0
                  ? _c
                  : numBindings++,
              resource: gpuSampler,
            });
          }
        }
      }
      if (storageBufferBindings && storageBufferBindings.length) {
        numBindings = 0;
        for (var i = 0; i < storageBufferBindings.length; i++) {
          var _e = descriptor.storageBufferBindings[i],
            binding = _e.binding,
            size2 = _e.size,
            offset = _e.offset,
            buffer = _e.buffer;
          var gpuBufferBinding = {
            buffer: getPlatformBuffer(buffer),
            offset: offset !== null && offset !== void 0 ? offset : 0,
            size: size2,
          };
          gpuBindGroupEntries[2].push({
            binding:
              binding !== null && binding !== void 0 ? binding : numBindings++,
            resource: gpuBufferBinding,
          });
        }
      }
      if (storageTextureBindings && storageTextureBindings.length) {
        numBindings = 0;
        for (var i = 0; i < storageTextureBindings.length; i++) {
          var _f = descriptor.storageTextureBindings[i],
            binding = _f.binding,
            texture = _f.texture;
          var gpuTextureView = texture.gpuTextureView;
          gpuBindGroupEntries[3].push({
            binding:
              binding !== null && binding !== void 0 ? binding : numBindings++,
            resource: gpuTextureView,
          });
        }
      }
      var lastGroupIndex = gpuBindGroupEntries.findLastIndex(function (group) {
        return !!group.length;
      });
      _this.gpuBindGroup = gpuBindGroupEntries.map(function (
        gpuBindGroupEntries2,
        i2,
      ) {
        return (
          i2 <= lastGroupIndex &&
          _this.device.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(i2),
            entries: gpuBindGroupEntries2,
          })
        );
      });
      return _this;
    }
    return Bindings_WebGPU2;
  })(ResourceBase_WebGPU);
var Buffer_WebGPU =
  /** @class */
  (function (_super) {
    __extends(Buffer_WebGPU2, _super);
    function Buffer_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Buffer;
      var usage = descriptor.usage,
        viewOrSize = descriptor.viewOrSize;
      var useMapRead = !!(usage & BufferUsage.MAP_READ);
      _this.usage = translateBufferUsage(usage);
      if (useMapRead) {
        _this.usage = BufferUsage.MAP_READ | BufferUsage.COPY_DST;
      }
      var mapBuffer = !is_number_default(viewOrSize);
      _this.view = !is_number_default(viewOrSize) ? viewOrSize : null;
      _this.size = is_number_default(viewOrSize)
        ? align(viewOrSize, 4)
        : align(viewOrSize.byteLength, 4);
      if (!is_number_default(viewOrSize)) {
        _this.gpuBuffer = _this.device.device.createBuffer({
          usage: _this.usage,
          size: _this.size,
          mappedAtCreation: true,
        });
        var ctor = (viewOrSize && viewOrSize.constructor) || Float32Array;
        new ctor(_this.gpuBuffer.getMappedRange()).set(viewOrSize);
        _this.gpuBuffer.unmap();
      } else {
        _this.gpuBuffer = _this.device.device.createBuffer({
          usage: _this.usage,
          size: _this.size,
          mappedAtCreation: useMapRead ? mapBuffer : false,
        });
      }
      return _this;
    }
    Buffer_WebGPU2.prototype.setSubData = function (
      dstByteOffset,
      src,
      srcByteOffset,
      byteLength,
    ) {
      if (srcByteOffset === void 0) {
        srcByteOffset = 0;
      }
      if (byteLength === void 0) {
        byteLength = 0;
      }
      var buffer = this.gpuBuffer;
      byteLength = byteLength || src.byteLength;
      byteLength = Math.min(byteLength, this.size - dstByteOffset);
      var chunkStart = src.byteOffset + srcByteOffset;
      var chunkEnd = chunkStart + byteLength;
      var alignedLength = (byteLength + 3) & ~3;
      if (alignedLength !== byteLength) {
        var tempView = new Uint8Array(src.buffer.slice(chunkStart, chunkEnd));
        src = new Uint8Array(alignedLength);
        src.set(tempView);
        srcByteOffset = 0;
        chunkStart = 0;
        chunkEnd = alignedLength;
        byteLength = alignedLength;
      }
      var maxChunk = 1024 * 1024 * 15;
      var offset = 0;
      while (chunkEnd - (chunkStart + offset) > maxChunk) {
        this.device.device.queue.writeBuffer(
          buffer,
          dstByteOffset + offset,
          src.buffer,
          chunkStart + offset,
          maxChunk,
        );
        offset += maxChunk;
      }
      this.device.device.queue.writeBuffer(
        buffer,
        dstByteOffset + offset,
        src.buffer,
        chunkStart + offset,
        byteLength - offset,
      );
    };
    Buffer_WebGPU2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      this.gpuBuffer.destroy();
    };
    return Buffer_WebGPU2;
  })(ResourceBase_WebGPU);
var ComputePass_WebGPU =
  /** @class */
  (function () {
    function ComputePass_WebGPU2() {
      this.gpuComputePassEncoder = null;
    }
    ComputePass_WebGPU2.prototype.dispatchWorkgroups = function (
      workgroupCountX,
      workgroupCountY,
      workgroupCountZ,
    ) {
      this.gpuComputePassEncoder.dispatchWorkgroups(
        workgroupCountX,
        workgroupCountY,
        workgroupCountZ,
      );
    };
    ComputePass_WebGPU2.prototype.dispatchWorkgroupsIndirect = function (
      indirectBuffer,
      indirectOffset,
    ) {
      this.gpuComputePassEncoder.dispatchWorkgroupsIndirect(
        indirectBuffer.gpuBuffer,
        indirectOffset,
      );
    };
    ComputePass_WebGPU2.prototype.finish = function () {
      this.gpuComputePassEncoder.end();
      this.gpuComputePassEncoder = null;
      this.frameCommandEncoder = null;
    };
    ComputePass_WebGPU2.prototype.beginComputePass = function (commandEncoder) {
      assert(this.gpuComputePassEncoder === null);
      this.frameCommandEncoder = commandEncoder;
      this.gpuComputePassEncoder = this.frameCommandEncoder.beginComputePass(
        this.gpuComputePassDescriptor,
      );
    };
    ComputePass_WebGPU2.prototype.setPipeline = function (pipeline_) {
      var pipeline = pipeline_;
      var gpuComputePipeline = assertExists(pipeline.gpuComputePipeline);
      this.gpuComputePassEncoder.setPipeline(gpuComputePipeline);
    };
    ComputePass_WebGPU2.prototype.setBindings = function (bindings_) {
      var _this = this;
      var bindings = bindings_;
      bindings.gpuBindGroup.forEach(function (gpuBindGroup, i) {
        if (gpuBindGroup) {
          _this.gpuComputePassEncoder.setBindGroup(i, bindings.gpuBindGroup[i]);
        }
      });
    };
    ComputePass_WebGPU2.prototype.pushDebugGroup = function (name) {
      this.gpuComputePassEncoder.pushDebugGroup(name);
    };
    ComputePass_WebGPU2.prototype.popDebugGroup = function () {
      this.gpuComputePassEncoder.popDebugGroup();
    };
    ComputePass_WebGPU2.prototype.insertDebugMarker = function (markerLabel) {
      this.gpuComputePassEncoder.insertDebugMarker(markerLabel);
    };
    return ComputePass_WebGPU2;
  })();
var ComputePipeline_WebGPU =
  /** @class */
  (function (_super) {
    __extends(ComputePipeline_WebGPU2, _super);
    function ComputePipeline_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.ComputePipeline;
      _this.gpuComputePipeline = null;
      _this.descriptor = descriptor;
      var program = descriptor.program;
      var computeStage = program.computeStage;
      if (computeStage === null) return _this;
      var gpuComputePipeline = {
        layout: 'auto',
        compute: __assign({}, computeStage),
      };
      _this.gpuComputePipeline =
        _this.device.device.createComputePipeline(gpuComputePipeline);
      if (_this.name !== void 0) {
        _this.gpuComputePipeline.label = _this.name;
      }
      return _this;
    }
    ComputePipeline_WebGPU2.prototype.getBindGroupLayout = function (index) {
      return this.gpuComputePipeline.getBindGroupLayout(index);
    };
    return ComputePipeline_WebGPU2;
  })(ResourceBase_WebGPU);
var InputLayout_WebGPU =
  /** @class */
  (function (_super) {
    __extends(InputLayout_WebGPU2, _super);
    function InputLayout_WebGPU2(_a2) {
      var e_1, _b, e_2, _c;
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.InputLayout;
      var buffers = [];
      try {
        for (
          var _d = __values(descriptor.vertexBufferDescriptors), _e = _d.next();
          !_e.done;
          _e = _d.next()
        ) {
          var vertexBufferDescriptor = _e.value;
          var arrayStride = vertexBufferDescriptor.arrayStride,
            stepMode = vertexBufferDescriptor.stepMode,
            attributes = vertexBufferDescriptor.attributes;
          buffers.push({
            arrayStride,
            stepMode: translateVertexStepMode(stepMode),
            attributes: [],
          });
          try {
            for (
              var attributes_1 = ((e_2 = void 0), __values(attributes)),
                attributes_1_1 = attributes_1.next();
              !attributes_1_1.done;
              attributes_1_1 = attributes_1.next()
            ) {
              var attribute = attributes_1_1.value;
              var shaderLocation = attribute.shaderLocation,
                format = attribute.format,
                offset = attribute.offset;
              buffers[buffers.length - 1].attributes.push({
                shaderLocation,
                format: translateVertexFormat(format),
                offset,
              });
            }
          } catch (e_2_1) {
            e_2 = { error: e_2_1 };
          } finally {
            try {
              if (
                attributes_1_1 &&
                !attributes_1_1.done &&
                (_c = attributes_1.return)
              )
                _c.call(attributes_1);
            } finally {
              if (e_2) throw e_2.error;
            }
          }
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      _this.indexFormat = translateIndexFormat(descriptor.indexBufferFormat);
      _this.buffers = buffers;
      return _this;
    }
    return InputLayout_WebGPU2;
  })(ResourceBase_WebGPU);
var Program_WebGPU =
  /** @class */
  (function (_super) {
    __extends(Program_WebGPU2, _super);
    function Program_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Program;
      _this.vertexStage = null;
      _this.fragmentStage = null;
      _this.computeStage = null;
      _this.descriptor = descriptor;
      if (descriptor.vertex) {
        _this.vertexStage = _this.createShaderStage(
          descriptor.vertex,
          'vertex',
        );
      }
      if (descriptor.fragment) {
        _this.fragmentStage = _this.createShaderStage(
          descriptor.fragment,
          'fragment',
        );
      }
      if (descriptor.compute) {
        _this.computeStage = _this.createShaderStage(
          descriptor.compute,
          'compute',
        );
      }
      return _this;
    }
    Program_WebGPU2.prototype.setUniformsLegacy = function (uniforms) {};
    Program_WebGPU2.prototype.createShaderStage = function (_a2, shaderStage) {
      var e_1, _b;
      var glsl = _a2.glsl,
        wgsl = _a2.wgsl,
        entryPoint = _a2.entryPoint,
        postprocess = _a2.postprocess;
      var validationEnabled = false;
      var code = wgsl;
      if (!code) {
        try {
          code = this.device['glsl_compile'](
            glsl,
            shaderStage,
            validationEnabled,
          );
        } catch (e) {
          console.error(e, glsl);
          throw new Error('whoops');
        }
      }
      var _loop_1 = function (depthTextureName2) {
        if (!code.includes(depthTextureName2)) return 'continue';
        code = code.replace(
          'var T_'.concat(depthTextureName2, ': texture_2d<f32>;'),
          'var T_'.concat(depthTextureName2, ': texture_depth_2d;'),
        );
        code = code.replace(
          new RegExp(
            'textureSample\\(T_'.concat(depthTextureName2, '(.*)\\);$'),
            'gm',
          ),
          function (sub, cap) {
            return 'vec4<f32>(textureSample(T_'
              .concat(depthTextureName2)
              .concat(cap, '), 0.0, 0.0, 0.0);');
          },
        );
      };
      try {
        for (
          var _c = __values(['u_TextureFramebufferDepth']), _d = _c.next();
          !_d.done;
          _d = _c.next()
        ) {
          var depthTextureName = _d.value;
          _loop_1(depthTextureName);
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      if (postprocess) {
        code = postprocess(code);
      }
      var shaderModule = this.device.device.createShaderModule({ code });
      return { module: shaderModule, entryPoint: entryPoint || 'main' };
    };
    return Program_WebGPU2;
  })(ResourceBase_WebGPU);
var QueryPool_WebGPU =
  /** @class */
  (function (_super) {
    __extends(QueryPool_WebGPU2, _super);
    function QueryPool_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.QueryPool;
      var elemCount = descriptor.elemCount,
        type = descriptor.type;
      _this.querySet = _this.device.device.createQuerySet({
        type: translateQueryPoolType(type),
        count: elemCount,
      });
      _this.resolveBuffer = _this.device.device.createBuffer({
        size: elemCount * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
      _this.cpuBuffer = _this.device.device.createBuffer({
        size: elemCount * 8,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      _this.results = null;
      return _this;
    }
    QueryPool_WebGPU2.prototype.queryResultOcclusion = function (dstOffs) {
      if (this.results === null) return null;
      return this.results[dstOffs] !== BigInt(0);
    };
    QueryPool_WebGPU2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      this.querySet.destroy();
      this.resolveBuffer.destroy();
      this.cpuBuffer.destroy();
    };
    return QueryPool_WebGPU2;
  })(ResourceBase_WebGPU);
var Readback_WebGPU =
  /** @class */
  (function (_super) {
    __extends(Readback_WebGPU2, _super);
    function Readback_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Readback;
      return _this;
    }
    Readback_WebGPU2.prototype.readTexture = function (
      t,
      x,
      y,
      width,
      height,
      dst,
      dstOffset,
      length,
    ) {
      if (dstOffset === void 0) {
        dstOffset = 0;
      }
      return __awaiter(this, void 0, void 0, function () {
        var texture,
          faceIndex,
          blockInformation,
          bytesPerRow,
          bytesPerRowAligned,
          size2,
          buffer,
          commandEncoder;
        return __generator(this, function (_a2) {
          texture = t;
          faceIndex = 0;
          blockInformation = getBlockInformationFromFormat(
            texture.gpuTextureformat,
          );
          bytesPerRow =
            Math.ceil(width / blockInformation.width) * blockInformation.length;
          bytesPerRowAligned = Math.ceil(bytesPerRow / 256) * 256;
          size2 = bytesPerRowAligned * height;
          buffer = this.device.createBuffer({
            usage:
              BufferUsage.STORAGE | BufferUsage.MAP_READ | BufferUsage.COPY_DST,
            hint: BufferFrequencyHint.STATIC,
            viewOrSize: size2,
          });
          commandEncoder = this.device.device.createCommandEncoder();
          commandEncoder.copyTextureToBuffer(
            {
              texture: texture.gpuTexture,
              mipLevel: 0,
              origin: {
                x,
                y,
                z: Math.max(faceIndex, 0),
              },
            },
            {
              buffer: buffer.gpuBuffer,
              offset: 0,
              bytesPerRow: bytesPerRowAligned,
            },
            {
              width,
              height,
              depthOrArrayLayers: 1,
            },
          );
          this.device.device.queue.submit([commandEncoder.finish()]);
          return [
            2,
            this.readBuffer(
              buffer,
              0,
              dst.byteLength === size2 ? dst : null,
              dstOffset,
              size2,
              texture.format,
              true,
              false,
              bytesPerRow,
              bytesPerRowAligned,
              height,
            ),
          ];
        });
      });
    };
    Readback_WebGPU2.prototype.readTextureSync = function (
      t,
      x,
      y,
      width,
      height,
      dst,
      dstOffset,
      length,
    ) {
      throw new Error('ERROR_MSG_METHOD_NOT_IMPLEMENTED');
    };
    Readback_WebGPU2.prototype.readBuffer = function (
      b,
      srcByteOffset,
      dstArrayBufferView,
      dstOffset,
      _size,
      type,
      noDataConversion,
      destroy,
      bytesPerRow,
      bytesPerRowAligned,
      height,
    ) {
      var _this = this;
      if (srcByteOffset === void 0) {
        srcByteOffset = 0;
      }
      if (dstArrayBufferView === void 0) {
        dstArrayBufferView = null;
      }
      if (_size === void 0) {
        _size = 0;
      }
      if (type === void 0) {
        type = Format.U8_RGB;
      }
      if (noDataConversion === void 0) {
        noDataConversion = false;
      }
      if (bytesPerRow === void 0) {
        bytesPerRow = 0;
      }
      if (bytesPerRowAligned === void 0) {
        bytesPerRowAligned = 0;
      }
      if (height === void 0) {
        height = 0;
      }
      var buffer = b;
      var size2 = _size || buffer.size;
      var dst = dstArrayBufferView || buffer.view;
      var floatFormat =
        // @ts-ignore
        (dst && dst.constructor && dst.constructor.BYTES_PER_ELEMENT) ||
        getFormatCompByteSize(type);
      var gpuReadBuffer = buffer;
      if (
        !(
          buffer.usage & BufferUsage.MAP_READ &&
          buffer.usage & BufferUsage.COPY_DST
        )
      ) {
        var commandEncoder = this.device.device.createCommandEncoder();
        gpuReadBuffer = this.device.createBuffer({
          usage:
            BufferUsage.STORAGE | BufferUsage.MAP_READ | BufferUsage.COPY_DST,
          hint: BufferFrequencyHint.STATIC,
          viewOrSize: size2,
        });
        commandEncoder.copyBufferToBuffer(
          buffer.gpuBuffer,
          srcByteOffset,
          gpuReadBuffer.gpuBuffer,
          0,
          size2,
          /* size */
        );
        this.device.device.queue.submit([commandEncoder.finish()]);
      }
      return new Promise(function (resolve, reject) {
        gpuReadBuffer.gpuBuffer
          .mapAsync(GPUMapMode.READ, srcByteOffset, size2)
          .then(
            function () {
              var copyArrayBuffer = gpuReadBuffer.gpuBuffer.getMappedRange(
                srcByteOffset,
                size2,
              );
              var data = dst;
              if (noDataConversion) {
                if (data === null) {
                  data = allocateAndCopyTypedBuffer(
                    type,
                    size2,
                    true,
                    copyArrayBuffer,
                  );
                } else {
                  data = allocateAndCopyTypedBuffer(
                    type,
                    data.buffer,
                    void 0,
                    copyArrayBuffer,
                  );
                }
              } else {
                if (data === null) {
                  switch (floatFormat) {
                    case 1:
                      data = new Uint8Array(size2);
                      data.set(new Uint8Array(copyArrayBuffer));
                      break;
                    case 2:
                      data = _this.getHalfFloatAsFloatRGBAArrayBuffer(
                        size2 / 2,
                        copyArrayBuffer,
                      );
                      break;
                    case 4:
                      data = new Float32Array(size2 / 4);
                      data.set(new Float32Array(copyArrayBuffer));
                      break;
                  }
                } else {
                  switch (floatFormat) {
                    case 1:
                      data = new Uint8Array(data.buffer);
                      data.set(new Uint8Array(copyArrayBuffer));
                      break;
                    case 2:
                      data = _this.getHalfFloatAsFloatRGBAArrayBuffer(
                        size2 / 2,
                        copyArrayBuffer,
                        dst,
                      );
                      break;
                    case 4:
                      var ctor = (dst && dst.constructor) || Float32Array;
                      data = new ctor(data.buffer);
                      data.set(new ctor(copyArrayBuffer));
                      break;
                  }
                }
              }
              if (bytesPerRow !== bytesPerRowAligned) {
                if (floatFormat === 1 && !noDataConversion) {
                  bytesPerRow *= 2;
                  bytesPerRowAligned *= 2;
                }
                var data2 = new Uint8Array(data.buffer);
                var offset = bytesPerRow,
                  offset2 = 0;
                for (var y = 1; y < height; ++y) {
                  offset2 = y * bytesPerRowAligned;
                  for (var x = 0; x < bytesPerRow; ++x) {
                    data2[offset++] = data2[offset2++];
                  }
                }
                if (floatFormat !== 0 && !noDataConversion) {
                  data = new Float32Array(data2.buffer, 0, offset / 4);
                } else {
                  data = new Uint8Array(data2.buffer, 0, offset);
                }
              }
              gpuReadBuffer.gpuBuffer.unmap();
              resolve(data);
            },
            function (reason) {
              return reject(reason);
            },
          );
      });
    };
    Readback_WebGPU2.prototype.getHalfFloatAsFloatRGBAArrayBuffer = function (
      dataLength,
      arrayBuffer,
      destArray,
    ) {
      if (!destArray) {
        destArray = new Float32Array(dataLength);
      }
      var srcData = new Uint16Array(arrayBuffer);
      while (dataLength--) {
        destArray[dataLength] = halfFloat2Number(srcData[dataLength]);
      }
      return destArray;
    };
    return Readback_WebGPU2;
  })(ResourceBase_WebGPU);
var RenderPass_WebGPU =
  /** @class */
  (function () {
    function RenderPass_WebGPU2(device) {
      this.device = device;
      this.gpuRenderPassEncoder = null;
      this.gfxColorAttachment = [];
      this.gfxColorAttachmentLevel = [];
      this.gfxColorResolveTo = [];
      this.gfxColorResolveToLevel = [];
      this.gfxDepthStencilAttachment = null;
      this.gfxDepthStencilResolveTo = null;
      this.gpuColorAttachments = [];
      this.gpuDepthStencilAttachment = {
        view: null,
        depthLoadOp: 'load',
        depthStoreOp: 'store',
        stencilLoadOp: 'load',
        stencilStoreOp: 'store',
      };
      this.gpuRenderPassDescriptor = {
        colorAttachments: this.gpuColorAttachments,
        depthStencilAttachment: this.gpuDepthStencilAttachment,
      };
    }
    RenderPass_WebGPU2.prototype.getEncoder = function () {
      var _a2;
      return (
        ((_a2 = this.renderBundle) === null || _a2 === void 0
          ? void 0
          : _a2['renderBundleEncoder']) || this.gpuRenderPassEncoder
      );
    };
    RenderPass_WebGPU2.prototype.getTextureView = function (target, level) {
      assert(level < target.mipLevelCount);
      if (target.mipLevelCount === 1) return target.gpuTextureView;
      else
        return target.gpuTexture.createView({
          baseMipLevel: level,
          mipLevelCount: 1,
        });
    };
    RenderPass_WebGPU2.prototype.setRenderPassDescriptor = function (
      descriptor,
    ) {
      var _a2, _b, _c, _d, _e, _f;
      this.descriptor = descriptor;
      this.gpuRenderPassDescriptor.colorAttachments = this.gpuColorAttachments;
      var numColorAttachments = descriptor.colorAttachment.length;
      this.gfxColorAttachment.length = numColorAttachments;
      this.gfxColorResolveTo.length = numColorAttachments;
      for (var i = 0; i < descriptor.colorAttachment.length; i++) {
        var colorAttachment = descriptor.colorAttachment[i];
        var colorResolveTo = descriptor.colorResolveTo[i];
        if (colorAttachment === null && colorResolveTo !== null) {
          colorAttachment = colorResolveTo;
          colorResolveTo = null;
        }
        this.gfxColorAttachment[i] = colorAttachment;
        this.gfxColorResolveTo[i] = colorResolveTo;
        this.gfxColorAttachmentLevel[i] =
          ((_a2 = descriptor.colorAttachmentLevel) === null || _a2 === void 0
            ? void 0
            : _a2[i]) || 0;
        this.gfxColorResolveToLevel[i] =
          ((_b = descriptor.colorResolveToLevel) === null || _b === void 0
            ? void 0
            : _b[i]) || 0;
        if (colorAttachment !== null) {
          if (this.gpuColorAttachments[i] === void 0) {
            this.gpuColorAttachments[i] = {};
          }
          var dstAttachment = this.gpuColorAttachments[i];
          dstAttachment.view = this.getTextureView(
            colorAttachment,
            ((_c = this.gfxColorAttachmentLevel) === null || _c === void 0
              ? void 0
              : _c[i]) || 0,
          );
          var clearColor =
            (_e =
              (_d = descriptor.colorClearColor) === null || _d === void 0
                ? void 0
                : _d[i]) !== null && _e !== void 0
              ? _e
              : 'load';
          if (clearColor === 'load') {
            dstAttachment.loadOp = 'load';
          } else {
            dstAttachment.loadOp = 'clear';
            dstAttachment.clearValue = clearColor;
          }
          dstAttachment.storeOp = (
            (_f = descriptor.colorStore) === null || _f === void 0
              ? void 0
              : _f[i]
          )
            ? 'store'
            : 'discard';
          dstAttachment.resolveTarget = void 0;
          if (colorResolveTo !== null) {
            if (colorAttachment.sampleCount > 1) {
              dstAttachment.resolveTarget = this.getTextureView(
                colorResolveTo,
                this.gfxColorResolveToLevel[i],
              );
            } else {
              dstAttachment.storeOp = 'store';
            }
          }
        } else {
          this.gpuColorAttachments.length = i;
          this.gfxColorAttachment.length = i;
          this.gfxColorResolveTo.length = i;
          break;
        }
      }
      this.gfxDepthStencilAttachment = descriptor.depthStencilAttachment;
      this.gfxDepthStencilResolveTo = descriptor.depthStencilResolveTo;
      if (descriptor.depthStencilAttachment) {
        var dsAttachment = descriptor.depthStencilAttachment;
        var dstAttachment = this.gpuDepthStencilAttachment;
        dstAttachment.view = dsAttachment.gpuTextureView;
        var hasDepth = !!(
          getFormatFlags(dsAttachment.format) & FormatFlags.Depth
        );
        if (hasDepth) {
          if (descriptor.depthClearValue === 'load') {
            dstAttachment.depthLoadOp = 'load';
          } else {
            dstAttachment.depthLoadOp = 'clear';
            dstAttachment.depthClearValue = descriptor.depthClearValue;
          }
          if (
            descriptor.depthStencilStore ||
            this.gfxDepthStencilResolveTo !== null
          )
            dstAttachment.depthStoreOp = 'store';
          else dstAttachment.depthStoreOp = 'discard';
        } else {
          dstAttachment.depthLoadOp = void 0;
          dstAttachment.depthStoreOp = void 0;
        }
        var hasStencil = !!(
          getFormatFlags(dsAttachment.format) & FormatFlags.Stencil
        );
        if (hasStencil) {
          if (descriptor.stencilClearValue === 'load') {
            dstAttachment.stencilLoadOp = 'load';
          } else {
            dstAttachment.stencilLoadOp = 'clear';
            dstAttachment.stencilClearValue = descriptor.stencilClearValue;
          }
          if (
            descriptor.depthStencilStore ||
            this.gfxDepthStencilResolveTo !== null
          )
            dstAttachment.stencilStoreOp = 'store';
          else dstAttachment.stencilStoreOp = 'discard';
        } else {
          dstAttachment.stencilLoadOp = void 0;
          dstAttachment.stencilStoreOp = void 0;
        }
        this.gpuRenderPassDescriptor.depthStencilAttachment =
          this.gpuDepthStencilAttachment;
      } else {
        this.gpuRenderPassDescriptor.depthStencilAttachment = void 0;
      }
      this.gpuRenderPassDescriptor.occlusionQuerySet = !is_nil_default(
        descriptor.occlusionQueryPool,
      )
        ? getPlatformQuerySet(descriptor.occlusionQueryPool)
        : void 0;
    };
    RenderPass_WebGPU2.prototype.beginRenderPass = function (
      commandEncoder,
      renderPassDescriptor,
    ) {
      assert(this.gpuRenderPassEncoder === null);
      this.setRenderPassDescriptor(renderPassDescriptor);
      this.frameCommandEncoder = commandEncoder;
      this.gpuRenderPassEncoder = this.frameCommandEncoder.beginRenderPass(
        this.gpuRenderPassDescriptor,
      );
    };
    RenderPass_WebGPU2.prototype.flipY = function (y, h) {
      var height = this.device['swapChainHeight'];
      return height - y - h;
    };
    RenderPass_WebGPU2.prototype.setViewport = function (
      x,
      y,
      w,
      h,
      minDepth,
      maxDepth,
    ) {
      if (minDepth === void 0) {
        minDepth = 0;
      }
      if (maxDepth === void 0) {
        maxDepth = 1;
      }
      this.gpuRenderPassEncoder.setViewport(
        x,
        this.flipY(y, h),
        w,
        h,
        minDepth,
        maxDepth,
      );
    };
    RenderPass_WebGPU2.prototype.setScissorRect = function (x, y, w, h) {
      this.gpuRenderPassEncoder.setScissorRect(x, this.flipY(y, h), w, h);
    };
    RenderPass_WebGPU2.prototype.setPipeline = function (pipeline_) {
      var pipeline = pipeline_;
      var gpuRenderPipeline = assertExists(pipeline.gpuRenderPipeline);
      this.getEncoder().setPipeline(gpuRenderPipeline);
    };
    RenderPass_WebGPU2.prototype.setVertexInput = function (
      inputLayout_,
      vertexBuffers,
      indexBuffer,
    ) {
      if (inputLayout_ === null) return;
      var encoder = this.getEncoder();
      var inputLayout = inputLayout_;
      if (indexBuffer !== null)
        encoder.setIndexBuffer(
          getPlatformBuffer(indexBuffer.buffer),
          assertExists(inputLayout.indexFormat),
          indexBuffer.offset,
        );
      for (var i = 0; i < vertexBuffers.length; i++) {
        var b = vertexBuffers[i];
        if (b === null) continue;
        encoder.setVertexBuffer(i, getPlatformBuffer(b.buffer), b.offset);
      }
    };
    RenderPass_WebGPU2.prototype.setBindings = function (bindings_) {
      var bindings = bindings_;
      var encoder = this.getEncoder();
      bindings.gpuBindGroup.forEach(function (gpuBindGroup, i) {
        if (gpuBindGroup) {
          encoder.setBindGroup(i, bindings.gpuBindGroup[i]);
        }
      });
    };
    RenderPass_WebGPU2.prototype.setStencilReference = function (ref) {
      this.gpuRenderPassEncoder.setStencilReference(ref);
    };
    RenderPass_WebGPU2.prototype.draw = function (
      vertexCount,
      instanceCount,
      firstVertex,
      firstInstance,
    ) {
      this.getEncoder().draw(
        vertexCount,
        instanceCount,
        firstVertex,
        firstInstance,
      );
    };
    RenderPass_WebGPU2.prototype.drawIndexed = function (
      indexCount,
      instanceCount,
      firstIndex,
      baseVertex,
      firstInstance,
    ) {
      this.getEncoder().drawIndexed(
        indexCount,
        instanceCount,
        firstIndex,
        baseVertex,
        firstInstance,
      );
    };
    RenderPass_WebGPU2.prototype.drawIndirect = function (
      indirectBuffer,
      indirectOffset,
    ) {
      this.getEncoder().drawIndirect(
        getPlatformBuffer(indirectBuffer),
        indirectOffset,
      );
    };
    RenderPass_WebGPU2.prototype.drawIndexedIndirect = function (
      indirectBuffer,
      indirectOffset,
    ) {
      this.getEncoder().drawIndexedIndirect(
        getPlatformBuffer(indirectBuffer),
        indirectOffset,
      );
    };
    RenderPass_WebGPU2.prototype.beginOcclusionQuery = function (queryIndex) {
      this.gpuRenderPassEncoder.beginOcclusionQuery(queryIndex);
    };
    RenderPass_WebGPU2.prototype.endOcclusionQuery = function () {
      this.gpuRenderPassEncoder.endOcclusionQuery();
    };
    RenderPass_WebGPU2.prototype.pushDebugGroup = function (name) {
      this.gpuRenderPassEncoder.pushDebugGroup(name);
    };
    RenderPass_WebGPU2.prototype.popDebugGroup = function () {
      this.gpuRenderPassEncoder.popDebugGroup();
    };
    RenderPass_WebGPU2.prototype.insertDebugMarker = function (markerLabel) {
      this.gpuRenderPassEncoder.insertDebugMarker(markerLabel);
    };
    RenderPass_WebGPU2.prototype.beginBundle = function (renderBundle) {
      this.renderBundle = renderBundle;
    };
    RenderPass_WebGPU2.prototype.endBundle = function () {
      this.renderBundle.finish();
    };
    RenderPass_WebGPU2.prototype.executeBundles = function (renderBundles) {
      this.gpuRenderPassEncoder.executeBundles(
        renderBundles.map(function (bundle) {
          return bundle.renderBundle;
        }),
      );
    };
    RenderPass_WebGPU2.prototype.finish = function () {
      var _a2;
      (_a2 = this.gpuRenderPassEncoder) === null || _a2 === void 0
        ? void 0
        : _a2.end();
      this.gpuRenderPassEncoder = null;
      for (var i = 0; i < this.gfxColorAttachment.length; i++) {
        var colorAttachment = this.gfxColorAttachment[i];
        var colorResolveTo = this.gfxColorResolveTo[i];
        if (
          colorAttachment !== null &&
          colorResolveTo !== null &&
          colorAttachment.sampleCount === 1
        ) {
          this.copyAttachment(
            colorResolveTo,
            this.gfxColorAttachmentLevel[i],
            colorAttachment,
            this.gfxColorResolveToLevel[i],
          );
        }
      }
      if (this.gfxDepthStencilAttachment && this.gfxDepthStencilResolveTo) {
        if (this.gfxDepthStencilAttachment.sampleCount > 1);
        else {
          this.copyAttachment(
            this.gfxDepthStencilResolveTo,
            0,
            this.gfxDepthStencilAttachment,
            0,
          );
        }
      }
      this.frameCommandEncoder = null;
    };
    RenderPass_WebGPU2.prototype.copyAttachment = function (
      dst,
      dstLevel,
      src,
      srcLevel,
    ) {
      assert(src.sampleCount === 1);
      var srcCopy = {
        texture: src.gpuTexture,
        mipLevel: srcLevel,
      };
      var dstCopy = {
        texture: dst.gpuTexture,
        mipLevel: dstLevel,
      };
      assert(src.width >>> srcLevel === dst.width >>> dstLevel);
      assert(src.height >>> srcLevel === dst.height >>> dstLevel);
      assert(!!(src.usage & GPUTextureUsage$1.COPY_SRC));
      assert(!!(dst.usage & GPUTextureUsage$1.COPY_DST));
      this.frameCommandEncoder.copyTextureToTexture(srcCopy, dstCopy, [
        dst.width,
        dst.height,
        1,
      ]);
    };
    return RenderPass_WebGPU2;
  })();
var RenderPipeline_WebGPU =
  /** @class */
  (function (_super) {
    __extends(RenderPipeline_WebGPU2, _super);
    function RenderPipeline_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.RenderPipeline;
      _this.isCreatingAsync = false;
      _this.gpuRenderPipeline = null;
      _this.descriptor = descriptor;
      _this.device['createRenderPipelineInternal'](_this, false);
      return _this;
    }
    RenderPipeline_WebGPU2.prototype.getBindGroupLayout = function (index) {
      return this.gpuRenderPipeline.getBindGroupLayout(index);
    };
    return RenderPipeline_WebGPU2;
  })(ResourceBase_WebGPU);
var Sampler_WebGPU =
  /** @class */
  (function (_super) {
    __extends(Sampler_WebGPU2, _super);
    function Sampler_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor;
      var _b, _c;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Sampler;
      var lodMinClamp = descriptor.lodMinClamp;
      var lodMaxClamp =
        descriptor.mipmapFilter === MipmapFilterMode.NO_MIP
          ? descriptor.lodMinClamp
          : descriptor.lodMaxClamp;
      var maxAnisotropy =
        (_b = descriptor.maxAnisotropy) !== null && _b !== void 0 ? _b : 1;
      if (maxAnisotropy > 1)
        assert(
          descriptor.minFilter === FilterMode.BILINEAR &&
            descriptor.magFilter === FilterMode.BILINEAR &&
            descriptor.mipmapFilter === MipmapFilterMode.LINEAR,
        );
      _this.gpuSampler = _this.device.device.createSampler({
        addressModeU: translateAddressMode(descriptor.addressModeU),
        addressModeV: translateAddressMode(descriptor.addressModeV),
        addressModeW: translateAddressMode(
          (_c = descriptor.addressModeW) !== null && _c !== void 0
            ? _c
            : descriptor.addressModeU,
        ),
        lodMinClamp,
        lodMaxClamp,
        minFilter: translateMinMagFilter(descriptor.minFilter),
        magFilter: translateMinMagFilter(descriptor.magFilter),
        mipmapFilter: translateMipFilter(descriptor.mipmapFilter),
        compare:
          descriptor.compareFunction !== void 0
            ? translateCompareFunction(descriptor.compareFunction)
            : void 0,
        maxAnisotropy,
      });
      return _this;
    }
    return Sampler_WebGPU2;
  })(ResourceBase_WebGPU);
var Texture_WebGPU =
  /** @class */
  (function (_super) {
    __extends(Texture_WebGPU2, _super);
    function Texture_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device,
        descriptor = _a2.descriptor,
        skipCreate = _a2.skipCreate,
        sampleCount = _a2.sampleCount;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.Texture;
      _this.flipY = false;
      var format = descriptor.format,
        dimension = descriptor.dimension,
        width = descriptor.width,
        height = descriptor.height,
        depthOrArrayLayers = descriptor.depthOrArrayLayers,
        mipLevelCount = descriptor.mipLevelCount,
        usage = descriptor.usage,
        pixelStore = descriptor.pixelStore;
      _this.flipY = !!(pixelStore === null || pixelStore === void 0
        ? void 0
        : pixelStore.unpackFlipY);
      _this.device.createTextureShared(
        {
          format,
          dimension:
            dimension !== null && dimension !== void 0
              ? dimension
              : TextureDimension.TEXTURE_2D,
          width,
          height,
          depthOrArrayLayers:
            depthOrArrayLayers !== null && depthOrArrayLayers !== void 0
              ? depthOrArrayLayers
              : 1,
          mipLevelCount:
            mipLevelCount !== null && mipLevelCount !== void 0
              ? mipLevelCount
              : 1,
          usage,
          sampleCount:
            sampleCount !== null && sampleCount !== void 0 ? sampleCount : 1,
        },
        _this,
        skipCreate,
      );
      return _this;
    }
    Texture_WebGPU2.prototype.textureFromImageBitmapOrCanvas = function (
      device,
      sources,
      depthOrArrayLayers,
    ) {
      var width = sources[0].width;
      var height = sources[0].height;
      var textureDescriptor = {
        // Unlike in WebGL, the size of our texture must be set at texture creation time.
        // This means we have to wait until the image is loaded to create the texture, since we won't
        // know the size until then.
        size: { width, height, depthOrArrayLayers },
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      };
      var texture = device.createTexture(textureDescriptor);
      for (var i = 0; i < sources.length; i++) {
        device.queue.copyExternalImageToTexture(
          { source: sources[i], flipY: this.flipY },
          { texture, origin: [0, 0, i] },
          [width, height],
        );
      }
      return [texture, width, height];
    };
    Texture_WebGPU2.prototype.isImageBitmapOrCanvases = function (datas) {
      var data = datas[0];
      return (
        data instanceof ImageBitmap ||
        data instanceof HTMLCanvasElement ||
        data instanceof OffscreenCanvas
      );
    };
    Texture_WebGPU2.prototype.isVideo = function (datas) {
      var data = datas[0];
      return data instanceof HTMLVideoElement;
    };
    Texture_WebGPU2.prototype.setImageData = function (datas, lod) {
      var _a2;
      var _this = this;
      var device = this.device.device;
      var texture;
      var width;
      var height;
      if (this.isImageBitmapOrCanvases(datas)) {
        (_a2 = __read(
          this.textureFromImageBitmapOrCanvas(
            device,
            datas,
            this.depthOrArrayLayers,
          ),
          3,
        )),
          (texture = _a2[0]),
          (width = _a2[1]),
          (height = _a2[2]);
      } else if (this.isVideo(datas)) {
        texture = device.importExternalTexture({
          source: datas[0],
        });
      } else {
        var blockInformation = getBlockInformationFromFormat(
          this.gpuTextureformat,
        );
        var bytesPerRow_1 =
          Math.ceil(this.width / blockInformation.width) *
          blockInformation.length;
        datas.forEach(function (data) {
          device.queue.writeTexture(
            { texture: _this.gpuTexture },
            data,
            {
              bytesPerRow: bytesPerRow_1,
            },
            {
              width: _this.width,
              height: _this.height,
            },
          );
        });
      }
      this.width = width;
      this.height = height;
      if (texture) {
        this.gpuTexture = texture;
      }
      this.gpuTextureView = this.gpuTexture.createView({
        dimension: translateTextureViewDimension(this.dimension),
      });
    };
    Texture_WebGPU2.prototype.destroy = function () {
      _super.prototype.destroy.call(this);
      this.gpuTexture.destroy();
    };
    return Texture_WebGPU2;
  })(ResourceBase_WebGPU);
var RenderBundle_WebGPU =
  /** @class */
  (function (_super) {
    __extends(RenderBundle_WebGPU2, _super);
    function RenderBundle_WebGPU2(_a2) {
      var id = _a2.id,
        device = _a2.device;
      var _this = _super.call(this, { id, device }) || this;
      _this.type = ResourceType.RenderBundle;
      _this.renderBundleEncoder = _this.device.device.createRenderBundleEncoder(
        {
          colorFormats: [_this.device['swapChainFormat']],
        },
      );
      return _this;
    }
    RenderBundle_WebGPU2.prototype.finish = function () {
      this.renderBundle = this.renderBundleEncoder.finish();
    };
    return RenderBundle_WebGPU2;
  })(ResourceBase_WebGPU);
var Device_WebGPU =
  /** @class */
  (function () {
    function Device_WebGPU2(
      adapter,
      device,
      canvas,
      canvasContext,
      glsl_compile2,
      wGSLComposer,
    ) {
      this.swapChainWidth = 0;
      this.swapChainHeight = 0;
      this.swapChainTextureUsage =
        GPUTextureUsage$1.RENDER_ATTACHMENT | GPUTextureUsage$1.COPY_DST;
      this._resourceUniqueId = 0;
      this.renderPassPool = [];
      this.computePassPool = [];
      this.frameCommandEncoderPool = [];
      this.featureTextureCompressionBC = false;
      this.platformString = 'WebGPU';
      this.glslVersion = '#version 440';
      this.explicitBindingLocations = true;
      this.separateSamplerTextures = true;
      this.viewportOrigin = ViewportOrigin.UPPER_LEFT;
      this.clipSpaceNearZ = ClipSpaceNearZ.ZERO;
      this.supportsSyncPipelineCompilation = false;
      this.supportMRT = true;
      this.device = device;
      this.canvas = canvas;
      this.canvasContext = canvasContext;
      this.glsl_compile = glsl_compile2;
      this.WGSLComposer = wGSLComposer;
      this.fallbackTexture2D = this.createFallbackTexture(
        TextureDimension.TEXTURE_2D,
        SamplerFormatKind.Float,
      );
      this.setResourceName(this.fallbackTexture2D, 'Fallback Texture2D');
      this.fallbackTexture2DDepth = this.createFallbackTexture(
        TextureDimension.TEXTURE_2D,
        SamplerFormatKind.Depth,
      );
      this.setResourceName(
        this.fallbackTexture2DDepth,
        'Fallback Depth Texture2D',
      );
      this.fallbackTexture2DArray = this.createFallbackTexture(
        TextureDimension.TEXTURE_2D_ARRAY,
        SamplerFormatKind.Float,
      );
      this.setResourceName(
        this.fallbackTexture2DArray,
        'Fallback Texture2DArray',
      );
      this.fallbackTexture3D = this.createFallbackTexture(
        TextureDimension.TEXTURE_3D,
        SamplerFormatKind.Float,
      );
      this.setResourceName(this.fallbackTexture3D, 'Fallback Texture3D');
      this.fallbackTextureCube = this.createFallbackTexture(
        TextureDimension.TEXTURE_CUBE_MAP,
        SamplerFormatKind.Float,
      );
      this.setResourceName(this.fallbackTextureCube, 'Fallback TextureCube');
      this.fallbackSamplerFiltering = this.createSampler({
        addressModeU: AddressMode.REPEAT,
        addressModeV: AddressMode.REPEAT,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.POINT,
        mipmapFilter: MipmapFilterMode.NEAREST,
      });
      this.setResourceName(
        this.fallbackSamplerFiltering,
        'Fallback Sampler Filtering',
      );
      this.fallbackSamplerComparison = this.createSampler({
        addressModeU: AddressMode.REPEAT,
        addressModeV: AddressMode.REPEAT,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.POINT,
        mipmapFilter: MipmapFilterMode.NEAREST,
        compareFunction: CompareFunction.ALWAYS,
      });
      this.setResourceName(
        this.fallbackSamplerComparison,
        'Fallback Sampler Comparison Filtering',
      );
      if (this.device.features) {
        this.featureTextureCompressionBC = this.device.features.has(
          'texture-compression-bc',
        );
      }
      this.device.onuncapturederror = function (event) {
        console.error(event.error);
      };
      this.swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
      this.canvasContext.configure({
        device: this.device,
        format: this.swapChainFormat,
        usage: this.swapChainTextureUsage,
        // @see https://www.w3.org/TR/webgpu/#gpucanvasalphamode
        // alphaMode: 'opaque',
        alphaMode: 'premultiplied',
      });
    }
    Device_WebGPU2.prototype.destroy = function () {};
    Device_WebGPU2.prototype.configureSwapChain = function (width, height) {
      if (this.swapChainWidth === width && this.swapChainHeight === height)
        return;
      this.swapChainWidth = width;
      this.swapChainHeight = height;
    };
    Device_WebGPU2.prototype.getOnscreenTexture = function () {
      var gpuTexture = this.canvasContext.getCurrentTexture();
      var gpuTextureView = gpuTexture.createView();
      var texture = new Texture_WebGPU({
        id: 0,
        device: this,
        descriptor: {
          format: Format.U8_RGBA_RT,
          width: this.swapChainWidth,
          height: this.swapChainHeight,
          depthOrArrayLayers: 0,
          dimension: TextureDimension.TEXTURE_2D,
          mipLevelCount: 1,
          usage: this.swapChainTextureUsage,
        },
        skipCreate: true,
      });
      texture.depthOrArrayLayers = 1;
      texture.sampleCount = 1;
      texture.gpuTexture = gpuTexture;
      texture.gpuTextureView = gpuTextureView;
      texture.name = 'Onscreen';
      this.setResourceName(texture, 'Onscreen Texture');
      return texture;
    };
    Device_WebGPU2.prototype.getDevice = function () {
      return this;
    };
    Device_WebGPU2.prototype.getCanvas = function () {
      return this.canvas;
    };
    Device_WebGPU2.prototype.beginFrame = function () {
      assert(this.frameCommandEncoderPool.length === 0);
    };
    Device_WebGPU2.prototype.endFrame = function () {
      assert(
        this.frameCommandEncoderPool.every(function (frameCommandEncoder) {
          return frameCommandEncoder !== null;
        }),
      );
      this.device.queue.submit(
        this.frameCommandEncoderPool.map(function (frameCommandEncoder) {
          return frameCommandEncoder.finish();
        }),
      );
      this.frameCommandEncoderPool = [];
    };
    Device_WebGPU2.prototype.getNextUniqueId = function () {
      return ++this._resourceUniqueId;
    };
    Device_WebGPU2.prototype.createBuffer = function (descriptor) {
      return new Buffer_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createTexture = function (descriptor) {
      return new Texture_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createSampler = function (descriptor) {
      return new Sampler_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createRenderTarget = function (descriptor) {
      var texture = new Texture_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor: __assign(__assign({}, descriptor), {
          dimension: TextureDimension.TEXTURE_2D,
          mipLevelCount: 1,
          depthOrArrayLayers: 1,
          usage: TextureUsage.RENDER_TARGET,
        }),
        sampleCount: descriptor.sampleCount,
      });
      texture.depthOrArrayLayers = 1;
      texture.type = ResourceType.RenderTarget;
      return texture;
    };
    Device_WebGPU2.prototype.createRenderTargetFromTexture = function (
      texture,
    ) {
      var _a2 = texture,
        format = _a2.format,
        width = _a2.width,
        height = _a2.height,
        depthOrArrayLayers = _a2.depthOrArrayLayers,
        sampleCount = _a2.sampleCount,
        mipLevelCount = _a2.mipLevelCount,
        gpuTexture = _a2.gpuTexture,
        gpuTextureView = _a2.gpuTextureView,
        usage = _a2.usage;
      assert(!!(usage & GPUTextureUsage$1.RENDER_ATTACHMENT));
      var attachment = new Texture_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor: {
          format,
          width,
          height,
          depthOrArrayLayers,
          dimension: TextureDimension.TEXTURE_2D,
          mipLevelCount,
          usage,
        },
        skipCreate: true,
      });
      attachment.depthOrArrayLayers = depthOrArrayLayers;
      attachment.sampleCount = sampleCount;
      attachment.gpuTexture = gpuTexture;
      attachment.gpuTextureView = gpuTextureView;
      return attachment;
    };
    Device_WebGPU2.prototype.createProgram = function (descriptor) {
      var _a2, _b;
      if (
        (_a2 = descriptor.vertex) === null || _a2 === void 0 ? void 0 : _a2.glsl
      ) {
        descriptor.vertex.glsl = preprocessShader_GLSL(
          this.queryVendorInfo(),
          'vert',
          descriptor.vertex.glsl,
        );
      }
      if (
        (_b = descriptor.fragment) === null || _b === void 0 ? void 0 : _b.glsl
      ) {
        descriptor.fragment.glsl = preprocessShader_GLSL(
          this.queryVendorInfo(),
          'frag',
          descriptor.fragment.glsl,
        );
      }
      return new Program_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createProgramSimple = function (descriptor) {
      return new Program_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createTextureShared = function (
      descriptor,
      texture,
      skipCreate,
    ) {
      var size2 = {
        width: descriptor.width,
        height: descriptor.height,
        depthOrArrayLayers: descriptor.depthOrArrayLayers,
      };
      var mipLevelCount = descriptor.mipLevelCount;
      var format = translateTextureFormat(descriptor.format);
      var dimension = translateTextureDimension(descriptor.dimension);
      var usage = translateTextureUsage(descriptor.usage);
      texture.gpuTextureformat = format;
      texture.dimension = descriptor.dimension;
      texture.format = descriptor.format;
      texture.width = descriptor.width;
      texture.height = descriptor.height;
      texture.depthOrArrayLayers = descriptor.depthOrArrayLayers;
      texture.mipLevelCount = mipLevelCount;
      texture.usage = usage;
      texture.sampleCount = descriptor.sampleCount;
      if (!skipCreate) {
        var gpuTexture = this.device.createTexture({
          size: size2,
          mipLevelCount,
          format,
          dimension,
          sampleCount: descriptor.sampleCount,
          usage,
        });
        var gpuTextureView = gpuTexture.createView();
        texture.gpuTexture = gpuTexture;
        texture.gpuTextureView = gpuTextureView;
      }
    };
    Device_WebGPU2.prototype.getFallbackSampler = function (samplerEntry) {
      var formatKind = samplerEntry.formatKind;
      if (formatKind === SamplerFormatKind.Depth && samplerEntry.comparison) {
        return this.fallbackSamplerComparison;
      } else {
        return this.fallbackSamplerFiltering;
      }
    };
    Device_WebGPU2.prototype.getFallbackTexture = function (samplerEntry) {
      var dimension = samplerEntry.dimension,
        formatKind = samplerEntry.formatKind;
      if (dimension === TextureDimension.TEXTURE_2D)
        return formatKind === SamplerFormatKind.Depth
          ? this.fallbackTexture2DDepth
          : this.fallbackTexture2D;
      else if (dimension === TextureDimension.TEXTURE_2D_ARRAY)
        return this.fallbackTexture2DArray;
      else if (dimension === TextureDimension.TEXTURE_3D)
        return this.fallbackTexture3D;
      else if (dimension === TextureDimension.TEXTURE_CUBE_MAP)
        return this.fallbackTextureCube;
      else throw new Error('whoops');
    };
    Device_WebGPU2.prototype.createFallbackTexture = function (
      dimension,
      formatKind,
    ) {
      var depthOrArrayLayers =
        dimension === TextureDimension.TEXTURE_CUBE_MAP ? 6 : 1;
      var format =
        formatKind === SamplerFormatKind.Float
          ? Format.U8_RGBA_NORM
          : Format.D24;
      return this.createTexture({
        dimension,
        format,
        usage: TextureUsage.SAMPLED,
        width: 1,
        height: 1,
        depthOrArrayLayers,
        mipLevelCount: 1,
      });
    };
    Device_WebGPU2.prototype.createBindings = function (descriptor) {
      return new Bindings_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createInputLayout = function (descriptor) {
      return new InputLayout_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createComputePipeline = function (descriptor) {
      return new ComputePipeline_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor,
      });
    };
    Device_WebGPU2.prototype.createRenderPipeline = function (descriptor) {
      return new RenderPipeline_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor: __assign({}, descriptor),
      });
    };
    Device_WebGPU2.prototype.createQueryPool = function (type, elemCount) {
      return new QueryPool_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
        descriptor: {
          type,
          elemCount,
        },
      });
    };
    Device_WebGPU2.prototype.createRenderPipelineInternal = function (
      renderPipeline,
      async,
    ) {
      var _a2;
      if (renderPipeline.gpuRenderPipeline !== null) {
        return;
      }
      var descriptor = renderPipeline.descriptor;
      var program = descriptor.program;
      var vertexStage = program.vertexStage,
        fragmentStage = program.fragmentStage;
      if (vertexStage === null || fragmentStage === null) return;
      var _b = descriptor.megaStateDescriptor || {},
        stencilBack = _b.stencilBack,
        stencilFront = _b.stencilFront,
        rest = __rest(_b, ['stencilBack', 'stencilFront']);
      var copied = copyMegaState(defaultMegaState);
      descriptor.megaStateDescriptor = __assign(
        __assign(__assign({}, copied), {
          stencilBack: __assign(__assign({}, copied.stencilBack), stencilBack),
          stencilFront: __assign(
            __assign({}, copied.stencilFront),
            stencilFront,
          ),
        }),
        rest,
      );
      var defaultAttachmentState =
        descriptor.megaStateDescriptor.attachmentsState[0];
      descriptor.colorAttachmentFormats.forEach(function (format, i) {
        if (!descriptor.megaStateDescriptor.attachmentsState[i]) {
          descriptor.megaStateDescriptor.attachmentsState[i] =
            copyAttachmentState(void 0, defaultAttachmentState);
        }
      });
      var primitive = translatePrimitiveState(
        (_a2 = descriptor.topology) !== null && _a2 !== void 0
          ? _a2
          : PrimitiveTopology.TRIANGLES,
        descriptor.megaStateDescriptor,
      );
      var targets = translateTargets(
        descriptor.colorAttachmentFormats,
        descriptor.megaStateDescriptor,
      );
      var depthStencil = translateDepthStencilState(
        descriptor.depthStencilAttachmentFormat,
        descriptor.megaStateDescriptor,
      );
      var buffers = void 0;
      if (descriptor.inputLayout !== null)
        buffers = descriptor.inputLayout.buffers;
      var sampleCount = descriptor.sampleCount;
      var gpuRenderPipelineDescriptor = {
        // layout,
        layout: 'auto',
        vertex: __assign(__assign({}, vertexStage), { buffers }),
        primitive,
        depthStencil,
        multisample: {
          count: sampleCount,
        },
        fragment: __assign(__assign({}, fragmentStage), { targets }),
      };
      renderPipeline.gpuRenderPipeline = this.device.createRenderPipeline(
        gpuRenderPipelineDescriptor,
      );
    };
    Device_WebGPU2.prototype.createReadback = function () {
      return new Readback_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
      });
    };
    Device_WebGPU2.prototype.createRenderBundle = function () {
      return new RenderBundle_WebGPU({
        id: this.getNextUniqueId(),
        device: this,
      });
    };
    Device_WebGPU2.prototype.createRenderPass = function (
      renderPassDescriptor,
    ) {
      var pass = this.renderPassPool.pop();
      if (pass === void 0) {
        pass = new RenderPass_WebGPU(this);
      }
      var frameCommandEncoder = this.frameCommandEncoderPool.pop();
      if (frameCommandEncoder === void 0) {
        frameCommandEncoder = this.device.createCommandEncoder();
      }
      pass.beginRenderPass(frameCommandEncoder, renderPassDescriptor);
      return pass;
    };
    Device_WebGPU2.prototype.createComputePass = function () {
      var pass = this.computePassPool.pop();
      if (pass === void 0) pass = new ComputePass_WebGPU();
      var frameCommandEncoder = this.frameCommandEncoderPool.pop();
      if (frameCommandEncoder === void 0) {
        frameCommandEncoder = this.device.createCommandEncoder();
      }
      pass.beginComputePass(frameCommandEncoder);
      return pass;
    };
    Device_WebGPU2.prototype.submitPass = function (_pass) {
      var pass = _pass;
      if (pass instanceof RenderPass_WebGPU) {
        this.frameCommandEncoderPool.push(pass.frameCommandEncoder);
        pass.finish();
        this.renderPassPool.push(pass);
      } else if (pass instanceof ComputePass_WebGPU) {
        this.frameCommandEncoderPool.push(pass.frameCommandEncoder);
        pass.finish();
        this.computePassPool.push(pass);
      }
    };
    Device_WebGPU2.prototype.copySubTexture2D = function (
      dst_,
      dstX,
      dstY,
      src_,
      srcX,
      srcY,
      depthOrArrayLayers,
    ) {
      var cmd = this.device.createCommandEncoder();
      var dst = dst_;
      var src = src_;
      var srcCopy = {
        texture: src.gpuTexture,
        origin: [srcX, srcY, 0],
        mipLevel: 0,
        aspect: 'all',
      };
      var dstCopy = {
        texture: dst.gpuTexture,
        origin: [dstX, dstY, 0],
        mipLevel: 0,
        aspect: 'all',
      };
      assert(!!(src.usage & GPUTextureUsage$1.COPY_SRC));
      assert(!!(dst.usage & GPUTextureUsage$1.COPY_DST));
      cmd.copyTextureToTexture(srcCopy, dstCopy, [
        src.width,
        src.height,
        depthOrArrayLayers || 1,
      ]);
      this.device.queue.submit([cmd.finish()]);
    };
    Device_WebGPU2.prototype.queryLimits = function () {
      return {
        uniformBufferMaxPageWordSize:
          this.device.limits.maxUniformBufferBindingSize >>> 2,
        uniformBufferWordAlignment:
          this.device.limits.minUniformBufferOffsetAlignment >>> 2,
        supportedSampleCounts: [1],
        occlusionQueriesRecommended: true,
        computeShadersSupported: true,
      };
    };
    Device_WebGPU2.prototype.queryTextureFormatSupported = function (
      format,
      width,
      height,
    ) {
      if (isFormatTextureCompressionBC(format)) {
        if (!this.featureTextureCompressionBC) return false;
        var bb = getFormatBlockSize(format);
        if (width % bb !== 0 || height % bb !== 0) return false;
        return this.featureTextureCompressionBC;
      }
      switch (format) {
        case Format.U16_RGBA_NORM:
          return false;
        case Format.F32_RGBA:
          return false;
      }
      return true;
    };
    Device_WebGPU2.prototype.queryPlatformAvailable = function () {
      return true;
    };
    Device_WebGPU2.prototype.queryVendorInfo = function () {
      return this;
    };
    Device_WebGPU2.prototype.queryRenderPass = function (o) {
      var pass = o;
      return pass.descriptor;
    };
    Device_WebGPU2.prototype.queryRenderTarget = function (o) {
      var attachment = o;
      return attachment;
    };
    Device_WebGPU2.prototype.setResourceName = function (o, s) {
      o.name = s;
      if (o.type === ResourceType.Buffer) {
        var r = o;
        r.gpuBuffer.label = s;
      } else if (o.type === ResourceType.Texture) {
        var r = o;
        r.gpuTexture.label = s;
        r.gpuTextureView.label = s;
      } else if (o.type === ResourceType.RenderTarget) {
        var r = o;
        r.gpuTexture.label = s;
        r.gpuTextureView.label = s;
      } else if (o.type === ResourceType.Sampler) {
        var r = o;
        r.gpuSampler.label = s;
      } else if (o.type === ResourceType.RenderPipeline) {
        var r = o;
        if (r.gpuRenderPipeline !== null) r.gpuRenderPipeline.label = s;
      }
    };
    Device_WebGPU2.prototype.setResourceLeakCheck = function (o, v) {};
    Device_WebGPU2.prototype.checkForLeaks = function () {};
    Device_WebGPU2.prototype.programPatched = function (o) {};
    Device_WebGPU2.prototype.pipelineQueryReady = function (o) {
      var renderPipeline = o;
      return renderPipeline.gpuRenderPipeline !== null;
    };
    Device_WebGPU2.prototype.pipelineForceReady = function (o) {
      var renderPipeline = o;
      this.createRenderPipelineInternal(renderPipeline, false);
    };
    return Device_WebGPU2;
  })();
var WebGPUDeviceContribution =
  /** @class */
  (function () {
    function WebGPUDeviceContribution2(pluginOptions) {
      this.pluginOptions = pluginOptions;
    }
    WebGPUDeviceContribution2.prototype.createSwapChain = function ($canvas) {
      return __awaiter(this, void 0, void 0, function () {
        var adapter,
          xrCompatible,
          e_1,
          optionalFeatures,
          requiredFeatures,
          device,
          onContextLost_1,
          context;
        return __generator(this, function (_a2) {
          switch (_a2.label) {
            case 0:
              if (globalThis.navigator.gpu === void 0) return [2, null];
              adapter = null;
              _a2.label = 1;
            case 1:
              _a2.trys.push([1, 3, , 4]);
              xrCompatible = this.pluginOptions.xrCompatible;
              return [
                4,
                globalThis.navigator.gpu.requestAdapter({
                  xrCompatible,
                }),
              ];
            case 2:
              adapter = _a2.sent();
              return [3, 4];
            case 3:
              e_1 = _a2.sent();
              console.log(e_1);
              return [3, 4];
            case 4:
              if (adapter === null) return [2, null];
              optionalFeatures = [
                // 'depth24unorm-stencil8',
                'depth32float-stencil8',
                'texture-compression-bc',
                'float32-filterable',
              ];
              requiredFeatures = optionalFeatures.filter(function (feature) {
                return adapter.features.has(feature);
              });
              return [4, adapter.requestDevice({ requiredFeatures })];
            case 5:
              device = _a2.sent();
              if (device) {
                onContextLost_1 = this.pluginOptions.onContextLost;
                device.lost.then(function () {
                  if (onContextLost_1) {
                    onContextLost_1();
                  }
                });
              }
              if (device === null) return [2, null];
              context = $canvas.getContext('webgpu');
              if (!context) return [2, null];
              _a2.label = 6;
            case 6:
              _a2.trys.push([6, 8, , 9]);
              return [4, __wbg_init(this.pluginOptions.shaderCompilerPath)];
            case 7:
              _a2.sent();
              return [3, 9];
            case 8:
              _a2.sent();
              return [3, 9];
            case 9:
              return [
                2,
                new Device_WebGPU(
                  adapter,
                  device,
                  $canvas,
                  context,
                  glsl_compile,
                  WGSLComposer && new WGSLComposer(),
                ),
              ];
          }
        });
      });
    };
    return WebGPUDeviceContribution2;
  })();
export {
  AddressMode,
  BlendFactor,
  BlendMode,
  BufferFrequencyHint,
  BufferUsage,
  ChannelWriteMask,
  ClipSpaceNearZ,
  CompareFunction,
  CullMode,
  FilterMode,
  Format,
  FormatCompFlags,
  FormatFlags,
  FormatTypeFlags,
  FrontFace,
  GL,
  IsDepthReversed,
  MipmapFilterMode,
  OpaqueBlack,
  OpaqueWhite,
  PrimitiveTopology,
  QueryPoolType,
  ResourceType,
  SamplerFormatKind,
  StencilOp,
  TextureDimension,
  TextureEvent,
  TextureUsage,
  TransparentBlack,
  TransparentWhite,
  UNIFORM_SETTERS,
  VertexStepMode,
  ViewportOrigin,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
  align,
  alignNonPowerOfTwo,
  arrayCopy,
  arrayEqual,
  assert,
  assertExists,
  bindingsDescriptorCopy,
  bindingsDescriptorEquals,
  bisectRight,
  bufferBindingCopy,
  colorCopy,
  colorEqual,
  colorNewCopy,
  colorNewFromRGBA,
  compareDepthValues,
  copyAttachmentState,
  copyAttachmentStateFromSimple,
  copyMegaState,
  copyStencilFaceState,
  defaultBindingLayoutSamplerDescriptor,
  defaultMegaState,
  fallbackUndefined,
  fillArray,
  fullscreenMegaState,
  getAttributeLocations,
  getDefines,
  getFormatByteSize,
  getFormatCompByteSize,
  getFormatCompFlags,
  getFormatCompFlagsComponentCount,
  getFormatComponentCount,
  getFormatFlags,
  getFormatSamplerKind,
  getFormatTypeFlags,
  getFormatTypeFlagsByteSize,
  getUniformSetter,
  getUniforms,
  inputLayoutBufferDescriptorCopy,
  inputLayoutBufferDescriptorEquals,
  inputLayoutDescriptorCopy,
  inputLayoutDescriptorEquals,
  isPowerOfTwo,
  isTypedArray,
  leftPad,
  makeFormat,
  makeMegaState,
  makeTextureDescriptor2D,
  nArray,
  nullify,
  parseUniformName,
  prependLineNo,
  preprocessProgram_GLSL,
  preprocessShader_GLSL,
  range,
  renderPipelineDescriptorCopy,
  renderPipelineDescriptorEquals,
  reverseDepthForClearValue,
  reverseDepthForCompareFunction,
  reverseDepthForDepthOffset,
  reverseDepthForOrthographicu_ProjectionMatrix,
  reverseDepthForPerspectiveu_ProjectionMatrix,
  samplerBindingCopy,
  samplerDescriptorEquals,
  setAttachmentStateSimple,
  setBitFlagEnabled,
  setFormatComponentCount,
  setFormatFlags,
  setMegaStateFlags,
  spliceBisectRight,
  stencilFaceStateEquals,
  textureBindingCopy,
  vertexAttributeDescriptorCopy,
  vertexAttributeDescriptorEquals,
};
//# sourceMappingURL=@antv_g-device-api.js.map
