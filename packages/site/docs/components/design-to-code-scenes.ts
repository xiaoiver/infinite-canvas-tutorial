import type {
  DesignVariablesMap,
  RectSerializedNode,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';

export interface InterfaceScene {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  componentName: string;
  nodes: SerializedNode[];
  variables: DesignVariablesMap;
}

function createScene() {
  const nodes: SerializedNode[] = [];
  let zIndex = 0;

  function box(
    id: string,
    parentId: string | undefined,
    attributes: Partial<RectSerializedNode> = {},
  ) {
    nodes.push({
      id,
      parentId,
      type: 'rect',
      x: 0,
      y: 0,
      zIndex: zIndex++,
      display: 'flex',
      flexDirection: 'column',
      ...attributes,
    } as RectSerializedNode);
    return id;
  }

  function label(
    id: string,
    parentId: string,
    content: string,
    color: string,
    fontSize = 14,
    fontWeight = 400,
  ) {
    nodes.push({
      id,
      parentId,
      type: 'text',
      x: 0,
      y: 0,
      zIndex: zIndex++,
      content,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize,
      fontWeight,
      fills: [{ type: 'solid', value: color }],
    } as TextSerializedNode);
  }

  return { nodes, box, label };
}

const dashboardVariables: DesignVariablesMap = {
  'color.canvas': { type: 'color', value: '#f4f6fb' },
  'color.surface': { type: 'color', value: '#ffffff' },
  'color.ink': { type: 'color', value: '#17213b' },
  'color.muted': { type: 'color', value: '#68758e' },
  'color.accent': { type: 'color', value: '#4f5ee9' },
  'color.accent-soft': { type: 'color', value: '#eef0ff' },
};

function dashboard(): InterfaceScene {
  const { nodes, box, label } = createScene();
  box('dashboard', undefined, {
    name: 'Northstar analytics dashboard',
    width: 1050,
    height: 720,
    flexDirection: 'row',
    fills: [{ type: 'solid', value: '$color.canvas' }],
  });
  box('sidebar', 'dashboard', {
    width: 222,
    height: 720,
    padding: 24,
    gap: 30,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  label('brand', 'sidebar', '◈  Northstar', '$color.ink', 21, 700);
  box('navigation', 'sidebar', { gap: 8 });
  for (const [id, title, active] of [
    ['overview', '▦   Overview', true],
    ['audience', '◉   Audience', false],
    ['campaigns', '✧   Campaigns', false],
    ['reports', '▤   Reports', false],
  ] as const) {
    box(`nav-${id}`, 'navigation', {
      width: 174,
      height: 42,
      padding: [12, 14],
      justifyContent: 'center',
      cornerRadius: 10,
      fills: active ? [{ type: 'solid', value: '$color.accent-soft' }] : [],
    });
    label(
      `nav-${id}-label`,
      `nav-${id}`,
      title,
      active ? '$color.accent' : '$color.muted',
      14,
      active ? 700 : 500,
    );
  }
  box('workspace-switcher', 'sidebar', {
    width: 174,
    height: 62,
    padding: 12,
    gap: 4,
    cornerRadius: 12,
    fills: [{ type: 'solid', value: '$color.canvas' }],
  });
  label(
    'workspace-title',
    'workspace-switcher',
    'ACME workspace',
    '$color.ink',
    13,
    700,
  );
  label(
    'workspace-plan',
    'workspace-switcher',
    'Pro plan · 8 members',
    '$color.muted',
    11,
  );

  box('main', 'dashboard', { width: 828, padding: 30, gap: 24 });
  box('header', 'main', {
    width: 768,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  });
  box('header-copy', 'header', { gap: 6 });
  label('heading', 'header-copy', 'Overview', '$color.ink', 29, 700);
  label(
    'subheading',
    'header-copy',
    'Your business at a glance · July 2026',
    '$color.muted',
    13,
  );
  box('export-button', 'header', {
    width: 142,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    cornerRadius: 9,
    fills: [{ type: 'solid', value: '$color.accent' }],
  });
  label(
    'export-label',
    'export-button',
    'Export report ↗',
    '$color.surface',
    13,
    600,
  );

  box('metrics', 'main', { width: 768, flexDirection: 'row', gap: 15 });
  for (const [id, title, value, trend] of [
    ['revenue', 'Total revenue', '$48,295', '↗  12.8% from last month'],
    ['orders', 'Orders', '1,248', '↗  8.2% from last month'],
    ['conversion', 'Conversion', '4.76%', '↗  1.4% from last month'],
  ]) {
    box(`metric-${id}`, 'metrics', {
      width: 246,
      height: 126,
      padding: 18,
      gap: 10,
      cornerRadius: 15,
      fills: [{ type: 'solid', value: '$color.surface' }],
    });
    label(`metric-${id}-name`, `metric-${id}`, title, '$color.muted', 12, 500);
    label(`metric-${id}-value`, `metric-${id}`, value, '$color.ink', 27, 700);
    label(`metric-${id}-trend`, `metric-${id}`, trend, '#169a72', 11, 600);
  }

  box('insights', 'main', { width: 768, flexDirection: 'row', gap: 16 });
  box('revenue-chart', 'insights', {
    width: 492,
    height: 308,
    padding: 24,
    gap: 18,
    cornerRadius: 15,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  label(
    'chart-heading',
    'revenue-chart',
    'Revenue over time',
    '$color.ink',
    17,
    700,
  );
  label(
    'chart-subheading',
    'revenue-chart',
    'Daily revenue for the past week',
    '$color.muted',
    12,
  );
  box('chart-bars', 'revenue-chart', {
    width: 444,
    height: 190,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  });
  for (const [index, height] of [84, 132, 109, 156, 122, 174, 145].entries()) {
    box(`bar-${index}`, 'chart-bars', {
      width: 49,
      height,
      cornerRadius: 7,
      fills: [
        {
          type: 'solid',
          value: index === 5 ? '$color.accent' : '$color.accent-soft',
        },
      ],
    });
  }
  box('chart-days', 'revenue-chart', {
    width: 444,
    flexDirection: 'row',
    justifyContent: 'space-between',
  });
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    label(`day-${day}`, 'chart-days', day, '$color.muted', 11);
  }
  box('activity', 'insights', {
    width: 260,
    height: 308,
    padding: 22,
    gap: 19,
    cornerRadius: 15,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  label(
    'activity-heading',
    'activity',
    'Recent activity',
    '$color.ink',
    17,
    700,
  );
  for (const [id, title, detail] of [
    ['a', 'New order #4829', 'Today · $249.00'],
    ['b', 'Campaign launched', 'Yesterday · Summer sale'],
    ['c', 'Team member joined', 'Yesterday · Alex Chen'],
  ]) {
    box(`activity-${id}`, 'activity', { gap: 6 });
    label(
      `activity-${id}-title`,
      `activity-${id}`,
      title,
      '$color.ink',
      13,
      600,
    );
    label(
      `activity-${id}-detail`,
      `activity-${id}`,
      detail,
      '$color.muted',
      11,
    );
  }
  box('footer', 'main', {
    width: 768,
    flexDirection: 'row',
    justifyContent: 'space-between',
  });
  label(
    'footer-left',
    'footer',
    'Data refreshed 5 minutes ago',
    '$color.muted',
    11,
  );
  label(
    'footer-right',
    'footer',
    'View all reports →',
    '$color.accent',
    11,
    600,
  );

  return {
    id: 'dashboard',
    title: 'Analytics dashboard',
    titleZh: '运营数据面板',
    description:
      'A SaaS workspace with navigation, KPIs, a revenue chart and recent activity.',
    descriptionZh: '包含导航、关键指标、营收图表和最近动态的 SaaS 工作台。',
    componentName: 'AnalyticsDashboard',
    nodes,
    variables: dashboardVariables,
  };
}

const pricingVariables: DesignVariablesMap = {
  'color.background': { type: 'color', value: '#101a30' },
  'color.surface': { type: 'color', value: '#1c2943' },
  'color.highlight': { type: 'color', value: '#7969f5' },
  'color.text': { type: 'color', value: '#f7f8fc' },
  'color.muted': { type: 'color', value: '#b3bfd3' },
};

function pricing(): InterfaceScene {
  const { nodes, box, label } = createScene();
  box('pricing-page', undefined, {
    name: 'Orbit pricing page',
    width: 1050,
    height: 820,
    padding: 32,
    gap: 60,
    fills: [{ type: 'solid', value: '$color.background' }],
  });
  box('pricing-nav', 'pricing-page', {
    width: 986,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  });
  label('pricing-brand', 'pricing-nav', '◉  orbit', '$color.text', 24, 700);
  box('pricing-links', 'pricing-nav', {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  });
  label('link-product', 'pricing-links', 'Product', '$color.muted', 13, 500);
  label('link-pricing', 'pricing-links', 'Pricing', '$color.text', 13, 600);
  label(
    'link-resources',
    'pricing-links',
    'Resources',
    '$color.muted',
    13,
    500,
  );
  box('nav-cta', 'pricing-links', {
    width: 116,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
    cornerRadius: 9,
    fills: [{ type: 'solid', value: '$color.highlight' }],
  });
  label('nav-cta-label', 'nav-cta', 'Get started', '$color.text', 12, 700);

  box('hero', 'pricing-page', { width: 986, gap: 14, alignItems: 'center' });
  label(
    'hero-eyebrow',
    'hero',
    'SIMPLE, TRANSPARENT PRICING',
    '#a99efe',
    12,
    700,
  );
  label(
    'hero-title',
    'hero',
    'A plan for every ambition',
    '$color.text',
    38,
    700,
  );
  label(
    'hero-description',
    'hero',
    'Start free, then scale your team at your own pace.',
    '$color.muted',
    15,
  );

  box('plans', 'pricing-page', { width: 986, flexDirection: 'row', gap: 18 });
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$0',
      detail: 'For side projects and experiments',
      features: ['1 workspace', 'Up to 3 teammates', 'Basic analytics'],
      action: 'Start for free',
    },
    {
      id: 'growth',
      name: 'Growth',
      price: '$29',
      detail: 'For teams ready to move faster',
      features: [
        'Unlimited workspaces',
        'Up to 20 teammates',
        'Advanced analytics',
      ],
      action: 'Choose Growth',
    },
    {
      id: 'scale',
      name: 'Scale',
      price: '$79',
      detail: 'For established organizations',
      features: [
        'Everything in Growth',
        'Unlimited teammates',
        'Priority support',
      ],
      action: 'Talk to sales',
    },
  ];
  for (const plan of plans) {
    const highlighted = plan.id === 'growth';
    box(`plan-${plan.id}`, 'plans', {
      width: 316,
      height: 354,
      padding: 24,
      gap: 14,
      cornerRadius: 17,
      fills: [
        { type: 'solid', value: highlighted ? '#273456' : '$color.surface' },
      ],
      strokes: highlighted
        ? [{ type: 'solid', value: '$color.highlight' }]
        : [],
      strokeWidth: highlighted ? 2 : 0,
    });
    label(
      `plan-${plan.id}-name`,
      `plan-${plan.id}`,
      plan.name,
      '$color.text',
      19,
      700,
    );
    label(
      `plan-${plan.id}-detail`,
      `plan-${plan.id}`,
      plan.detail,
      '$color.muted',
      12,
    );
    box(`plan-${plan.id}-price`, `plan-${plan.id}`, {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    });
    label(
      `plan-${plan.id}-amount`,
      `plan-${plan.id}-price`,
      plan.price,
      '$color.text',
      35,
      700,
    );
    label(
      `plan-${plan.id}-period`,
      `plan-${plan.id}-price`,
      '/ month',
      '$color.muted',
      12,
    );
    box(`plan-${plan.id}-action`, `plan-${plan.id}`, {
      width: 268,
      height: 43,
      alignItems: 'center',
      justifyContent: 'center',
      cornerRadius: 9,
      fills: [
        { type: 'solid', value: highlighted ? '$color.highlight' : '#34435e' },
      ],
    });
    label(
      `plan-${plan.id}-action-label`,
      `plan-${plan.id}-action`,
      plan.action,
      '$color.text',
      13,
      700,
    );
    for (const [index, feature] of plan.features.entries()) {
      label(
        `plan-${plan.id}-feature-${index}`,
        `plan-${plan.id}`,
        `✓  ${feature}`,
        '$color.muted',
        12,
      );
    }
  }
  box('pricing-footer', 'pricing-page', { width: 986, alignItems: 'center' });
  label(
    'pricing-footer-label',
    'pricing-footer',
    'All plans include secure hosting and a 14-day trial of premium features.',
    '$color.muted',
    12,
  );

  return {
    id: 'pricing',
    title: 'Pricing page',
    titleZh: '订阅定价页',
    description:
      'A product pricing page with navigation, a hero and three plan cards.',
    descriptionZh: '包含导航、主视觉和三种订阅方案卡片的产品定价页。',
    componentName: 'PricingPage',
    nodes,
    variables: pricingVariables,
  };
}

export const interfaceScenes = [dashboard(), pricing()];
