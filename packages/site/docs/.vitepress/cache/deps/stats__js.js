import {
  __commonJS
} from "./chunk-ZS7NZCD4.js";

// ../../node_modules/.pnpm/stats.js@0.17.0/node_modules/stats.js/build/stats.min.js
var require_stats_min = __commonJS({
  "../../node_modules/.pnpm/stats.js@0.17.0/node_modules/stats.js/build/stats.min.js"(exports, module) {
    (function(f, e) {
      "object" === typeof exports && "undefined" !== typeof module ? module.exports = e() : "function" === typeof define && define.amd ? define(e) : f.Stats = e();
    })(exports, function() {
      var f = function() {
        function e(a2) {
          c.appendChild(a2.dom);
          return a2;
        }
        function u(a2) {
          for (var d = 0; d < c.children.length; d++)
            c.children[d].style.display = d === a2 ? "block" : "none";
          l = a2;
        }
        var l = 0, c = document.createElement("div");
        c.style.cssText = "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";
        c.addEventListener("click", function(a2) {
          a2.preventDefault();
          u(++l % c.children.length);
        }, false);
        var k = (performance || Date).now(), g = k, a = 0, r = e(new f.Panel("FPS", "#0ff", "#002")), h = e(new f.Panel("MS", "#0f0", "#020"));
        if (self.performance && self.performance.memory)
          var t = e(new f.Panel("MB", "#f08", "#201"));
        u(0);
        return { REVISION: 16, dom: c, addPanel: e, showPanel: u, begin: function() {
          k = (performance || Date).now();
        }, end: function() {
          a++;
          var c2 = (performance || Date).now();
          h.update(c2 - k, 200);
          if (c2 > g + 1e3 && (r.update(1e3 * a / (c2 - g), 100), g = c2, a = 0, t)) {
            var d = performance.memory;
            t.update(d.usedJSHeapSize / 1048576, d.jsHeapSizeLimit / 1048576);
          }
          return c2;
        }, update: function() {
          k = this.end();
        }, domElement: c, setMode: u };
      };
      f.Panel = function(e, f2, l) {
        var c = Infinity, k = 0, g = Math.round, a = g(window.devicePixelRatio || 1), r = 80 * a, h = 48 * a, t = 3 * a, v = 2 * a, d = 3 * a, m = 15 * a, n = 74 * a, p = 30 * a, q = document.createElement("canvas");
        q.width = r;
        q.height = h;
        q.style.cssText = "width:80px;height:48px";
        var b = q.getContext("2d");
        b.font = "bold " + 9 * a + "px Helvetica,Arial,sans-serif";
        b.textBaseline = "top";
        b.fillStyle = l;
        b.fillRect(0, 0, r, h);
        b.fillStyle = f2;
        b.fillText(e, t, v);
        b.fillRect(d, m, n, p);
        b.fillStyle = l;
        b.globalAlpha = 0.9;
        b.fillRect(d, m, n, p);
        return { dom: q, update: function(h2, w) {
          c = Math.min(c, h2);
          k = Math.max(k, h2);
          b.fillStyle = l;
          b.globalAlpha = 1;
          b.fillRect(0, 0, r, m);
          b.fillStyle = f2;
          b.fillText(g(h2) + " " + e + " (" + g(c) + "-" + g(k) + ")", t, v);
          b.drawImage(q, d + a, m, n - a, p, d, m, n - a, p);
          b.fillRect(d + n - a, m, a, p);
          b.fillStyle = l;
          b.globalAlpha = 0.9;
          b.fillRect(d + n - a, m, a, g((1 - h2 / w) * p));
        } };
      };
      return f;
    });
  }
});
export default require_stats_min();
//# sourceMappingURL=stats__js.js.map
