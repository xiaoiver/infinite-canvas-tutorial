// vendor/lottie-expression-src/utils/helpers/arrays.js
var createTypedArray = function() {
  function createRegularArray(type, len) {
    var i = 0;
    var arr = [];
    var value2;
    switch (type) {
      case "int16":
      case "uint8c":
        value2 = 1;
        break;
      default:
        value2 = 1.1;
        break;
    }
    for (i = 0; i < len; i += 1) {
      arr.push(value2);
    }
    return arr;
  }
  function createTypedArrayFactory(type, len) {
    if (type === "float32") {
      return new Float32Array(len);
    }
    if (type === "int16") {
      return new Int16Array(len);
    }
    if (type === "uint8c") {
      return new Uint8ClampedArray(len);
    }
    return createRegularArray(type, len);
  }
  if (typeof Uint8ClampedArray === "function" && typeof Float32Array === "function") {
    return createTypedArrayFactory;
  }
  return createRegularArray;
}();
function createSizedArray(len) {
  return Array.apply(null, { length: len });
}

// vendor/lottie-expression-src/utils/lottie-web-common-shim.js
var BMMath = {};
(function() {
  const propertyNames = [
    "abs",
    "acos",
    "acosh",
    "asin",
    "asinh",
    "atan",
    "atanh",
    "atan2",
    "ceil",
    "cbrt",
    "expm1",
    "clz32",
    "cos",
    "cosh",
    "exp",
    "floor",
    "fround",
    "hypot",
    "imul",
    "log",
    "log1p",
    "log2",
    "log10",
    "max",
    "min",
    "pow",
    "random",
    "round",
    "sign",
    "sin",
    "sinh",
    "sqrt",
    "tan",
    "tanh",
    "trunc",
    "E",
    "LN10",
    "LN2",
    "LOG10E",
    "LOG2E",
    "PI",
    "SQRT1_2",
    "SQRT2"
  ];
  let i;
  const len = propertyNames.length;
  for (i = 0; i < len; i += 1) {
    BMMath[propertyNames[i]] = Math[propertyNames[i]];
  }
})();
BMMath.random = Math.random;
BMMath.abs = function(val2) {
  const tOfVal = typeof val2;
  if (tOfVal === "object" && val2.length) {
    const absArr = createSizedArray(val2.length);
    let j;
    const len = val2.length;
    for (j = 0; j < len; j += 1) {
      absArr[j] = Math.abs(val2[j]);
    }
    return absArr;
  }
  return Math.abs(val2);
};
var degToRads = Math.PI / 180;

// vendor/lottie-expression-src/3rd_party/BezierEaser.js
var BezierFactory = function() {
  var ob2 = {};
  ob2.getBezierEasing = getBezierEasing;
  var beziers = {};
  function getBezierEasing(a, b, c, d, nm) {
    var str = nm || ("bez_" + a + "_" + b + "_" + c + "_" + d).replace(/\./g, "p");
    if (beziers[str]) {
      return beziers[str];
    }
    var bezEasing = new BezierEasing([a, b, c, d]);
    beziers[str] = bezEasing;
    return bezEasing;
  }
  var NEWTON_ITERATIONS = 4;
  var NEWTON_MIN_SLOPE = 1e-3;
  var SUBDIVISION_PRECISION = 1e-7;
  var SUBDIVISION_MAX_ITERATIONS = 10;
  var kSplineTableSize = 11;
  var kSampleStepSize = 1 / (kSplineTableSize - 1);
  var float32ArraySupported = typeof Float32Array === "function";
  function A(aA1, aA2) {
    return 1 - 3 * aA2 + 3 * aA1;
  }
  function B(aA1, aA2) {
    return 3 * aA2 - 6 * aA1;
  }
  function C(aA1) {
    return 3 * aA1;
  }
  function calcBezier(aT, aA1, aA2) {
    return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
  }
  function getSlope(aT, aA1, aA2) {
    return 3 * A(aA1, aA2) * aT * aT + 2 * B(aA1, aA2) * aT + C(aA1);
  }
  function binarySubdivide(aX, aA, aB, mX1, mX2) {
    var currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0) {
        aB = currentT;
      } else {
        aA = currentT;
      }
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  }
  function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
    for (var i = 0; i < NEWTON_ITERATIONS; ++i) {
      var currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0)
        return aGuessT;
      var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  }
  function BezierEasing(points) {
    this._p = points;
    this._mSampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
    this._precomputed = false;
    this.get = this.get.bind(this);
  }
  BezierEasing.prototype = {
    get: function(x) {
      var mX1 = this._p[0], mY1 = this._p[1], mX2 = this._p[2], mY2 = this._p[3];
      if (!this._precomputed)
        this._precompute();
      if (mX1 === mY1 && mX2 === mY2)
        return x;
      if (x === 0)
        return 0;
      if (x === 1)
        return 1;
      return calcBezier(this._getTForX(x), mY1, mY2);
    },
    // Private part
    _precompute: function() {
      var mX1 = this._p[0], mY1 = this._p[1], mX2 = this._p[2], mY2 = this._p[3];
      this._precomputed = true;
      if (mX1 !== mY1 || mX2 !== mY2) {
        this._calcSampleValues();
      }
    },
    _calcSampleValues: function() {
      var mX1 = this._p[0], mX2 = this._p[2];
      for (var i = 0; i < kSplineTableSize; ++i) {
        this._mSampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
      }
    },
    /**
         * getTForX chose the fastest heuristic to determine the percentage value precisely from a given X projection.
         */
    _getTForX: function(aX) {
      var mX1 = this._p[0], mX2 = this._p[2], mSampleValues = this._mSampleValues;
      var intervalStart = 0;
      var currentSample = 1;
      var lastSample = kSplineTableSize - 1;
      for (; currentSample !== lastSample && mSampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }
      --currentSample;
      var dist = (aX - mSampleValues[currentSample]) / (mSampleValues[currentSample + 1] - mSampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStepSize;
      var initialSlope = getSlope(guessForT, mX1, mX2);
      if (initialSlope >= NEWTON_MIN_SLOPE) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      }
      if (initialSlope === 0) {
        return guessForT;
      }
      return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
    }
  };
  return ob2;
}();
var BezierEaser_default = BezierFactory;

