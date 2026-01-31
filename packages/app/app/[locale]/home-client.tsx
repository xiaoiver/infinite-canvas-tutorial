"use client";

import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import Chat, { MessageType } from '@/components/chat';
import Canvas from '@/components/canvas';
import { nanoid } from 'nanoid';
import { useAuth } from '@/contexts/auth-context';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

const DEFAULT_NODES: SerializedNode[] = [
  {
    id: '1',
    name: 'A swimming dog',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    x: 200,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '2',
    name: 'A swimming cat',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/koala/0RQAsrw5rRX015XQUd4HX.jpg',
    x: 200 + 1200,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '3',
    name: 'A swimming dog without background',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/panda/Xo61xntJdsl8_txn9WC-5.jpg',
    x: 200 + 2400,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '4',
    type: 'text',
    name: 'Enter your desired modifications in Chat.',
    fill: 'black',
    content: 'Enter your desired modifications in Chat.',
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 100,
    version: 0,
  } as const,
  {
    id: '5',
    type: 'text',
    name: 'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    fill: 'black',
    content:
      'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 1300,
    version: 0,
  } as const,
  {
    id: '6',
    type: 'polyline', 
    points:
      '200,1676.46 228.35,1598.48 270.88,1531.14 295.69,1499.24 324.05,1474.43 359.49,1460.25 394.94,1453.16 437.47,1453.16 476.46,1460.25 511.90,1477.97 604.06,1555.95 703.30,1616.20 742.29,1619.75 760.01,1587.85 752.92,1552.40 752.92,1513.42 742.29,1470.88 724.57,1438.98 713.93,1400 682.03,1417.72 565.07,1573.67 504.81,1619.75 430.38,1655.19 355.95,1680 238.98,1683.55 224.81,1648.10 277.97,1594.94 313.42,1591.39 309.87,1626.84 274.43,1633.93 256.71,1602.03',
    stroke: '#147af3',
    strokeWidth: 18,
    version: 0,
  } as const,
  {
    id: '7',
    type: 'rect',
    name: 'A dog with a hand-drawn fish',
    fill: 'https://v3.fal.media/files/penguin/9UH5Fgin7zc1u6NGGItGB.jpeg',
    x: 1400,
    y: 1400,
    width: 1408,
    height: 736,
    version: 0,
  } as const,
  {
    id: '8',
    type: 'polyline',
    points: '1100,1400 1215.69,1461.46 1324.16,1537.39',
    stroke: '#147af3',
    strokeWidth: 18,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    markerEnd: 'line',
    version: 0,
  },
  {
    id: '9',
    type: 'text',
    name: 'Smart inpainting & outpainting are on the way.',
    fill: 'black',
    content:
      "Smart inpainting & outpainting are on the way.\nYou can easily select the tennis ball in dog's mouth and replace it with a golf ball.\nAlternatively, you can resize the image by dragging it and add more content inside.",
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 2300,
    version: 0,
  } as const,
];

