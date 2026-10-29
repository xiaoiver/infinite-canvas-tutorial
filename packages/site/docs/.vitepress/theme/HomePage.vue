<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';

const gallery = [
  {
    src: '/gallery/halftone.png',
    width: 1492,
    height: 906,
    alt: {
      en: 'Halftone post-processing',
      zh: '半调网点',
      ko: '하프톤',
      ja: 'ハーフトーン',
      'zh-Hant': '半調網點',
      es: 'Semitono',
      'pt-BR': 'Meio-tom',
    },
  },
  {
    src: '/gallery/pixelate.png',
    width: 1042,
    height: 480,
    alt: {
      en: 'Pixelate effect',
      zh: '像素化',
      ko: '픽셀화',
      ja: 'ピクセル化',
      'zh-Hant': '像素化',
      es: 'Pixelado',
      'pt-BR': 'Pixelização',
    },
  },
  {
    src: '/gallery/radiance-cascades.png',
    width: 1370,
    height: 798,
    alt: {
      en: 'Radiance cascades lighting',
      zh: '辐射级联光照',
      ko: '래디언스 캐스케이드',
      ja: 'ラディアンスキャスケード',
      'zh-Hant': '輻射級聯光照',
      es: 'Iluminación por radiance cascades',
      'pt-BR': 'Iluminação por radiance cascades',
    },
  },
  {
    src: '/gallery/vello.png',
    width: 1532,
    height: 782,
    alt: {
      en: 'Vello GPU rendering',
      zh: 'Vello GPU 渲染',
      ko: 'Vello GPU 렌더링',
      ja: 'Vello GPU レンダリング',
      'zh-Hant': 'Vello GPU 渲染',
      es: 'Renderizado GPU con Vello',
      'pt-BR': 'Renderização GPU com Vello',
    },
  },
  {
    src: '/gallery/iconfont.png',
    width: 1272,
    height: 662,
    alt: {
      en: 'Icon fonts on the canvas',
      zh: '画布上的图标字体',
      ko: '캔버스 위의 아이콘 폰트',
      ja: 'キャンバス上のアイコンフォント',
      'zh-Hant': '畫布上的圖示字型',
      es: 'Fuentes de iconos en el lienzo',
      'pt-BR': 'Fontes de ícones na tela',
    },
  },
  {
    src: '/gallery/mermaid.png',
    width: 730,
    height: 696,
    alt: {
      en: 'Mermaid diagrams',
      zh: 'Mermaid 图表',
      ko: 'Mermaid 다이어그램',
      ja: 'Mermaid ダイアグラム',
      'zh-Hant': 'Mermaid 圖表',
      es: 'Diagramas Mermaid',
      'pt-BR': 'Diagramas Mermaid',
    },
  },
  {
    src: '/gallery/orth-connector.png',
    width: 872,
    height: 510,
    alt: {
      en: 'Orthogonal connectors',
      zh: '正交连线',
      ko: '직교 연결선',
      ja: '直交コネクタ',
      'zh-Hant': '正交連線',
      es: 'Conectores ortogonales',
      'pt-BR': 'Conectores ortogonais',
    },
  },
];