// vendor/lottie-expression-src/utils/pooling/pooling.js
var pooling = /* @__PURE__ */ function() {
  function double(arr) {
    return arr.concat(createSizedArray(arr.length));
  }
  return {
    double
  };
}();
var pooling_default = pooling;

// vendor/lottie-expression-src/utils/pooling/pool_factory.js
var poolFactory = /* @__PURE__ */ function() {
  return function(initialLength, _create, _release) {
    var _length = 0;
    var _maxLength = initialLength;
    var pool = createSizedArray(_maxLength);
    var ob2 = {
      newElement,
      release
    };
    function newElement() {
      var element;
      if (_length) {
        _length -= 1;
        element = pool[_length];
      } else {
        element = _create();
      }
      return element;
    }
    function release(element) {
      if (_length === _maxLength) {
        pool = pooling_default.double(pool);
        _maxLength *= 2;
      }
      if (_release) {
        _release(element);
      }
      pool[_length] = element;
      _length += 1;
    }
    return ob2;
  };
}();
var pool_factory_default = poolFactory;

// vendor/lottie-expression-src/utils/pooling/point_pool.js
var pointPool = function() {
  function create() {
    return createTypedArray("float32", 2);
  }
  return pool_factory_default(8, create);
}();
var point_pool_default = pointPool;

// vendor/lottie-expression-src/utils/shapes/ShapePath.js
function ShapePath() {
  this.c = false;
  this._length = 0;
  this._maxLength = 8;
  this.v = createSizedArray(this._maxLength);
  this.o = createSizedArray(this._maxLength);
  this.i = createSizedArray(this._maxLength);
}
ShapePath.prototype.setPathData = function(closed, len) {
  this.c = closed;
  this.setLength(len);
  var i = 0;
  while (i < len) {
    this.v[i] = point_pool_default.newElement();
    this.o[i] = point_pool_default.newElement();
    this.i[i] = point_pool_default.newElement();
    i += 1;
  }
};
ShapePath.prototype.setLength = function(len) {
  while (this._maxLength < len) {
    this.doubleArrayLength();
  }
  this._length = len;
};
ShapePath.prototype.doubleArrayLength = function() {
  this.v = this.v.concat(createSizedArray(this._maxLength));
  this.i = this.i.concat(createSizedArray(this._maxLength));
  this.o = this.o.concat(createSizedArray(this._maxLength));
  this._maxLength *= 2;
};
ShapePath.prototype.setXYAt = function(x, y, type, pos, replace) {
  var arr;
  this._length = Math.max(this._length, pos + 1);
  if (this._length >= this._maxLength) {
    this.doubleArrayLength();
  }
  switch (type) {
    case "v":
      arr = this.v;
      break;
    case "i":
      arr = this.i;
      break;
    case "o":
      arr = this.o;
      break;
    default:
      arr = [];
      break;
  }
  if (!arr[pos] || arr[pos] && !replace) {
    arr[pos] = point_pool_default.newElement();
  }
  arr[pos][0] = x;
  arr[pos][1] = y;
};
ShapePath.prototype.setTripleAt = function(vX, vY, oX, oY, iX, iY, pos, replace) {
  this.setXYAt(vX, vY, "v", pos, replace);
  this.setXYAt(oX, oY, "o", pos, replace);
  this.setXYAt(iX, iY, "i", pos, replace);
};
ShapePath.prototype.reverse = function() {
  var newPath = new ShapePath();
  newPath.setPathData(this.c, this._length);
  var vertices = this.v;
  var outPoints = this.o;
  var inPoints = this.i;
  var init = 0;
  if (this.c) {
    newPath.setTripleAt(vertices[0][0], vertices[0][1], inPoints[0][0], inPoints[0][1], outPoints[0][0], outPoints[0][1], 0, false);
    init = 1;
  }
  var cnt = this._length - 1;
  var len = this._length;
  var i;
  for (i = init; i < len; i += 1) {
    newPath.setTripleAt(vertices[cnt][0], vertices[cnt][1], inPoints[cnt][0], inPoints[cnt][1], outPoints[cnt][0], outPoints[cnt][1], i, false);
    cnt -= 1;
  }
  return newPath;
};
ShapePath.prototype.length = function() {
  return this._length;
};
var ShapePath_default = ShapePath;

