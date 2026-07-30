import { useState } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { analyzeError } from '@/utils/error-analyzer';
import { ErrorPattern } from '@/types/error';
import * as Clipboard from 'expo-clipboard';

export const useFixScreenState = () => {
    const { theme } = useTheme();
    const [errorInput, setErrorInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [solution, setSolution] = useState<ErrorPattern | null>(null);
    const [copied, setCopied] = useState(false);
    const [stepsExpanded, setStepsExpanded] = useState(false);

    return {
        theme, errorInput, setErrorInput, isLoading, setIsLoading,
        solution, setSolution, copied, setCopied, stepsExpanded, setStepsExpanded
    };
};

export const fixScreenHandlers = {
    handleSubmit: (state: ReturnType<typeof useFixScreenState>) => {
        if (!state.errorInput.trim()) return;
        state.setIsLoading(true);
        state.setSolution(null);
        setTimeout(() => {
            state.setSolution(analyzeError(state.errorInput));
            state.setIsLoading(false);
            state.setStepsExpanded(false);
        }, 800);
    },
    handleCopy: (state: ReturnType<typeof useFixScreenState>, text: string) => {
        Clipboard.setStringAsync(text).then(() => {
            state.setCopied(true);
            setTimeout(() => state.setCopied(false), 2000);
        });
    },
    handleClear: (state: ReturnType<typeof useFixScreenState>) => {
        state.setErrorInput('');
        state.setSolution(null);
        state.setCopied(false);
    }
};