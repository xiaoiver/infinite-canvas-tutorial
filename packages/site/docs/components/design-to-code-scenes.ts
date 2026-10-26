import type {
  DesignVariablesMap,
  CodeSemanticElement,
  RectSerializedNode,
  RefSerializedNode,
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
  width: number;
  height: number;
  nodes: SerializedNode[];
  variables: DesignVariablesMap;
  semanticElements: Record<string, CodeSemanticElement>;
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

  function instance(
    id: string,
    parentId: string,
    templateId: string,
    attributes: Partial<RefSerializedNode> = {},
  ) {
    nodes.push({
      id,
      parentId,
      type: 'ref',
      ref: templateId,
      x: 0,
      y: 0,
      zIndex: zIndex++,
      ...attributes,
    } as RefSerializedNode);
  }

  return { nodes, box, label, instance };
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
    width: 1050,
    height: 720,
    nodes,
    variables: dashboardVariables,
    semanticElements: {
      sidebar: { tag: 'aside' },
      navigation: { tag: 'nav' },
      main: { tag: 'main' },
      header: { tag: 'header' },
      heading: { tag: 'h1' },
      'export-button': { tag: 'button' },
      activity: { tag: 'section' },
      footer: { tag: 'footer' },
    },
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
  const { nodes, box, label, instance } = createScene();
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
  // Keep the editable master outside the page artboard. Its three instances
  // share the card layout while overriding copy and accent colors.
  box('plan-card-template', undefined, {
    name: 'PricingPlanCard',
    x: 3000,
    width: 316,
    height: 354,
    padding: 24,
    gap: 14,
    cornerRadius: 17,
    fills: [{ type: 'solid', value: '$color.surface' }],
    reusable: true,
  });
  label(
    'plan-card-name',
    'plan-card-template',
    'Starter',
    '$color.text',
    19,
    700,
  );
  label(
    'plan-card-detail',
    'plan-card-template',
    'For side projects and experiments',
    '$color.muted',
    12,
  );
  box('plan-card-price', 'plan-card-template', {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  });
  label('plan-card-amount', 'plan-card-price', '$0', '$color.text', 35, 700);
  label('plan-card-period', 'plan-card-price', '/ month', '$color.muted', 12);
  box('plan-card-action', 'plan-card-template', {
    width: 268,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    cornerRadius: 9,
    fills: [{ type: 'solid', value: '#34435e' }],
  });
  label(
    'plan-card-action-label',
    'plan-card-action',
    'Start for free',
    '$color.text',
    13,
    700,
  );
  for (const [index, feature] of plans[0].features.entries()) {
    label(
      `plan-card-feature-${index}`,
      'plan-card-template',
      `✓  ${feature}`,
      '$color.muted',
      12,
    );
  }
  for (const plan of plans) {
    const highlighted = plan.id === 'growth';
    instance(`plan-${plan.id}`, 'plans', 'plan-card-template', {
      ...(highlighted
        ? {
            fills: [{ type: 'solid', value: '#273456' }],
            strokes: [{ type: 'solid', value: '$color.highlight' }],
            strokeWidth: 2,
          }
        : {}),
      descendants: {
        'plan-card-name': { content: plan.name },
        'plan-card-detail': { content: plan.detail },
        'plan-card-amount': { content: plan.price },
        'plan-card-action-label': { content: plan.action },
        ...(highlighted
          ? {
              'plan-card-action': {
                fills: [{ type: 'solid', value: '$color.highlight' }],
              },
            }
          : {}),
        ...Object.fromEntries(
          plan.features.map((feature, index) => [
            `plan-card-feature-${index}`,
            { content: `✓  ${feature}` },
          ]),
        ),
      },
    });
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
      'A pricing page with three editable instances of one reusable plan card.',
    descriptionZh: '包含三个可编辑组件实例的产品定价页。',
    componentName: 'PricingPage',
    width: 1050,
    height: 820,
    nodes,
    variables: pricingVariables,
    semanticElements: {
      'pricing-nav': { tag: 'nav' },
      'nav-cta': { tag: 'button' },
      hero: { tag: 'header' },
      'hero-title': { tag: 'h1' },
      plans: { tag: 'section' },
      'plan-card-action': { tag: 'button' },
      'plan-starter__plan-card-action': { tag: 'button' },
      'plan-growth__plan-card-action': { tag: 'button' },
      'plan-scale__plan-card-action': { tag: 'button' },
      'pricing-footer': { tag: 'footer' },
    },
  };
}