// vendor/lottie-expression-src/utils/pooling/shape_pool.js
var shapePool = function() {
  function create() {
    return new ShapePath_default();
  }
  function release(shapePath) {
    var len = shapePath._length;
    var i;
    for (i = 0; i < len; i += 1) {
      point_pool_default.release(shapePath.v[i]);
      point_pool_default.release(shapePath.i[i]);
      point_pool_default.release(shapePath.o[i]);
      shapePath.v[i] = null;
      shapePath.i[i] = null;
      shapePath.o[i] = null;
    }
    shapePath._length = 0;
    shapePath.c = false;
  }
  function clone(shape) {
    var cloned = factory.newElement();
    var i;
    var len = shape._length === void 0 ? shape.v.length : shape._length;
    cloned.setLength(len);
    cloned.c = shape.c;
    for (i = 0; i < len; i += 1) {
      cloned.setTripleAt(shape.v[i][0], shape.v[i][1], shape.o[i][0], shape.o[i][1], shape.i[i][0], shape.i[i][1], i);
    }
    return cloned;
  }
  var factory = pool_factory_default(4, create, release);
  factory.clone = clone;
  return factory;
}();
var shape_pool_default = shapePool;

// vendor/lottie-expression-src/3rd_party/seedrandom.js
function seedRandom2(pool, math) {
  var global = this, width2 = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width2, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask2 = width2 - 1, nodecrypto;
  function seedrandom(seed, options, callback) {
    var key2 = [];
    options = options === true ? { entropy: true } : options || {};
    var shortseed = mixkey(flatten(
      options.entropy ? [seed, tostring(pool)] : seed === null ? autoseed() : seed,
      3
    ), key2);
    var arc4 = new ARC4(key2);
    var prng = function() {
      var n = arc4.g(chunks), d = startdenom, x = 0;
      while (n < significance) {
        n = (n + x) * width2;
        d *= width2;
        x = arc4.g(1);
      }
      while (n >= overflow) {
        n /= 2;
        d /= 2;
        x >>>= 1;
      }
      return (n + x) / d;
    };
    prng.int32 = function() {
      return arc4.g(4) | 0;
    };
    prng.quick = function() {
      return arc4.g(4) / 4294967296;
    };
    prng.double = prng;
    mixkey(tostring(arc4.S), pool);
    return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
      if (state) {
        if (state.S) {
          copy(state, arc4);
        }
        prng2.state = function() {
          return copy(arc4, {});
        };
      }
      if (is_math_call) {
        math[rngname] = prng2;
        return seed2;
      } else
        return prng2;
    })(
      prng,
      shortseed,
      "global" in options ? options.global : this == math,
      options.state
    );
  }
  math["seed" + rngname] = seedrandom;
  function ARC4(key2) {
    var t, keylen = key2.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
    if (!keylen) {
      key2 = [keylen++];
    }
    while (i < width2) {
      s[i] = i++;
    }
    for (i = 0; i < width2; i++) {
      s[i] = s[j = mask2 & j + key2[i % keylen] + (t = s[i])];
      s[j] = t;
    }
    me.g = function(count) {
      var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
      while (count--) {
        t2 = s2[i2 = mask2 & i2 + 1];
        r = r * width2 + s2[mask2 & (s2[i2] = s2[j2 = mask2 & j2 + t2]) + (s2[j2] = t2)];
      }
      me.i = i2;
      me.j = j2;
      return r;
    };
  }
  function copy(f, t) {
    t.i = f.i;
    t.j = f.j;
    t.S = f.S.slice();
    return t;
  }
  function flatten(obj, depth) {
    var result = [], typ = typeof obj, prop;
    if (depth && typ == "object") {
      for (prop in obj) {
        try {
          result.push(flatten(obj[prop], depth - 1));
        } catch (e) {
        }
      }
    }
    return result.length ? result : typ == "string" ? obj : obj + "\0";
  }
  function mixkey(seed, key2) {
    var stringseed = seed + "", smear, j = 0;
    while (j < stringseed.length) {
      key2[mask2 & j] = mask2 & (smear ^= key2[mask2 & j] * 19) + stringseed.charCodeAt(j++);
    }
    return tostring(key2);
  }
  function autoseed() {
    try {
      if (nodecrypto) {
        return tostring(nodecrypto.randomBytes(width2));
      }
      var out = new Uint8Array(width2);
      (global.crypto || global.msCrypto).getRandomValues(out);
      return tostring(out);
    } catch (e) {
      var browser = global.navigator, plugins = browser && browser.plugins;
      return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
    }
  }
  function tostring(a) {
    return String.fromCharCode.apply(0, a);
  }
  mixkey(math.random(), pool);
}
function initialize(BMMath2) {
  seedRandom2([], BMMath2);
}
var seedrandom_default = initialize;

