/**
 * @see https://github.com/brendankenny/libtess.js/blob/gh-pages/examples/osm/triangulate.js
 * @see https://github.com/ShukantPal/pixi-essentials/blob/049c67d0126ca771e026a04702a63fee1ce25d16/packages/svg/src/utils/buildPath.ts#L12
 */
import libtess from 'libtess';

// function called for each vertex of tesselator output
function vertexCallback(data, polyVertArray) {
  // console.log(data[0], data[1]);
  polyVertArray[polyVertArray.length] = data[0];
  polyVertArray[polyVertArray.length] = data[1];
}
function begincallback(type) {
  if (type !== libtess.primitiveType.GL_TRIANGLES) {
    console.log('expected TRIANGLES but got type: ' + type);
  }
}
function errorcallback(errno) {
  console.log('error callback');
  console.log('error number: ' + errno);
}
// callback for when segments intersect and must be split
function combinecallback(coords, data, weight) {
  // console.log('combine callback');
  return [coords[0], coords[1], coords[2]];
}
function edgeCallback(flag) {
  // don't really care about the flag, but need no-strip/no-fan behavior
  // console.log('edge flag: ' + flag);
}

export function triangulate(
  contours: [number, number][][],
  fillRule: CanvasFillRule,
) {
  const tessy = new libtess.GluTesselator();
  tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_WINDING_RULE,
    fillRule === 'evenodd'
      ? libtess.windingRule.GLU_TESS_WINDING_ODD
      : libtess.windingRule.GLU_TESS_WINDING_NONZERO,
  );
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);

  // libtess will take 3d verts and flatten to a plane for tesselation
  // since only doing 2d tesselation here, provide z=1 normal to skip
  // iterating over verts only to get the same answer.
  // comment out to test normal-generation code
  tessy.gluTessNormal(0, 0, 1);

  const triangleVerts = [];
  tessy.gluTessBeginPolygon(triangleVerts);

  for (let i = 0; i < contours.length; i++) {
    tessy.gluTessBeginContour();
    const contour = contours[i];
    // for (var j = 0; j < contour.length; j += 2) {
    //   var coords = [contour[j], contour[j + 1], 0];
    for (let j = 0; j < contour.length; j++) {
      const coords = [contour[j][0], contour[j][1], 0];
      tessy.gluTessVertex(coords, coords);
    }
    tessy.gluTessEndContour();
  }

  // finish polygon (and time triangulation process)
  // var startTime = window.nowish();
  tessy.gluTessEndPolygon();
  // var endTime = window.nowish();
  // console.log('tesselation time: ' + (endTime - startTime).toFixed(2) + 'ms');

  return triangleVerts;
}
