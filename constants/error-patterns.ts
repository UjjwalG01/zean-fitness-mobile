import { ErrorPattern } from '@/types/error';

export const GENERIC_ERROR: ErrorPattern = {
    id: 'generic',
    patterns: [],
    type: 'Unknown System Error',
    language: 'Generic',
    title: 'Standard Debugging Roadmap',
    explanation: 'The entered exception signature does not match our current signature indices. This usually points to environmental configuration drift or deeply nested native runtime exceptions.',
    steps: [
        'Isolate the module line trace by checking your terminal debugger logs.',
        'Clear cache frames using native watch commands or clean package installations.',
        'Inspect package properties to ensure library versions match environmental parameters.'
    ],
    codeExample: '// Standard clear cache command sequence:\nnpx expo start --clear\ncd android && ./gradlew clean'
};

export const ERROR_PATTERNS: ErrorPattern[] = [
    {
        id: 'null-ref',
        patterns: ['cannot read property', 'undefined is not an object', 'null is not an object'],
        type: 'TypeError',
        language: 'JavaScript/TypeScript',
        title: 'Null or Undefined Object Reference',
        explanation: 'Your codebase is attempting to evaluate properties or execute methods on an item that resolves to null or undefined at runtime.',
        steps: [
            'Verify that data hooks or API calls have completed their resolution cycles before reading properties.',
            'Utilize optional chaining operators (?.) to safely guard deep object paths.',
            'Provide fallback defaults using standard logical OR (||) or nullish coalescing (??) structures.'
        ],
        codeExample: '// ❌ Problematic:\nconst name = user.profile.name;\n\n// ✨ Fixed implementation:\nconst name = user?.profile?.name || "Guest";'
    },
    {
        id: 'navigation-container',
        patterns: ['couldn\'t register the navigator', 'wrapped your app with \'navigationcontainer\''],
        type: 'NavigationError',
        language: 'React Navigation',
        title: 'Missing Root Navigation Container',
        explanation: 'A child routing tree stack or tab cluster has initialized without being correctly wrapped within a master root NavigationContainer context framework.',
        steps: [
            'Ensure that your application root entry layout mounts the core container component.',
            'Verify that context frames do not mount duplicate container segments across standard entry hooks.'
        ],
        codeExample: 'import { NavigationContainer } from \'@react-navigation/native\';\n\nexport default function App() {\n  return (\n    <NavigationContainer>\n      <MainNavigator />\n    </NavigationContainer>\n  );\n}'
    },
    {
        id: 'infinite-loop',
        patterns: ['too many re-renders', 'maximum update depth exceeded'],
        type: 'RenderError',
        language: 'React Core',
        title: 'Infinite Re-render Loop Detected',
        explanation: 'A component is updating its state inside the main render body instead of an event handler or `useEffect` block. This forces an immediate re-render, creating an infinite loop.',
        steps: [
            'Check your JSX components for functions that execute instantly on render (e.g., onPress={doSomething()}).',
            'Wrap immediate functional calls in arrow functions so they only trigger on user interaction.',
            'Ensure your `useEffect` dependency arrays aren\'t tracking variables that change on every render cycle.'
        ],
        codeExample: '// ❌ Problematic (Executes immediately):\n<TouchableOpacity onPress={setValue(true)} />\n\n// ✨ Fixed implementation:\n<TouchableOpacity onPress={() => setValue(true)} />'
    },
    {
        id: 'network-failed',
        patterns: ['network request failed', 'axioserror', 'fetch failed', 'network error'],
        type: 'NetworkError',
        language: 'Network API',
        title: 'Network Request Failed Connection',
        explanation: 'Your application failed to establish a secure handshake with the backend API service. This typically happens on local machines when testing against `localhost` instead of a real machine IP address.',
        steps: [
            'If testing on a physical Android device or emulator, replace `localhost` or `127.0.0.1` with your computer\'s actual local network IP address (e.g., `192.168.X.X`).',
            'Verify that your backend endpoint server is active and listening on the designated port.',
            'Check the terminal logs to make sure the endpoint uses `https` or that cleartext HTTP traffic is explicitly enabled in your app configuration.'
        ],
        codeExample: '// ❌ Fails on Android Emulators:\nconst URL = "http://localhost:5000/api";\n\n// ✨ Fixed implementation (Use your machine IP):\nconst URL = "http://192.168.1.45:5000/api";'
    }
];