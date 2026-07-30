export const TIPS = [
    {
        icon: 'reader-outline' as const,
        color: '#3B82F6',
        title: 'Read the Full Error Stack',
        body: 'Error structures contain critical target points. Always scan past internal library frames until you identify your local file name and execution line indexes.'
    },
    {
        icon: 'git-branch-outline' as const,
        color: '#10B981',
        title: 'Isolate via Git Status Check',
        body: 'If code broke unexpectedly, check local changes. Temporarily comment out your recent logic delta blocks to test module regression paths.'
    },
    {
        icon: 'refresh-outline' as const,
        color: '#F59E0B',
        title: 'Hard Cache Clears',
        body: 'Stale compilation artifacts cause unexpected behavior. Force bundle resets using clear flags or delete standard local lockfiles.'
    }
];