---
title: "Wikipedia embedding map with loaders.gl"
description: "Load Arrow/CSV/ZIP datasets and plot them with deck.gl-style visualization."
---
<!-- example-intro:en -->

# Wikipedia embedding map with loaders.gl

This example mixes **data loading** (`@loaders.gl/*`) with a large scatter-style map. It is heavier than a typical tutorial snippet: use it to study streaming formats, not as a minimal hello-world.

The referenced notebook shows how the same datasets were prepared; adapt paths and loaders for your own tiles.

[Wikipedia_data_map_example] use [deck.gl]

<script setup>
import WikipediaDatamap from '../components/WikipediaDatamap.vue'
</script>

<WikipediaDatamap />

```ts
import { ArrowLoader } from 'https://cdn.jsdelivr.net/npm/@loaders.gl/arrow@4.1.0-alpha.10/+esm';
import { JSONLoader } from 'https://cdn.jsdelivr.net/npm/@loaders.gl/json@4.0.5/+esm';
import { ZipLoader } from 'https://cdn.jsdelivr.net/npm/@loaders.gl/zip@4.1.0-alpha.10/+esm';
import { CSVLoader } from 'https://cdn.jsdelivr.net/npm/@loaders.gl/csv@4.1.0-alpha.10/+esm';

const pointData = await loaders.load('wikipedia_point_df.arrow', ArrowLoader);
const unzippedHoverData = await loaders.load(
    'wikipedia_point_hover_data.zip',
    ZipLoader,
);
const hoverData = await loaders.parse(
    unzippedHoverData['point_hover_data.arrow'],
    ArrowLoader,
);
const unzippedLabelData = await loaders.load(
    'wikipedia_label_data.zip',
    ZipLoader,
);
const labelData = await loaders.parse(
    unzippedLabelData['label_data.json'],
    JSONLoader,
);

const DATA = { src: pointData.data, length: pointData.data.x.length };
```

[Wikipedia_data_map_example]: https://github.com/lmcinnes/datamapplot_examples/blob/master/Wikipedia_data_map_example.html
[deck.gl]: https://deck.gl/