// vendor/lottie-expression-src/utils/helpers/propTypes.js
var propTypes_default = {
  SHAPE: "shape"
};

// vendor/lottie-expression-src/utils/expressions/ExpressionManager.js
var ExpressionManager = function() {
  "use strict";
  var ob = {};
  var Math = BMMath;
  var window = null;
  var document = null;
  var XMLHttpRequest = null;
  var fetch = null;
  var frames = null;
  var _lottieGlobal = {};
  seedrandom_default(BMMath);
  function resetFrame() {
    _lottieGlobal = {};
  }
  function $bm_isInstanceOfArray(arr) {
    return arr.constructor === Array || arr.constructor === Float32Array;
  }
  function isNumerable(tOfV, v) {
    return tOfV === "number" || v instanceof Number || tOfV === "boolean" || tOfV === "string";
  }
  function $bm_neg(a) {
    var tOfA = typeof a;
    if (tOfA === "number" || a instanceof Number || tOfA === "boolean") {
      return -a;
    }
    if ($bm_isInstanceOfArray(a)) {
      var i;
      var lenA = a.length;
      var retArr = [];
      for (i = 0; i < lenA; i += 1) {
        retArr[i] = -a[i];
      }
      return retArr;
    }
    if (a.propType) {
      return a.v;
    }
    return -a;
  }
  var easeInBez = BezierEaser_default.getBezierEasing(0.333, 0, 0.833, 0.833, "easeIn").get;
  var easeOutBez = BezierEaser_default.getBezierEasing(0.167, 0.167, 0.667, 1, "easeOut").get;
  var easeInOutBez = BezierEaser_default.getBezierEasing(0.33, 0, 0.667, 1, "easeInOut").get;
  function sum(a, b) {
    var tOfA = typeof a;
    var tOfB = typeof b;
    if (isNumerable(tOfA, a) && isNumerable(tOfB, b) || tOfA === "string" || tOfB === "string") {
      return a + b;
    }
    if ($bm_isInstanceOfArray(a) && isNumerable(tOfB, b)) {
      a = a.slice(0);
      a[0] += b;
      return a;
    }
    if (isNumerable(tOfA, a) && $bm_isInstanceOfArray(b)) {
      b = b.slice(0);
      b[0] = a + b[0];
      return b;
    }
    if ($bm_isInstanceOfArray(a) && $bm_isInstanceOfArray(b)) {
      var i = 0;
      var lenA = a.length;
      var lenB = b.length;
      var retArr = [];
      while (i < lenA || i < lenB) {
        if ((typeof a[i] === "number" || a[i] instanceof Number) && (typeof b[i] === "number" || b[i] instanceof Number)) {
          retArr[i] = a[i] + b[i];
        } else {
          retArr[i] = b[i] === void 0 ? a[i] : a[i] || b[i];
        }
        i += 1;
      }
      return retArr;
    }
    return 0;
  }
  var add = sum;
  function sub(a, b) {
    var tOfA = typeof a;
    var tOfB = typeof b;
    if (isNumerable(tOfA, a) && isNumerable(tOfB, b)) {
      if (tOfA === "string") {
        a = parseInt(a, 10);
      }
      if (tOfB === "string") {
        b = parseInt(b, 10);
      }
      return a - b;
    }
    if ($bm_isInstanceOfArray(a) && isNumerable(tOfB, b)) {
      a = a.slice(0);
      a[0] -= b;
      return a;
    }
    if (isNumerable(tOfA, a) && $bm_isInstanceOfArray(b)) {
      b = b.slice(0);
      b[0] = a - b[0];
      return b;
    }
    if ($bm_isInstanceOfArray(a) && $bm_isInstanceOfArray(b)) {
      var i = 0;
      var lenA = a.length;
      var lenB = b.length;
      var retArr = [];
      while (i < lenA || i < lenB) {
        if ((typeof a[i] === "number" || a[i] instanceof Number) && (typeof b[i] === "number" || b[i] instanceof Number)) {
          retArr[i] = a[i] - b[i];
        } else {
          retArr[i] = b[i] === void 0 ? a[i] : a[i] || b[i];
        }
        i += 1;
      }
      return retArr;
    }
    return 0;
  }
  function mul(a, b) {
    var tOfA = typeof a;
    var tOfB = typeof b;
    var arr;
    if (isNumerable(tOfA, a) && isNumerable(tOfB, b)) {
      return a * b;
    }
    var i;
    var len;
    if ($bm_isInstanceOfArray(a) && isNumerable(tOfB, b)) {
      len = a.length;
      arr = createTypedArray("float32", len);
      for (i = 0; i < len; i += 1) {
        arr[i] = a[i] * b;
      }
      return arr;
    }
    if (isNumerable(tOfA, a) && $bm_isInstanceOfArray(b)) {
      len = b.length;
      arr = createTypedArray("float32", len);
      for (i = 0; i < len; i += 1) {
        arr[i] = a * b[i];
      }
      return arr;
    }
    return 0;
  }
  function div(a, b) {
    var tOfA = typeof a;
    var tOfB = typeof b;
    var arr;
    if (isNumerable(tOfA, a) && isNumerable(tOfB, b)) {
      return a / b;
    }
    var i;
    var len;
    if ($bm_isInstanceOfArray(a) && isNumerable(tOfB, b)) {
      len = a.length;
      arr = createTypedArray("float32", len);
      for (i = 0; i < len; i += 1) {
        arr[i] = a[i] / b;
      }
      return arr;
    }
    if (isNumerable(tOfA, a) && $bm_isInstanceOfArray(b)) {
      len = b.length;
      arr = createTypedArray("float32", len);
      for (i = 0; i < len; i += 1) {
        arr[i] = a / b[i];
      }
      return arr;
    }
    return 0;
  }
  function mod(a, b) {
    if (typeof a === "string") {
      a = parseInt(a, 10);
    }
    if (typeof b === "string") {
      b = parseInt(b, 10);
    }
    return a % b;
  }
  var $bm_sum = sum;
  var $bm_sub = sub;
  var $bm_mul = mul;
  var $bm_div = div;
  var $bm_mod = mod;
  function clamp(num, min, max) {
    if (min > max) {
      var mm = max;
      max = min;
      min = mm;
    }
    return Math.min(Math.max(num, min), max);
  }
  function radiansToDegrees(val2) {
    return val2 / degToRads;
  }
  var radians_to_degrees = radiansToDegrees;
  function degreesToRadians(val2) {
    return val2 * degToRads;
  }
  var degrees_to_radians = radiansToDegrees;
  var helperLengthArray = [0, 0, 0, 0, 0, 0];
  function length(arr1, arr2) {
    if (typeof arr1 === "number" || arr1 instanceof Number) {
      arr2 = arr2 || 0;
      return Math.abs(arr1 - arr2);
    }
    if (!arr2) {
      arr2 = helperLengthArray;
    }
    var i;
    var len = Math.min(arr1.length, arr2.length);
    var addedLength = 0;
    for (i = 0; i < len; i += 1) {
      addedLength += Math.pow(arr2[i] - arr1[i], 2);
    }
    return Math.sqrt(addedLength);
  }
  function normalize(vec) {
    return div(vec, length(vec));
  }
  function rgbToHsl(val2) {
    var r = val2[0];
    var g = val2[1];
    var b = val2[2];
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h;
    var s;
    var l = (max + min) / 2;
    if (max === min) {
      h = 0;
      s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
        default:
          break;
      }
      h /= 6;
    }
    return [h, s, l, val2[3]];
  }
  function hue2rgb(p, q, t) {
    if (t < 0)
      t += 1;
    if (t > 1)
      t -= 1;
    if (t < 1 / 6)
      return p + (q - p) * 6 * t;
    if (t < 1 / 2)
      return q;
    if (t < 2 / 3)
      return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hslToRgb(val2) {
    var h = val2[0];
    var s = val2[1];
    var l = val2[2];
    var r;
    var g;
    var b;
    if (s === 0) {
      r = l;
      b = l;
      g = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b, val2[3]];
  }
  function linear(t, tMin, tMax, value1, value2) {
    if (value1 === void 0 || value2 === void 0) {
      value1 = tMin;
      value2 = tMax;
      tMin = 0;
      tMax = 1;
    }
    if (tMax < tMin) {
      var _tMin = tMax;
      tMax = tMin;
      tMin = _tMin;
    }
    if (t <= tMin) {
      return value1;
    }
    if (t >= tMax) {
      return value2;
    }
    var perc = tMax === tMin ? 0 : (t - tMin) / (tMax - tMin);
    if (!value1.length) {
      return value1 + (value2 - value1) * perc;
    }
    var i;
    var len = value1.length;
    var arr = createTypedArray("float32", len);
    for (i = 0; i < len; i += 1) {
      arr[i] = value1[i] + (value2[i] - value1[i]) * perc;
    }
    return arr;
  }
  function random(min, max) {
    if (max === void 0) {
      if (min === void 0) {
        min = 0;
        max = 1;
      } else {
        max = min;
        min = void 0;
      }
    }
    if (max.length) {
      var i;
      var len = max.length;
      if (!min) {
        min = createTypedArray("float32", len);
      }
      var arr = createTypedArray("float32", len);
      var rnd = BMMath.random();
      for (i = 0; i < len; i += 1) {
        arr[i] = min[i] + rnd * (max[i] - min[i]);
      }
      return arr;
    }
    if (min === void 0) {
      min = 0;
    }
    var rndm = BMMath.random();
    return min + rndm * (max - min);
  }
  function createPath(points, inTangents, outTangents, closed) {
    var i;
    var len = points.length;
    var path = shape_pool_default.newElement();
    path.setPathData(!!closed, len);
    var arrPlaceholder = [0, 0];
    var inVertexPoint;
    var outVertexPoint;
    for (i = 0; i < len; i += 1) {
      inVertexPoint = inTangents && inTangents[i] ? inTangents[i] : arrPlaceholder;
      outVertexPoint = outTangents && outTangents[i] ? outTangents[i] : arrPlaceholder;
      path.setTripleAt(points[i][0], points[i][1], outVertexPoint[0] + points[i][0], outVertexPoint[1] + points[i][1], inVertexPoint[0] + points[i][0], inVertexPoint[1] + points[i][1], i, true);
    }
    return path;
  }
  function initiateExpression(elem, data, property) {
    function noOp(_value) {
      return _value;
    }
    if (!elem.globalData.renderConfig.runExpressions) {
      return noOp;
    }
    var val = data.x;
    var needsVelocity = /velocity(?![\w\d])/.test(val);
    var _needsRandom = val.indexOf("random") !== -1;
    var elemType = elem.data.ty;
    var transform;
    var $bm_transform;
    var content;
    var effect;
    var thisProperty = property;
    thisProperty.valueAtTime = thisProperty.getValueAtTime;
    Object.defineProperty(thisProperty, "value", {
      get: function() {
        return thisProperty.v;
      }
    });
    elem.comp.frameDuration = 1 / elem.comp.globalData.frameRate;
    elem.comp.displayStartTime = 0;
    var inPoint = elem.data.ip / elem.comp.globalData.frameRate;
    var outPoint = elem.data.op / elem.comp.globalData.frameRate;
    var width = elem.data.sw ? elem.data.sw : 0;
    var height = elem.data.sh ? elem.data.sh : 0;
    var name = elem.data.nm;
    var loopIn;
    var loop_in;
    var loopOut;
    var loop_out;
    var smooth;
    var toWorld;
    var fromWorld;
    var fromComp;
    var toComp;
    var fromCompToSurface;
    var position;
    var rotation;
    var anchorPoint;
    var scale;
    var thisLayer;
    var thisComp;
    var mask;
    var valueAtTime;
    var velocityAtTime;
    var scoped_bm_rt;
    var expression_function = eval("[function _expression_function(){" + val + ";scoped_bm_rt=$bm_rt}]")[0];
    var numKeys = property.kf ? data.k.length : 0;
    var active = !this.data || this.data.hd !== true;
    var wiggle = function wiggle2(freq, amp) {
      var iWiggle;
      var j;
      var lenWiggle = this.pv.length ? this.pv.length : 1;
      var addedAmps = createTypedArray("float32", lenWiggle);
      freq = 5;
      var iterations = Math.floor(time * freq);
      iWiggle = 0;
      j = 0;
      while (iWiggle < iterations) {
        for (j = 0; j < lenWiggle; j += 1) {
          addedAmps[j] += -amp + amp * 2 * BMMath.random();
        }
        iWiggle += 1;
      }
      var periods = time * freq;
      var perc = periods - Math.floor(periods);
      var arr = createTypedArray("float32", lenWiggle);
      if (lenWiggle > 1) {
        for (j = 0; j < lenWiggle; j += 1) {
          arr[j] = this.pv[j] + addedAmps[j] + (-amp + amp * 2 * BMMath.random()) * perc;
        }
        return arr;
      }
      return this.pv + addedAmps[0] + (-amp + amp * 2 * BMMath.random()) * perc;
    }.bind(this);
    if (thisProperty.loopIn) {
      loopIn = thisProperty.loopIn.bind(thisProperty);
      loop_in = loopIn;
    }
    if (thisProperty.loopOut) {
      loopOut = thisProperty.loopOut.bind(thisProperty);
      loop_out = loopOut;
    }
    if (thisProperty.smooth) {
      smooth = thisProperty.smooth.bind(thisProperty);
    }
    function loopInDuration(type, duration) {
      return loopIn(type, duration, true);
    }
    function loopOutDuration(type, duration) {
      return loopOut(type, duration, true);
    }
    if (this.getValueAtTime) {
      valueAtTime = this.getValueAtTime.bind(this);
    }
    if (this.getVelocityAtTime) {
      velocityAtTime = this.getVelocityAtTime.bind(this);
    }
    var comp = elem.comp.globalData.projectInterface.bind(elem.comp.globalData.projectInterface);
    function lookAt(elem1, elem2) {
      var fVec = [elem2[0] - elem1[0], elem2[1] - elem1[1], elem2[2] - elem1[2]];
      var pitch = Math.atan2(fVec[0], Math.sqrt(fVec[1] * fVec[1] + fVec[2] * fVec[2])) / degToRads;
      var yaw = -Math.atan2(fVec[1], fVec[2]) / degToRads;
      return [yaw, pitch, 0];
    }
    function easeOut(t, tMin, tMax, val1, val2) {
      return applyEase(easeOutBez, t, tMin, tMax, val1, val2);
    }
    function easeIn(t, tMin, tMax, val1, val2) {
      return applyEase(easeInBez, t, tMin, tMax, val1, val2);
    }
    function ease(t, tMin, tMax, val1, val2) {
      return applyEase(easeInOutBez, t, tMin, tMax, val1, val2);
    }
    function applyEase(fn, t, tMin, tMax, val1, val2) {
      if (val1 === void 0) {
        val1 = tMin;
        val2 = tMax;
      } else {
        t = (t - tMin) / (tMax - tMin);
      }
      if (t > 1) {
        t = 1;
      } else if (t < 0) {
        t = 0;
      }
      var mult = fn(t);
      if ($bm_isInstanceOfArray(val1)) {
        var iKey;
        var lenKey = val1.length;
        var arr = createTypedArray("float32", lenKey);
        for (iKey = 0; iKey < lenKey; iKey += 1) {
          arr[iKey] = (val2[iKey] - val1[iKey]) * mult + val1[iKey];
        }
        return arr;
      }
      return (val2 - val1) * mult + val1;
    }
    function nearestKey(time2) {
      var iKey;
      var lenKey = data.k.length;
      var index2;
      var keyTime;
      if (!data.k.length || typeof data.k[0] === "number") {
        index2 = 0;
        keyTime = 0;
      } else {
        index2 = -1;
        time2 *= elem.comp.globalData.frameRate;
        if (time2 < data.k[0].t) {
          index2 = 1;
          keyTime = data.k[0].t;
        } else {
          for (iKey = 0; iKey < lenKey - 1; iKey += 1) {
            if (time2 === data.k[iKey].t) {
              index2 = iKey + 1;
              keyTime = data.k[iKey].t;
              break;
            } else if (time2 > data.k[iKey].t && time2 < data.k[iKey + 1].t) {
              if (time2 - data.k[iKey].t > data.k[iKey + 1].t - time2) {
                index2 = iKey + 2;
                keyTime = data.k[iKey + 1].t;
              } else {
                index2 = iKey + 1;
                keyTime = data.k[iKey].t;
              }
              break;
            }
          }
          if (index2 === -1) {
            index2 = iKey + 1;
            keyTime = data.k[iKey].t;
          }
        }
      }
      var obKey = {};
      obKey.index = index2;
      obKey.time = keyTime / elem.comp.globalData.frameRate;
      return obKey;
    }
    function key(ind) {
      var obKey;
      var iKey;
      var lenKey;
      if (!data.k.length || typeof data.k[0] === "number") {
        throw new Error("The property has no keyframe at index " + ind);
      }
      ind -= 1;
      obKey = {
        time: data.k[ind].t / elem.comp.globalData.frameRate,
        value: []
      };
      var arr = Object.prototype.hasOwnProperty.call(data.k[ind], "s") ? data.k[ind].s : data.k[ind - 1].e;
      lenKey = arr.length;
      for (iKey = 0; iKey < lenKey; iKey += 1) {
        obKey[iKey] = arr[iKey];
        obKey.value[iKey] = arr[iKey];
      }
      return obKey;
    }
    function framesToTime(fr, fps) {
      if (!fps) {
        fps = elem.comp.globalData.frameRate;
      }
      return fr / fps;
    }
    function timeToFrames(t, fps) {
      if (!t && t !== 0) {
        t = time;
      }
      if (!fps) {
        fps = elem.comp.globalData.frameRate;
      }
      return t * fps;
    }
    function seedRandom(seed) {
      BMMath.seedrandom(randSeed + seed);
    }
    function sourceRectAtTime() {
      return elem.sourceRectAtTime();
    }
    function substring(init, end) {
      if (typeof value === "string") {
        if (end === void 0) {
          return value.substring(init);
        }
        return value.substring(init, end);
      }
      return "";
    }
    function substr(init, end) {
      if (typeof value === "string") {
        if (end === void 0) {
          return value.substr(init);
        }
        return value.substr(init, end);
      }
      return "";
    }
    function posterizeTime(framesPerSecond) {
      time = framesPerSecond === 0 ? 0 : Math.floor(time * framesPerSecond) / framesPerSecond;
      value = valueAtTime(time);
    }
    var time;
    var velocity;
    var value;
    var text;
    var textIndex;
    var textTotal;
    var selectorValue;
    var index = elem.data.ind;
    var hasParent = !!(elem.hierarchy && elem.hierarchy.length);
    var parent;
    var randSeed = Math.floor(Math.random() * 1e6);
    var globalData = elem.globalData;
    function executeExpression(_value) {
      value = _value;
      if (this.frameExpressionId === elem.globalData.frameId && this.propType !== "textSelector") {
        return value;
      }
      if (this.propType === "textSelector") {
        textIndex = this.textIndex;
        textTotal = this.textTotal;
        selectorValue = this.selectorValue;
      }
      if (!thisLayer) {
        text = elem.layerInterface.text;
        thisLayer = elem.layerInterface;
        thisComp = elem.comp.compInterface;
        toWorld = thisLayer.toWorld.bind(thisLayer);
        fromWorld = thisLayer.fromWorld.bind(thisLayer);
        fromComp = thisLayer.fromComp.bind(thisLayer);
        toComp = thisLayer.toComp.bind(thisLayer);
        mask = thisLayer.mask ? thisLayer.mask.bind(thisLayer) : null;
        fromCompToSurface = fromComp;
      }
      if (!transform) {
        transform = elem.layerInterface("ADBE Transform Group");
        $bm_transform = transform;
        if (transform) {
          anchorPoint = transform.anchorPoint;
        }
      }
      if (elemType === 4 && !content) {
        content = thisLayer("ADBE Root Vectors Group");
      }
      if (!effect) {
        effect = thisLayer(4);
      }
      hasParent = !!(elem.hierarchy && elem.hierarchy.length);
      if (hasParent && !parent) {
        parent = elem.hierarchy[0].layerInterface;
      }
      time = this.comp.renderedFrame / this.comp.globalData.frameRate;
      if (_needsRandom) {
        seedRandom(randSeed + time);
      }
      if (needsVelocity) {
        velocity = velocityAtTime(time);
      }
      expression_function();
      this.frameExpressionId = elem.globalData.frameId;
      scoped_bm_rt = scoped_bm_rt.propType === propTypes_default.SHAPE ? scoped_bm_rt.v : scoped_bm_rt;
      return scoped_bm_rt;
    }
    executeExpression.__preventDeadCodeRemoval = [$bm_transform, anchorPoint, time, velocity, inPoint, outPoint, width, height, name, loop_in, loop_out, smooth, toComp, fromCompToSurface, toWorld, fromWorld, mask, position, rotation, scale, thisComp, numKeys, active, wiggle, loopInDuration, loopOutDuration, comp, lookAt, easeOut, easeIn, ease, nearestKey, key, text, textIndex, textTotal, selectorValue, framesToTime, timeToFrames, sourceRectAtTime, substring, substr, posterizeTime, index, globalData];
    return executeExpression;
  }
  ob.initiateExpression = initiateExpression;
  ob.__preventDeadCodeRemoval = [window, document, XMLHttpRequest, fetch, frames, $bm_neg, add, $bm_sum, $bm_sub, $bm_mul, $bm_div, $bm_mod, clamp, radians_to_degrees, degreesToRadians, degrees_to_radians, normalize, rgbToHsl, hslToRgb, linear, random, createPath, _lottieGlobal];
  ob.resetFrame = resetFrame;
  return ob;
}();
var ExpressionManager_default = ExpressionManager;
export {
  ExpressionManager_default as default
};
