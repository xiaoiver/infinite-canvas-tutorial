---
title: "Wikipedia 嵌入向量与 loaders.gl 数据管线"
description: "从 Arrow/CSV/ZIP 等格式加载数据并做大规模散点可视化。"
---
<!-- example-intro:zh -->

# Wikipedia 嵌入向量与 loaders.gl 数据管线

本示例结合 **数据加载**（`@loaders.gl/*`）与类 deck.gl 的可视化，体量大于普通教学片段，适合作为数据管线参考，而非最小示例。

文内链接指向原始数据准备方式；集成时请按自己的切片与加载器调整路径。

[Wikipedia_data_map_example] use [deck.gl]

<script setup>
import WikipediaDatamap from '../../components/WikipediaDatamap.vue'
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