const checkoutVariables: DesignVariablesMap = {
  'color.background': { type: 'color', value: '#f4f6fb' },
  'color.surface': { type: 'color', value: '#ffffff' },
  'color.ink': { type: 'color', value: '#19243d' },
  'color.muted': { type: 'color', value: '#68758e' },
  'color.accent': { type: 'color', value: '#455ee6' },
  'color.accent-soft': { type: 'color', value: '#e8edff' },
  'color.line': { type: 'color', value: '#e4e9f2' },
};

function checkout(): InterfaceScene {
  const { nodes, box, label } = createScene();
  box('checkout-screen', undefined, {
    name: 'Northstar mobile checkout',
    width: 390,
    height: 844,
    padding: 24,
    gap: 14,
    fills: [{ type: 'solid', value: '$color.background' }],
  });

  box('checkout-header', 'checkout-screen', {
    width: 342,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  });
  box('checkout-back', 'checkout-header', {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    cornerRadius: 11,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  label('checkout-back-label', 'checkout-back', '←', '$color.ink', 20, 600);
  label('checkout-title', 'checkout-header', 'Checkout', '$color.ink', 20, 700);
  label('checkout-step', 'checkout-header', 'Step 2 of 3', '$color.muted', 11);

  box('checkout-progress', 'checkout-screen', {
    width: 342,
    height: 5,
    cornerRadius: 3,
    fills: [{ type: 'solid', value: '$color.line' }],
  });
  box('checkout-progress-filled', 'checkout-progress', {
    width: 228,
    height: 5,
    cornerRadius: 3,
    fills: [{ type: 'solid', value: '$color.accent' }],
  });

  box('checkout-intro', 'checkout-screen', {
    width: 342,
    height: 54,
    gap: 6,
  });
  label(
    'checkout-heading',
    'checkout-intro',
    'Review your order',
    '$color.ink',
    22,
    700,
  );
  label(
    'checkout-subheading',
    'checkout-intro',
    'A few details before your new bag arrives.',
    '$color.muted',
    11,
  );

  box('checkout-product', 'checkout-screen', {
    width: 342,
    height: 125,
    padding: 14,
    gap: 14,
    flexDirection: 'row',
    alignItems: 'center',
    cornerRadius: 16,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  box('checkout-product-art', 'checkout-product', {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    cornerRadius: 12,
    fills: [{ type: 'solid', value: '$color.accent-soft' }],
  });
  box('checkout-bag-handle', 'checkout-product-art', {
    width: 22,
    height: 8,
    cornerRadius: 5,
    fills: [{ type: 'solid', value: '$color.ink' }],
  });
  box('checkout-bag', 'checkout-product-art', {
    width: 52,
    height: 57,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 8,
    cornerRadius: 12,
    fills: [{ type: 'solid', value: '$color.accent' }],
  });
  box('checkout-bag-pocket', 'checkout-bag', {
    width: 34,
    height: 16,
    cornerRadius: 6,
    fills: [{ type: 'solid', value: '$color.accent-soft' }],
  });
  box('checkout-product-copy', 'checkout-product', {
    width: 196,
    gap: 7,
  });
  label(
    'checkout-product-name',
    'checkout-product-copy',
    'Everyday Backpack',
    '$color.ink',
    15,
    700,
  );
  label(
    'checkout-product-variant',
    'checkout-product-copy',
    'Indigo · One size',
    '$color.muted',
    12,
  );
  label(
    'checkout-product-price',
    'checkout-product-copy',
    '$89.00',
    '$color.ink',
    17,
    700,
  );

  box('checkout-address', 'checkout-screen', {
    width: 342,
    height: 108,
    padding: 16,
    gap: 8,
    cornerRadius: 16,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  box('checkout-address-heading', 'checkout-address', {
    width: 310,
    flexDirection: 'row',
    justifyContent: 'space-between',
  });
  label(
    'checkout-address-title',
    'checkout-address-heading',
    'Shipping address',
    '$color.ink',
    14,
    700,
  );
  label(
    'checkout-address-edit',
    'checkout-address-heading',
    'Edit',
    '$color.accent',
    12,
    600,
  );
  label(
    'checkout-recipient',
    'checkout-address',
    'Maya Chen',
    '$color.ink',
    12,
    600,
  );
  label(
    'checkout-street',
    'checkout-address',
    '280 Market St · San Francisco, CA',
    '$color.muted',
    11,
  );

  box('checkout-delivery', 'checkout-screen', {
    width: 342,
    height: 96,
    padding: 16,
    gap: 9,
    cornerRadius: 16,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  label(
    'checkout-delivery-title',
    'checkout-delivery',
    'Delivery',
    '$color.ink',
    14,
    700,
  );
  box('checkout-delivery-row', 'checkout-delivery', {
    width: 310,
    flexDirection: 'row',
    justifyContent: 'space-between',
  });
  label(
    'checkout-delivery-method',
    'checkout-delivery-row',
    'Standard · 3–5 business days',
    '$color.muted',
    11,
  );
  label(
    'checkout-delivery-price',
    'checkout-delivery-row',
    'FREE',
    '$color.accent',
    11,
    700,
  );

  box('checkout-summary', 'checkout-screen', {
    width: 342,
    height: 138,
    padding: 16,
    gap: 8,
    cornerRadius: 16,
    fills: [{ type: 'solid', value: '$color.surface' }],
  });
  label(
    'checkout-summary-title',
    'checkout-summary',
    'Order summary',
    '$color.ink',
    14,
    700,
  );
  for (const [id, title, value, emphasized] of [
    ['subtotal', 'Subtotal', '$89.00', false],
    ['shipping', 'Shipping', 'Free', false],
    ['total', 'Total', '$89.00', true],
  ] as const) {
    box(`checkout-${id}-row`, 'checkout-summary', {
      width: 310,
      flexDirection: 'row',
      justifyContent: 'space-between',
    });
    label(
      `checkout-${id}-label`,
      `checkout-${id}-row`,
      title,
      emphasized ? '$color.ink' : '$color.muted',
      emphasized ? 13 : 11,
      emphasized ? 700 : 400,
    );
    label(
      `checkout-${id}-value`,
      `checkout-${id}-row`,
      value,
      '$color.ink',
      emphasized ? 13 : 11,
      emphasized ? 700 : 500,
    );
  }

  box('checkout-pay', 'checkout-screen', {
    width: 342,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    cornerRadius: 13,
    fills: [{ type: 'solid', value: '$color.accent' }],
  });
  label(
    'checkout-pay-label',
    'checkout-pay',
    'Pay $89.00  →',
    '$color.surface',
    15,
    700,
  );
  box('checkout-security', 'checkout-screen', {
    width: 342,
    alignItems: 'center',
  });
  label(
    'checkout-security-label',
    'checkout-security',
    'Secure checkout · Payments are encrypted',
    '$color.muted',
    11,
  );

  return {
    id: 'checkout',
    title: 'Mobile checkout',
    titleZh: '移动端结账页',
    description:
      'A mobile commerce checkout with a product card, address, delivery details and order summary.',
    descriptionZh: '包含商品、收货地址、配送方式和订单汇总的移动端结账界面。',
    componentName: 'CheckoutScreen',
    width: 390,
    height: 844,
    nodes,
    variables: checkoutVariables,
    semanticElements: {
      'checkout-screen': { tag: 'main' },
      'checkout-header': { tag: 'header' },
      'checkout-back': { tag: 'button' },
      'checkout-title': { tag: 'h1' },
      'checkout-address': { tag: 'section' },
      'checkout-delivery': { tag: 'section' },
      'checkout-summary': { tag: 'section' },
      'checkout-pay': { tag: 'button' },
    },
  };
}

export const interfaceScenes = [dashboard(), pricing(), checkout()];
