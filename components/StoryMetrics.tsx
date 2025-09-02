import React from 'react';
import { InfoIcon } from './Icon';

interface StoryMetricsProps {
    endingConditions: {
        good: number;
        bad: number;
        mixed: number;
    };
}

const StoryMetrics: React.FC<StoryMetricsProps> = ({ endingConditions }) => {
    const { good, bad, mixed } = endingConditions;

    const calculateEstimates = () => {
        // Use a simple average depth for estimation.
        const averageDepth = Math.round((good + bad + mixed) / 3);
        const branchingFactor = 3; // Default choices per page as per user request.

        if (averageDepth < 1) {
            return { pages: 1, choices: 0, endings: 1 };
        }

        const endings = Math.pow(branchingFactor, averageDepth);
        // Sum of geometric series for total nodes in a full tree
        const pages = (Math.pow(branchingFactor, averageDepth + 1) - 1) / (branchingFactor - 1);
        const nonEndingPages = pages - endings;
        const choices = nonEndingPages * branchingFactor;

        return {
            pages: Math.round(pages),
            choices: Math.round(choices),
            endings: Math.round(endings),
        };
    };

    const estimates = calculateEstimates();

    return (
        <div className="bg-gray-900/50 p-4 rounded-md border border-purple-500/20 mt-4">
            <h4 className="text-lg font-bold font-title text-purple-300 mb-2 text-center">Estimated Story Size</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-2xl font-bold text-white">{estimates.pages}</p>
                    <p className="text-sm text-gray-400">Pages</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-white">{estimates.choices}</p>
                    <p className="text-sm text-gray-400">Choices</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-white">{estimates.endings}</p>
                    <p className="text-sm text-gray-400">Endings</p>
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center flex items-center justify-center gap-1">
                <InfoIcon className="h-4 w-4 flex-shrink-0" />
                <span>This is an estimate. Actual numbers will vary as you add/remove choices.</span>
            </p>
        </div>
    );
};

export default StoryMetrics;