const pages = {
  en: {
    base: '',
    locale: 'en',
    eyebrow: 'WebGL / WebGPU',
    title: 'An infinite canvas tutorial',
    lede: 'Step-by-step lessons for a Figma-like canvas, with examples you can run in the page.',
    primary: { label: 'Open app', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: 'Start lesson 1', href: '/guide/lesson-001' },
    heroAlt: 'The infinite canvas app, with pictures and a sketch on the board',
    tracksTitle: 'Three ways through the lessons',
    tracks: [
      {
        title: 'Draw on the GPU',
        text: 'Circles, text, strokes, and post-processing with SDF and WebGPU.',
        image: '/gallery/watercolor.png',
        imageAlt: 'Watercolor-style rendering',
        width: 1062,
        height: 582,
        links: [
          { label: 'Draw a circle', href: '/guide/lesson-002' },
          { label: 'Ellipse and rectangle', href: '/guide/lesson-009' },
          { label: 'Text rendering', href: '/guide/lesson-015' },
          { label: 'Post-processing', href: '/guide/lesson-030' },
        ],
      },
      {
        title: 'Tools and interface',
        text: 'Transformer, brushes, and the clipboard.',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: 'Brush and eraser tools',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: 'Transformer', href: '/guide/lesson-021' },
          { label: 'Brushes', href: '/guide/lesson-025' },
          { label: 'Clipboard', href: '/guide/lesson-024' },
        ],
      },
      {
        title: 'Draw with a model',
        text: 'Generate shapes, vectorize an image, talk to the canvas.',
        image: '/gallery/liquid-metal.png',
        imageAlt: 'Liquid metal text and materials',
        width: 1974,
        height: 990,
        links: [
          { label: 'Integrating with AI', href: '/guide/lesson-028' },
          { label: 'Text to diagram', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: 'From the canvas',
    moreTitle: 'Also in the docs',
    more: [
      { label: 'Examples', href: '/example/solar-system' },
      { label: 'Reference', href: '/reference/canvas' },
      { label: 'Experiments', href: '/experiment/particles' },
    ],
  },
  zh: {
    base: '/zh',
    locale: 'zh',
    eyebrow: 'WebGL / WebGPU',
    title: '一个无限画布教程',
    lede: '从空白画布开始，用页面里可运行的例子，做成接近 Figma 的无限画布。',
    primary: { label: '打开应用', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: '从第一课开始', href: '/guide/lesson-001' },
    heroAlt: '无限画布应用，画板上有图片和一幅素描',
    tracksTitle: '三条阅读路线',
    tracks: [
      {
        title: '在 GPU 上作画',
        text: '用 SDF 和 WebGPU 画圆、文字、描边，并做后处理。',
        image: '/gallery/watercolor.png',
        imageAlt: '水彩风格渲染',
        width: 1062,
        height: 582,
        links: [
          { label: '绘制圆', href: '/guide/lesson-002' },
          { label: '椭圆和矩形', href: '/guide/lesson-009' },
          { label: '绘制文本', href: '/guide/lesson-015' },
          { label: '后处理', href: '/guide/lesson-030' },
        ],
      },
      {
        title: '工具和界面',
        text: '变换控件、笔刷和剪贴板。',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: '笔刷和橡皮擦',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: '变换控件', href: '/guide/lesson-021' },
          { label: '笔刷', href: '/guide/lesson-025' },
          { label: '剪贴板', href: '/guide/lesson-024' },
        ],
      },
      {
        title: '让模型参与绘制',
        text: '生成图形，把图片变成矢量。',
        image: '/gallery/liquid-metal.png',
        imageAlt: '液态金属文字与材质',
        width: 1974,
        height: 990,
        links: [
          { label: '集成 AI', href: '/guide/lesson-028' },
          { label: '文字生成图表', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: '画布上的效果',
    moreTitle: '文档里还有',
    more: [
      { label: '案例', href: '/example/solar-system' },
      { label: '参考', href: '/reference/canvas' },
      { label: '实验', href: '/experiment/particles' },
    ],
  },
  ko: {
    base: '/ko',
    locale: 'ko',
    eyebrow: 'WebGL / WebGPU',
    title: '무한 캔버스 튜토리얼',
    lede: '빈 캔버스에서 시작해, 페이지에서 바로 실행되는 예제로 Figma 같은 무한 캔버스를 만듭니다.',
    primary: { label: '앱 열기', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: '1강부터 시작', href: '/guide/lesson-001' },
    heroAlt: '무한 캔버스 앱. 보드 위에 사진과 스케치가 있습니다',
    tracksTitle: '세 가지 읽는 길',
    tracks: [
      {
        title: 'GPU로 그리기',
        text: 'SDF와 WebGPU로 원, 글자, 획, 후처리를 다룹니다.',
        image: '/gallery/watercolor.png',
        imageAlt: '수채화 스타일 렌더링',
        width: 1062,
        height: 582,
        links: [
          { label: '원 그리기', href: '/guide/lesson-002' },
          { label: '타원과 사각형', href: '/guide/lesson-009' },
          { label: '텍스트 렌더링', href: '/guide/lesson-015' },
          { label: '후처리', href: '/guide/lesson-030' },
        ],
      },
      {
        title: '도구와 인터페이스',
        text: '트랜스포머, 브러시, 클립보드.',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: '브러시와 지우개',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: '트랜스포머', href: '/guide/lesson-021' },
          { label: '브러시', href: '/guide/lesson-025' },
          { label: '클립보드', href: '/guide/lesson-024' },
        ],
      },
      {
        title: '모델과 함께 그리기',
        text: '도형을 만들고, 이미지를 벡터로 바꾸며, 캔버스와 대화합니다.',
        image: '/gallery/liquid-metal.png',
        imageAlt: '리퀴드 메탈 텍스트와 재질',
        width: 1974,
        height: 990,
        links: [
          { label: 'AI 통합', href: '/guide/lesson-028' },
          { label: '텍스트로 다이어그램', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: '캔버스 위의 효과',
    moreTitle: '문서에 더 있습니다',
    more: [
      { label: '예제 (EN)', href: '/example/solar-system', locale: 'en' },
      { label: '레퍼런스 (EN)', href: '/reference/canvas', locale: 'en' },
      { label: '실험 (EN)', href: '/experiment/particles', locale: 'en' },
    ],
  },
  ja: {
    base: '/ja',
    locale: 'ja',
    eyebrow: 'WebGL / WebGPU',
    title: '無限キャンバスチュートリアル',
    lede: '空のキャンバスから始め、ページ内で動く例を使って Figma のような無限キャンバスを作ります。',
    primary: { label: 'アプリを開く', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: '第1課から始める', href: '/guide/lesson-001' },
    heroAlt: '無限キャンバスのアプリ。ボードには写真とスケッチがあります',
    tracksTitle: '三つの読み方',
    tracks: [
      {
        title: 'GPU で描く',
        text: 'SDF と WebGPU で円、文字、ストローク、ポストプロセスを扱います。',
        image: '/gallery/watercolor.png',
        imageAlt: '水彩スタイルのレンダリング',
        width: 1062,
        height: 582,
        links: [
          { label: '円を描く', href: '/guide/lesson-002' },
          { label: '楕円と矩形', href: '/guide/lesson-009' },
          { label: 'テキストレンダリング', href: '/guide/lesson-015' },
          { label: 'ポストプロセス', href: '/guide/lesson-030' },
        ],
      },
      {
        title: 'ツールとインターフェース',
        text: 'トランスフォーマー、ブラシ、クリップボード。',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: 'ブラシと消しゴム',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: 'トランスフォーマー', href: '/guide/lesson-021' },
          { label: 'ブラシ', href: '/guide/lesson-025' },
          { label: 'クリップボード', href: '/guide/lesson-024' },
        ],
      },
      {
        title: 'モデルと一緒に描く',
        text: '図形を生成し、画像をベクターにし、キャンバスと対話します。',
        image: '/gallery/liquid-metal.png',
        imageAlt: 'リキッドメタルの文字とマテリアル',
        width: 1974,
        height: 990,
        links: [
          { label: 'AI との連携', href: '/guide/lesson-028' },
          { label: 'テキストからダイアグラム', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: 'キャンバス上の効果',
    moreTitle: 'ドキュメントにはほかにも',
    more: [
      { label: 'サンプル (EN)', href: '/example/solar-system', locale: 'en' },
      { label: 'リファレンス (EN)', href: '/reference/canvas', locale: 'en' },
      { label: '実験 (EN)', href: '/experiment/particles', locale: 'en' },
    ],
  },

  'zh-Hant': {
    base: '/zh-Hant',
    locale: 'zh-Hant',
    eyebrow: 'WebGL / WebGPU',
    title: '一個無限畫布教程',
    lede: '從空白畫布開始，用頁面裡可執行的範例，做成接近 Figma 的無限畫布。',
    primary: { label: '開啟應用', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: '從第 1 課開始', href: '/guide/lesson-001' },
    heroAlt: '無限畫布應用，畫板上有圖片和一幅素描',
    tracksTitle: '三條閱讀路線',
    tracks: [
      {
        title: '在 GPU 上作畫',
        text: '用 SDF 與 WebGPU 畫圓、文字、筆畫，並做後處理。',
        image: '/gallery/watercolor.png',
        imageAlt: '水彩風格渲染',
        width: 1062,
        height: 582,
        links: [
          { label: '繪製圓', href: '/guide/lesson-002' },
          { label: '橢圓與矩形', href: '/guide/lesson-009' },
          { label: '文字渲染', href: '/guide/lesson-015' },
          { label: '後處理', href: '/guide/lesson-030' },
        ],
      },
      {
        title: '工具與介面',
        text: 'Transformer、筆刷與剪貼簿。',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: '筆刷和橡皮擦',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: 'Transformer', href: '/guide/lesson-021' },
          { label: '筆刷', href: '/guide/lesson-025' },
          { label: '剪貼簿', href: '/guide/lesson-024' },
        ],
      },
      {
        title: '讓模型參與繪製',
        text: '生成圖形、把圖片變成向量，並和畫布對話。',
        image: '/gallery/liquid-metal.png',
        imageAlt: '液態金屬文字與材質',
        width: 1974,
        height: 990,
        links: [
          { label: '整合 AI', href: '/guide/lesson-028' },
          { label: '文字轉圖表', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: '畫布上的效果',
    moreTitle: '文件裡還有',
    more: [
      { label: '範例 (EN)', href: '/example/solar-system', locale: 'en' },
      { label: '參考 (EN)', href: '/reference/canvas', locale: 'en' },
      { label: '實驗 (EN)', href: '/experiment/particles', locale: 'en' },
    ],
  },
  es: {
    base: '/es',
    locale: 'es',
    eyebrow: 'WebGL / WebGPU',
    title: 'Un tutorial de lienzo infinito',
    lede: 'Empieza con un lienzo en blanco y, con ejemplos que se ejecutan en la página, construye un lienzo infinito parecido a Figma.',
    primary: { label: 'Abrir la app', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: 'Empezar por la lección 1', href: '/guide/lesson-001' },
    heroAlt: 'La app de lienzo infinito, con imágenes y un boceto en el tablero',
    tracksTitle: 'Tres maneras de recorrer las lecciones',
    tracks: [
      {
        title: 'Dibujar en la GPU',
        text: 'Círculos, texto, trazos y posprocesado con SDF y WebGPU.',
        image: '/gallery/watercolor.png',
        imageAlt: 'Renderizado con estilo de acuarela',
        width: 1062,
        height: 582,
        links: [
          { label: 'Dibujar un círculo', href: '/guide/lesson-002' },
          { label: 'Elipse y rectángulo', href: '/guide/lesson-009' },
          { label: 'Renderizado de texto', href: '/guide/lesson-015' },
          { label: 'Posprocesado', href: '/guide/lesson-030' },
        ],
      },
      {
        title: 'Herramientas e interfaz',
        text: 'Transformer, pinceles y portapapeles.',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: 'Pincel y borrador',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: 'Transformer', href: '/guide/lesson-021' },
          { label: 'Pinceles', href: '/guide/lesson-025' },
          { label: 'Portapapeles', href: '/guide/lesson-024' },
        ],
      },
      {
        title: 'Dibujar con un modelo',
        text: 'Genera formas, vectoriza una imagen y habla con el lienzo.',
        image: '/gallery/liquid-metal.png',
        imageAlt: 'Texto y materiales de metal líquido',
        width: 1974,
        height: 990,
        links: [
          { label: 'Integración con IA', href: '/guide/lesson-028' },
          { label: 'De texto a diagrama', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: 'Desde el lienzo',
    moreTitle: 'También en la documentación',
    more: [
      { label: 'Ejemplos (EN)', href: '/example/solar-system', locale: 'en' },
      { label: 'Referencia (EN)', href: '/reference/canvas', locale: 'en' },
      { label: 'Experimentos (EN)', href: '/experiment/particles', locale: 'en' },
    ],
  },
  'pt-BR': {
    base: '/pt-BR',
    locale: 'pt-BR',
    eyebrow: 'WebGL / WebGPU',
    title: 'Um tutorial de tela infinita',
    lede: 'Comece com uma tela em branco e, com exemplos que rodam na página, construa uma tela infinita no estilo do Figma.',
    primary: { label: 'Abrir o app', href: 'https://app.infinitecanvas.cc/' },
    secondary: { label: 'Começar pela lição 1', href: '/guide/lesson-001' },
    heroAlt: 'O app de tela infinita, com imagens e um esboço no quadro',
    tracksTitle: 'Três caminhos pelas lições',
    tracks: [
      {
        title: 'Desenhar na GPU',
        text: 'Círculos, texto, traços e pós-processamento com SDF e WebGPU.',
        image: '/gallery/watercolor.png',
        imageAlt: 'Renderização em estilo aquarela',
        width: 1062,
        height: 582,
        links: [
          { label: 'Desenhar um círculo', href: '/guide/lesson-002' },
          { label: 'Elipse e retângulo', href: '/guide/lesson-009' },
          { label: 'Renderização de texto', href: '/guide/lesson-015' },
          { label: 'Pós-processamento', href: '/guide/lesson-030' },
        ],
      },
      {
        title: 'Ferramentas e interface',
        text: 'Transformer, pincéis e área de transferência.',
        image: '/gallery/brush-with-eraser.png',
        imageAlt: 'Pincel e borracha',
        width: 980,
        height: 454,
        links: [
          { label: 'Web UI', href: '/guide/lesson-007' },
          { label: 'Transformer', href: '/guide/lesson-021' },
          { label: 'Pincéis', href: '/guide/lesson-025' },
          { label: 'Área de transferência', href: '/guide/lesson-024' },
        ],
      },
      {
        title: 'Desenhar com um modelo',
        text: 'Gere formas, vetorize uma imagem e converse com a tela.',
        image: '/gallery/liquid-metal.png',
        imageAlt: 'Texto e materiais de metal líquido',
        width: 1974,
        height: 990,
        links: [
          { label: 'Integração com IA', href: '/guide/lesson-028' },
          { label: 'De texto a diagrama', href: '/guide/lesson-032' },
        ],
      },
    ],
    galleryTitle: 'Da tela',
    moreTitle: 'Também na documentação',
    more: [
      { label: 'Exemplos (EN)', href: '/example/solar-system', locale: 'en' },
      { label: 'Referência (EN)', href: '/reference/canvas', locale: 'en' },
      { label: 'Experimentos (EN)', href: '/experiment/particles', locale: 'en' },
    ],
  },
};

const { lang } = useData();

const page = computed(() => {
  const value = lang.value || '';
  if (value.startsWith('zh-Hant')) return pages['zh-Hant'];
  if (value.startsWith('zh')) return pages.zh;
  if (value.startsWith('ko')) return pages.ko;
  if (value.startsWith('ja')) return pages.ja;
  if (value.startsWith('es')) return pages.es;
  if (value.startsWith('pt')) return pages['pt-BR'];
  return pages.en;
});

const shots = computed(() =>
  gallery.map((item) => ({
    ...item,
    caption: item.alt[page.value.locale],
  })),
);

function hrefOf(link) {
  if (link.href.startsWith('http')) return link.href;
  const base = link.locale === 'en' ? '' : page.value.base;
  return `${base}${link.href}`;
}
</script>

<template>
  <div class="home">
    <div class="home-wrap">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">{{ page.eyebrow }}</p>
          <h1>{{ page.title }}</h1>
          <p class="lede">{{ page.lede }}</p>
          <div class="actions">
            <a class="btn btn-primary" :href="page.primary.href">{{
              page.primary.label
            }}</a>
            <a class="btn btn-secondary" :href="hrefOf(page.secondary)">{{
              page.secondary.label
            }}</a>
          </div>
        </div>
        <div class="stage">
          <img
            src="/app.png"
            :alt="page.heroAlt"
            width="2066"
            height="1706"
            fetchpriority="high"
          />
        </div>
      </section>

      <section class="tracks" :aria-labelledby="'home-tracks-title'">
        <h2 id="home-tracks-title">{{ page.tracksTitle }}</h2>
        <p v-if="page.note" class="note">{{ page.note }}</p>
        <div class="bento">
          <article
            v-for="track in page.tracks"
            :key="track.title"
            class="track"
          >
            <img
              :src="track.image"
              :alt="track.imageAlt"
              :width="track.width"
              :height="track.height"
              loading="lazy"
              decoding="async"
            />
            <div class="track-body">
              <h3>{{ track.title }}</h3>
              <p>{{ track.text }}</p>
              <ul>
                <li v-for="link in track.links" :key="link.href + link.label">
                  <a :href="hrefOf(link)">{{ link.label }}</a>
                </li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section class="gallery" aria-labelledby="home-gallery-title">
        <h2 id="home-gallery-title">{{ page.galleryTitle }}</h2>
        <ul class="film" tabindex="0">
          <li v-for="shot in shots" :key="shot.src">
            <figure>
              <img
                :src="shot.src"
                :alt="shot.caption"
                :width="shot.width"
                :height="shot.height"
                loading="lazy"
                decoding="async"
              />
              <figcaption>{{ shot.caption }}</figcaption>
            </figure>
          </li>
        </ul>
      </section>

      <section
        v-if="page.more.length"
        class="more"
        aria-labelledby="home-more-title"
      >
        <h2 id="home-more-title">{{ page.moreTitle }}</h2>
        <ul class="more-row">
          <li v-for="link in page.more" :key="link.href">
            <a :href="hrefOf(link)">{{ link.label }}</a>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style>
.home {
  padding: 2.5rem 0 4.5rem;
  color: var(--vp-c-text-1);
}

.home-wrap {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 3rem;
  align-items: center;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  max-width: 11em;
  font-size: clamp(2rem, 4vw, 3.25rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.12;
}

.lede {
  margin: 1rem 0 0;
  max-width: 36em;
  color: var(--vp-c-text-2);
  font-size: 1.05rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.15rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 650;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.btn:active {
  transform: scale(0.98);
}

.btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.btn-primary {
  background: #2f3cc9;
  color: #fff;
}

.btn-primary:hover {
  background: #2632b0;
  color: #fff;
}

.btn-secondary {
  border: 1px solid color-mix(in srgb, var(--vp-c-text-1) 42%, transparent);
  background: transparent;
  color: var(--vp-c-text-1);
}

.btn-secondary:hover {
  border-color: var(--vp-c-text-2);
  color: var(--vp-c-text-1);
}

.stage {
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  background-image: linear-gradient(
      to right,
      var(--vp-c-divider) 1px,
      transparent 1px
    ),
    linear-gradient(to bottom, var(--vp-c-divider) 1px, transparent 1px);
  background-size: 28px 28px;
}

.stage img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
}

.tracks,
.gallery,
.more {
  margin-top: 4.75rem;
}

.home h2 {
  margin: 0 0 1.25rem;
  font-size: 1.5rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.note {
  margin: -0.4rem 0 1.25rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.bento {
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr;
  gap: 1rem;
  align-items: stretch;
}

.track {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.track img {
  display: block;
  width: 100%;
  height: 168px;
  object-fit: cover;
  object-position: center 18%;
}

.track-body {
  padding: 1.05rem 1.15rem 1.2rem;
}

.track h3 {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.track p {
  margin: 0.4rem 0 0.85rem;
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
  line-height: 1.5;
}

.track ul,
.more-row,
.film {
  margin: 0;
  padding: 0;
  list-style: none;
}

.track ul {
  margin-top: auto;
}

.track li + li {
  margin-top: 0.35rem;
}

.track a {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  text-decoration: none;
}

.track a:hover {
  text-decoration: underline;
}

.film {
  display: flex;
  gap: 0.9rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 0.4rem;
  scrollbar-width: thin;
}

.film:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 4px;
}

.film li {
  flex: 0 0 260px;
  scroll-snap-align: start;
}

.film figure {
  margin: 0;
}

.film img {
  display: block;
  width: 100%;
  height: 156px;
  object-fit: cover;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.home figcaption {
  margin-top: 0.45rem;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  font-style: normal;
  text-align: left;
}

.more-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
}

.more a {
  color: var(--vp-c-text-1);
  font-weight: 650;
  text-decoration: none;
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 0.15rem;
}

.more a:hover {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

@media (max-width: 860px) {
  .home {
    padding-top: 1.5rem;
  }

  .home-wrap {
    width: min(1120px, calc(100% - 32px));
  }

  .hero {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .hero h1 {
    max-width: none;
  }

  .bento {
    grid-template-columns: 1fr;
  }

  .track img {
    height: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn:active {
    transform: none;
  }
}
</style>
