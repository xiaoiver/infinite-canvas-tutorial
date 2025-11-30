import KDBush from 'kdbush';

const OFFSET_ZOOM = 2;
const OFFSET_ID = 3;
const OFFSET_PARENT = 4;
const OFFSET_NUM = 5;
const OFFSET_PROP = 6;

const DEFAULT_OPTIONS = {
  minZoom: 0, // min zoom to generate clusters on
  maxZoom: 16, // max zoom level to cluster the points on
  minPoints: 2, // minimum points to form a cluster
  radius: 256, // cluster radius in pixels
  nodeSize: 64, // size of the KD-tree leaf node, affects performance
  // a reduce function for calculating custom cluster properties
  reduce: null, // (accumulated, props) => { accumulated.sum += props.sum; }
  map: (props) => props, // props => ({sum: props.my_value})
};

export interface ClusterPoint {
  x: number;
  y: number;
  properties?: any;
}

export class Cluster {
  #trees: KDBush[] = [];
  #stride: number;

  points: ClusterPoint[];
  clusterProps: any[] = [];

  constructor(private options: Partial<typeof DEFAULT_OPTIONS> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...this.options };
    this.#stride = this.options.reduce ? 7 : 6;
    this.#trees = new Array(this.options.maxZoom + 1);
    this.clusterProps = [];
  }

  load(points: { x: number; y: number }[]) {
    const { minZoom, maxZoom } = this.options;

    this.points = points;

    // generate a cluster object for each point and index input points into a KD-tree
    const data: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const { x, y } = points[i];

      // store internal point/cluster data in flat numeric arrays for performance
      data.push(
        x,
        y, // projected point coordinates
        Infinity, // the last zoom the point was processed at
        i, // index of the source feature in the original input array
        -1, // parent cluster id
        1, // number of points in a cluster
      );
    }

    let tree = (this.#trees[maxZoom + 1] = this.createTree(data));
    // cluster points on max zoom, then cluster the results on previous zoom, etc.;
    // results in a cluster hierarchy across zoom levels
    for (let z = maxZoom; z >= minZoom; z--) {
      // create a new set of clusters for the zoom and index them with a KD-tree
      tree = this.#trees[z] = this.createTree(this.cluster(tree, z));
    }
  }

  getClusters(bbox: [number, number, number, number], zoom: number) {
    const tree = this.#trees[this.limitZoom(zoom)];
    const [minX, minY, maxX, maxY] = bbox;
    const ids = tree.range(minX, minY, maxX, maxY);
    const data = tree.data;
    const clusters = [];
    for (const id of ids) {
      const k = this.#stride * id;
      clusters.push(
        data[k + OFFSET_NUM] > 1
          ? getClusterJSON(data, k, this.clusterProps)
          : this.points[data[k + OFFSET_ID]],
      );
    }
    return clusters;
  }

  private limitZoom(z: number): number {
    return Math.max(
      this.options.minZoom,
      Math.min(Math.floor(+z), this.options.maxZoom + 1),
    );
  }

  private createTree(data: number[]) {
    const tree = new KDBush(
      (data.length / this.#stride) | 0,
      this.options.nodeSize,
      Float32Array,
    );
    for (let i = 0; i < data.length; i += this.#stride)
      tree.add(data[i], data[i + 1]);
    tree.finish();
    tree.data = data as unknown as ArrayBuffer;
    return tree;
  }

  private cluster(tree: KDBush, zoom: number) {
    const { radius, reduce, minPoints } = this.options;
    const r = radius / Math.pow(2, zoom);
    const data = tree.data;
    const nextData = [];
    const stride = this.#stride;

    // loop through each point
    for (let i = 0; i < (data as unknown as number[]).length; i += stride) {
      // if we've already visited the point at this zoom level, skip it
      if (data[i + OFFSET_ZOOM] <= zoom) continue;
      data[i + OFFSET_ZOOM] = zoom;

      // find all nearby points
      const x = data[i];
      const y = data[i + 1];
      const neighborIds = tree.within(data[i], data[i + 1], r);

      const numPointsOrigin = data[i + OFFSET_NUM];
      let numPoints = numPointsOrigin;

      // count the number of points in a potential cluster
      for (const neighborId of neighborIds) {
        const k = neighborId * stride;
        // filter out neighbors that are already processed
        if (data[k + OFFSET_ZOOM] > zoom) numPoints += data[k + OFFSET_NUM];
      }

      // if there were neighbors to merge, and there are enough points to form a cluster
      if (numPoints > numPointsOrigin && numPoints >= minPoints) {
        let wx = x * numPointsOrigin;
        let wy = y * numPointsOrigin;

        let clusterProperties;
        let clusterPropIndex = -1;

        // encode both zoom and point index on which the cluster originated -- offset by total length of features
        const id = (((i / stride) | 0) << 5) + (zoom + 1) + this.points.length;

        for (const neighborId of neighborIds) {
          const k = neighborId * stride;

          if (data[k + OFFSET_ZOOM] <= zoom) continue;
          data[k + OFFSET_ZOOM] = zoom; // save the zoom (so it doesn't get processed twice)

          const numPoints2 = data[k + OFFSET_NUM];
          wx += data[k] * numPoints2; // accumulate coordinates for calculating weighted center
          wy += data[k + 1] * numPoints2;

          data[k + OFFSET_PARENT] = id;

          if (reduce) {
            if (!clusterProperties) {
              clusterProperties = this.map(data, i, true);
              clusterPropIndex = this.clusterProps.length;
              this.clusterProps.push(clusterProperties);
            }
            reduce(clusterProperties, this.map(data, k));
          }
        }

        data[i + OFFSET_PARENT] = id;
        nextData.push(
          wx / numPoints,
          wy / numPoints,
          Infinity,
          id,
          -1,
          numPoints,
        );
        if (reduce) nextData.push(clusterPropIndex);
      } else {
        // left points as unclustered
        for (let j = 0; j < stride; j++) nextData.push(data[i + j]);

        if (numPoints > 1) {
          for (const neighborId of neighborIds) {
            const k = neighborId * stride;
            if (data[k + OFFSET_ZOOM] <= zoom) continue;
            data[k + OFFSET_ZOOM] = zoom;
            for (let j = 0; j < stride; j++) nextData.push(data[k + j]);
          }
        }
      }
    }

    return nextData;
  }

  private map(data: ArrayBuffer, i: number, clone: boolean = false) {
    if (data[i + OFFSET_NUM] > 1) {
      const props = this.clusterProps[data[i + OFFSET_PROP]];
      return clone ? Object.assign({}, props) : props;
    }
    const original = this.points[data[i + OFFSET_ID]].properties;
    const result = this.options.map(original);
    return clone && result === original ? Object.assign({}, result) : result;
  }
}

function getClusterJSON(data: ArrayBuffer, i: number, clusterProps: any[]) {
  const count = data[i + OFFSET_NUM];
  const propIndex = data[i + OFFSET_PROP];
  const properties =
    propIndex === -1 ? {} : Object.assign({}, clusterProps[propIndex]);
  return {
    id: data[i + OFFSET_ID],
    x: data[i],
    y: data[i + 1],
    properties: {
      cluster: true,
      count,
      ...properties,
    },
  };
}