const DEFAULT_MESSAGES: MessageType[] = [
  {
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content: "Can you explain how to use React hooks effectively?",
      },
    ],
  },
  {
    key: nanoid(),
    from: "assistant",
    sources: [
      {
        href: "https://react.dev/reference/react",
        title: "React Documentation",
      },
      {
        href: "https://react.dev/reference/react-dom",
        title: "React DOM Documentation",
      },
    ],
    tools: [
      {
        name: "mcp",
        description: "Searching React documentation",
        status: "input-available",
        parameters: {
          query: "React hooks best practices",
          source: "react.dev",
        },
        result: `{
  "query": "React hooks best practices",
  "results": [
    {
      "title": "Rules of Hooks",
      "url": "https://react.dev/warnings/invalid-hook-call-warning",
      "snippet": "Hooks must be called at the top level of your React function components or custom hooks. Don't call hooks inside loops, conditions, or nested functions."
    },
    {
      "title": "useState Hook",
      "url": "https://react.dev/reference/react/useState",
      "snippet": "useState is a React Hook that lets you add state to your function components. It returns an array with two values: the current state and a function to update it."
    },
    {
      "title": "useEffect Hook",
      "url": "https://react.dev/reference/react/useEffect",
      "snippet": "useEffect lets you synchronize a component with external systems. It runs after render and can be used to perform side effects like data fetching."
    }
  ]
}`,
        error: undefined,
      },
    ],
    versions: [
      {
        id: nanoid(),
        content: `# React Hooks Best Practices

React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some tips for using them effectively:

## Rules of Hooks

1. **Only call hooks at the top level** of your component or custom hooks
2. **Don't call hooks inside loops, conditions, or nested functions**

## Common Hooks

- **useState**: For local component state
- **useEffect**: For side effects like data fetching
- **useContext**: For consuming context
- **useReducer**: For complex state logic
- **useCallback**: For memoizing functions
- **useMemo**: For memoizing values

## Example of useState and useEffect

\`\`\`jsx
function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // This runs after render and when userId changes
    fetchUser(userId).then(userData => {
      setUser(userData);
    });
  }, [userId]);

  return user ? <Profile user={user} /> : <Loading />;
}
\`\`\`

Would you like me to explain any specific hook in more detail?`,
      },
    ],
  },
  {
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content:
          "Yes, could you explain useCallback and useMemo in more detail? When should I use one over the other?",
      },
      {
        id: nanoid(),
        content:
          "I'm particularly interested in understanding the performance implications of useCallback and useMemo. Could you break down when each is most appropriate?",
      },
      {
        id: nanoid(),
        content:
          "Thanks for the overview! Could you dive deeper into the specific use cases where useCallback and useMemo make the biggest difference in React applications?",
      },
    ],
  },
  {
    key: nanoid(),
    from: "assistant",
    reasoning: {
      content: `The user is asking for a detailed explanation of useCallback and useMemo. I should provide a clear and concise explanation of each hook's purpose and how they differ.

The useCallback hook is used to memoize functions to prevent unnecessary re-renders of child components that receive functions as props.

The useMemo hook is used to memoize values to avoid expensive recalculations on every render.

Both hooks help with performance optimization, but they serve different purposes.`,
      duration: 10,
    },
    versions: [
      {
        id: nanoid(),
        content: `## useCallback vs useMemo

Both hooks help with performance optimization, but they serve different purposes:

### useCallback

\`useCallback\` memoizes **functions** to prevent unnecessary re-renders of child components that receive functions as props.

\`\`\`jsx
// Without useCallback - a new function is created on every render
const handleClick = () => {
  console.log(count);
};

// With useCallback - the function is only recreated when dependencies change
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);
\`\`\`

### useMemo

\`useMemo\` memoizes **values** to avoid expensive recalculations on every render.

\`\`\`jsx
// Without useMemo - expensive calculation runs on every render
const sortedList = expensiveSort(items);

// With useMemo - calculation only runs when items change
const sortedList = useMemo(() => expensiveSort(items), [items]);
\`\`\`

### When to use which?

- Use **useCallback** when:
  - Passing callbacks to optimized child components that rely on reference equality
  - Working with event handlers that you pass to child components

- Use **useMemo** when:
  - You have computationally expensive calculations
  - You want to avoid recreating objects that are used as dependencies for other hooks

### Performance Note

Don't overuse these hooks! They come with their own overhead. Only use them when you have identified a genuine performance issue.`,
      },
    ],
  },
];

export default function HomeClient() {
  const { user, loading } = useAuth();
  const authT = useTranslations('auth');
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden">
      <div className="flex-1 h-full">
        <Canvas initialData={DEFAULT_NODES}/>
      </div>
      <div className="w-[400px] h-full relative">
        <Chat initialMessages={DEFAULT_MESSAGES} />
        {!loading && !user && (
          <div className="absolute inset-0 bg-background/10 backdrop-blur-xs flex items-center justify-center z-50">
            <div className="bg-card border rounded-lg p-6 max-w-sm mx-4 text-center shadow-lg">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {authT('loginRequired')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {authT('loginToUseChat')}
              </p>
              <Button onClick={handleLogin} className="w-full">
                {authT('login')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}