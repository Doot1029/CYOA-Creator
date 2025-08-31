import React from 'react';
import { Story, StoryNode } from '../types';
import { HomeIcon } from './Icon';

interface StoryMapViewProps {
    story: Story;
    currentNodeId: string;
    pageMap: Map<string, number>;
    onJump: (nodeId: string) => void;
    onClose: () => void;
}

const StoryMapView: React.FC<StoryMapViewProps> = ({ story, currentNodeId, pageMap, onJump, onClose }) => {

    const handleNodeClick = (nodeId: string) => {
        onJump(nodeId);
        onClose();
    };

    const renderNodeTree = (nodeId: string, visited: Set<string>) => {
        if (visited.has(nodeId)) {
            return (
                <div key={`${nodeId}-cycle`} className="ml-8 pl-4 border-l-2 border-dashed border-red-400/50">
                     <p className="text-red-400 italic">
                        (Cycle detected, jumps back to Page {pageMap.get(nodeId) || '?'})
                     </p>
                </div>
            )
        }

        visited.add(nodeId);

        const node = story.nodes[nodeId];
        if (!node) return null;

        const isCurrent = nodeId === currentNodeId;
        const isEnding = story.endNodeIds.includes(nodeId);
        const pageNumber = pageMap.get(nodeId) || 0;
        const snippet = node.dialogue.substring(0, 70) + (node.dialogue.length > 70 ? '...' : '');

        return (
            <div key={nodeId} className="mt-2">
                <div 
                    onClick={() => handleNodeClick(nodeId)}
                    className={`p-3 rounded-md cursor-pointer transition border-l-4 ${isCurrent ? 'bg-purple-800/50 border-purple-300' : 'bg-gray-700/30 hover:bg-gray-600/50 border-gray-600'}`}
                >
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-purple-300">Page {pageNumber}</span>
                        {nodeId === story.startNodeId && <HomeIcon />}
                    </div>
                    <p className="text-sm text-gray-400 italic mt-1">"{snippet}"</p>
                </div>

                <div className="ml-6 pl-4 border-l-2 border-gray-600/70">
                    {node.choices.length > 0 ? (
                        node.choices.map(choice => (
                            <div key={choice.id} className="mt-3">
                                <p className="text-sm text-gray-200 bg-gray-700/50 p-2 rounded-md">
                                    <span className="font-semibold">Choice:</span> {choice.text}
                                </p>
                                {choice.nextNodeId ? (
                                    renderNodeTree(choice.nextNodeId, new Set(visited))
                                ) : (
                                    <p className="text-sm text-yellow-400/80 italic ml-4 mt-1">
                                        (Leads to an unwritten page)
                                    </p>
                                )}
                            </div>
                        ))
                    ) : (
                         <p className={`text-sm italic ml-4 mt-2 ${isEnding ? 'text-green-400 font-semibold' : 'text-gray-500'}`}>
                            {isEnding ? 'This is an ending.' : 'No choices from this page.'}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col m-4 border border-purple-500/50"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold font-title text-purple-300">Story Map</h2>
                    <button 
                        onClick={onClose}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition"
                    >
                        Close
                    </button>
                </header>
                <main className="p-6 overflow-y-auto">
                    {renderNodeTree(story.startNodeId, new Set())}
                </main>
            </div>
        </div>
    );
};

export default StoryMapView;
