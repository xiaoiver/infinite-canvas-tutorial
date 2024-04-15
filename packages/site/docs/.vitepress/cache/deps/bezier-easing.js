import {
  __commonJS
} from "./chunk-ZS7NZCD4.js";

// ../../node_modules/.pnpm/bezier-easing@2.1.0/node_modules/bezier-easing/src/index.js
var require_src = __commonJS({
  "../../node_modules/.pnpm/bezier-easing@2.1.0/node_modules/bezier-easing/src/index.js"(exports, module) {
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
        if (currentSlope === 0) {
          return aGuessT;
        }
        var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
        aGuessT -= currentX / currentSlope;
      }
      return aGuessT;
    }
    function LinearEasing(x) {
      return x;
    }
    module.exports = function bezier(mX1, mY1, mX2, mY2) {
      if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
        throw new Error("bezier x values must be in [0, 1] range");
      }
      if (mX1 === mY1 && mX2 === mY2) {
        return LinearEasing;
      }
      var sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
      for (var i = 0; i < kSplineTableSize; ++i) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
      }
      function getTForX(aX) {
        var intervalStart = 0;
        var currentSample = 1;
        var lastSample = kSplineTableSize - 1;
        for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
          intervalStart += kSampleStepSize;
        }
        --currentSample;
        var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
        var guessForT = intervalStart + dist * kSampleStepSize;
        var initialSlope = getSlope(guessForT, mX1, mX2);
        if (initialSlope >= NEWTON_MIN_SLOPE) {
          return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
        } else if (initialSlope === 0) {
          return guessForT;
        } else {
          return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
        }
      }
      return function BezierEasing(x) {
        if (x === 0) {
          return 0;
        }
        if (x === 1) {
          return 1;
        }
        return calcBezier(getTForX(x), mY1, mY2);
      };
    };
  }
});
export default require_src();
//# sourceMappingURL=bezier-easing.js.map
