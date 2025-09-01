import React, { useState, useEffect, useMemo } from 'react';
import { Story, StoryNode, Choice, ChoicePrediction } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { generateImage, editStoryNodeDialogue } from '../services/geminiService';
import { EditIcon, TrashIcon, PlusIcon, BookIcon, UploadIcon, CopyIcon, CheckIcon, DownloadIcon, WandIcon, MapIcon, BrainIcon, ThumbsUpIcon, ThumbsDownIcon, FlagIcon, InfoIcon, RefreshIcon, ArrowLeftIcon, HomeIcon } from './Icon';

interface GameScreenProps {
    story: Story;
    setStory: React.Dispatch<React.SetStateAction<Story | null>>;
    currentNodeId: string;
    pageMap: Map<string, number>;
    onNavigate: (choice: Choice, fromNodeId: string) => void;
    onChoiceJump: (choice: Choice, fromNodeId: string) => void;
    onJump: (nodeId: string) => void;
    onExport: () => void;
    onGenerateEnding: (fromNodeId: string) => void;
    onMarkAsEnding: (nodeId: string) => void;
    onShowMap: () => void;
    showPredictions: boolean;
    onTogglePredictions: () => void;
    onRegenerateNode: (choice: Choice, fromNodeId: string) => void;
    onRegenerateChoices: (nodeId: string) => void;
    onRequestDeleteNode: (nodeId: string) => void;
    loading: boolean;
    isGeneratingEnding: boolean;
}

type AiEditStatus = 'idle' | 'loading' | 'hasSuggestion';
type DiffStats = { added: number; removed: number };

const GameScreen: React.FC<GameScreenProps> = ({ 
    story, setStory, currentNodeId, pageMap, 
    onNavigate, onJump, onChoiceJump, onExport, 
    onGenerateEnding, onMarkAsEnding, onShowMap, 
    showPredictions, onTogglePredictions, 
    onRegenerateNode, onRegenerateChoices, onRequestDeleteNode,
    loading, isGeneratingEnding 
}) => {
    const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
    const [illustrationLoading, setIllustrationLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingDialogue, setEditingDialogue] = useState<string>('');
    const [infoTooltipId, setInfoTooltipId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('Content & AI');

    // AI Edit State
    const [aiEditPrompt, setAiEditPrompt] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
    const [aiEditStatus, setAiEditStatus] = useState<AiEditStatus>('idle');
    const [diffStats, setDiffStats] = useState<DiffStats>({ added: 0, removed: 0 });

    useEffect(() => {
        const node = story.nodes[currentNodeId];
        setCurrentNode(node);
        setInfoTooltipId(null);
        if (node) {
            setEditingDialogue(node.dialogue);
        }
        // Reset editing mode and AI state on page change
        setIsEditing(false);
        setAiEditStatus('idle');
        setAiSuggestions([]);
        setAiEditPrompt('');
    }, [currentNodeId, story]);

    const jumpOptions = useMemo(() => {
        return Array.from(pageMap.entries())
            .map(([id, pageNumber]) => {
                const node = story.nodes[id];
                const firstLine = node.dialogue.split('\n')[0] || '[Empty Scene]';
                const snippet = firstLine.substring(0, 25) + (firstLine.length > 25 ? '...' : '');
                return { id, pageNumber, label: `Page ${pageNumber}: "${snippet}"` };
            })
            .sort((a, b) => a.pageNumber - b.pageNumber);
    }, [story.nodes, pageMap]);

    const calculateDiffStats = (original: string, suggested: string): DiffStats => {
        const originalArr = original.split(/\s+/).filter(Boolean);
        const suggestedArr = suggested.split(/\s+/).filter(Boolean);

        const originalMap = new Map<string, number>();
        originalArr.forEach(w => originalMap.set(w, (originalMap.get(w) || 0) + 1));
        
        const suggestedMap = new Map<string, number>();
        suggestedArr.forEach(w => suggestedMap.set(w, (suggestedMap.get(w) || 0) + 1));

        let added = 0;
        let removed = 0;
        const allWords = new Set([...originalArr, ...suggestedArr]);

        allWords.forEach(word => {
            const oldCount = originalMap.get(word) || 0;
            const newCount = suggestedMap.get(word) || 0;
            const diff = newCount - oldCount;
            if (diff > 0) {
                added += diff;
            } else if (diff < 0) {
                removed += Math.abs(diff);
            }
        });

        return { added, removed };
    };

    useEffect(() => {
        if (aiEditStatus === 'hasSuggestion' && currentNode) {
            setDiffStats(calculateDiffStats(currentNode.dialogue, aiSuggestions[currentSuggestionIndex]));
        }
    }, [aiEditStatus, currentSuggestionIndex, aiSuggestions, currentNode]);

    const handleChoiceClick = (choice: Choice) => {
        if (choice.nextNodeId) {
            onChoiceJump(choice, currentNodeId);
        } else {
            onNavigate(choice, currentNodeId);
        }
    };
    
    const handleGenerateIllustration = async () => {
        if (!currentNode) return;
        setIllustrationLoading(true);
        const sceneText = currentNode.dialogue;
        const illustrationPrompt = `A cinematic digital painting of the following scene: "${sceneText}". Style: detailed, atmospheric, visual novel illustration.`;
        try {
            const imageUrl = await generateImage(illustrationPrompt, '16:9');
            setStory(prev => {
                if (!prev) return null;
                const newNodes = { ...prev.nodes };
                newNodes[currentNodeId].illustrationUrl = imageUrl;
                return { ...prev, nodes: newNodes };
            });
        } catch (error) {
            console.error(error);
            alert("Failed to generate illustration.");
        } finally {
            setIllustrationLoading(false);
        }
    };

    const handleUploadIllustration = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && currentNode) {
            setIllustrationLoading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                const imageUrl = reader.result as string;
                setStory(prev => {
                    if (!prev) return null;
                    const newNodes = { ...prev.nodes };
                    newNodes[currentNodeId].illustrationUrl = imageUrl;
                    return { ...prev, nodes: newNodes };
                });
                setIllustrationLoading(false);
            };
            reader.onerror = () => {
                console.error("Failed to read file");
                alert("Failed to read file.");
                setIllustrationLoading(false);
            }
            reader.readAsDataURL(file);
        }
    };
    
    const handleRemoveIllustration = () => {
        if (window.confirm("Are you sure you want to remove this illustration?")) {
            setStory(prev => {
                if (!prev) return null;
                const newNodes = { ...prev.nodes };
                delete newNodes[currentNodeId].illustrationUrl;
                return { ...prev, nodes: newNodes };
            });
        }
    };

    const handleCopyIllustrationPrompt = () => {
        if (!currentNode) return;
        const sceneText = currentNode.dialogue;
        const illustrationPrompt = `A cinematic digital painting of the following scene: "${sceneText}". Style: detailed, atmospheric, visual novel illustration.`;
        navigator.clipboard.writeText(illustrationPrompt).then(() => {
            alert("Illustration prompt copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy prompt.');
        });
    };

    const handleAddChoice = () => {
        const newChoiceText = prompt("Enter text for the new choice:");
        if (newChoiceText && currentNode) {
            const newChoice: Choice = {
                id: `choice_manual_${Date.now()}`,
                text: newChoiceText,
                nextNodeId: null,
                isChosen: false,
                prediction: 'none',
                predictionRationale: 'This choice was added manually.'
            };
            setStory(prev => {
                if (!prev) return null;
                const newNodes = { ...prev.nodes };
                newNodes[currentNodeId].choices.push(newChoice);
                return { ...prev, nodes: newNodes };
            });
        }
    };
    
    const handleRemoveChoice = (choiceId: string) => {
        if (currentNode && window.confirm("Are you sure you want to delete this choice?")) {
            setStory(prev => {
                if (!prev) return null;
                const newNodes = { ...prev.nodes };
                newNodes[currentNodeId].choices = newNodes[currentNodeId].choices.filter(c => c.id !== choiceId);
                return { ...prev, nodes: newNodes };
            });
        }
    };
    
    const handleSaveDialogueEdit = () => {
        setStory(prev => {
            if (!prev) return null;
            const newNodes = { ...prev.nodes };
            newNodes[currentNodeId].dialogue = editingDialogue;
            return { ...prev, nodes: newNodes };
        });
        setIsEditing(false);
        setAiEditStatus('idle');
    };

    const toggleEditMode = () => {
        if(isEditing) {
            if (currentNode) setEditingDialogue(currentNode.dialogue);
            setAiEditStatus('idle');
        }
        setIsEditing(!isEditing);
    }
    
    const handleExportStoryData = () => {
        if (!story) return;
        try {
            const storyJson = JSON.stringify(story, null, 2);
            const blob = new Blob([storyJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const sanitizedTitle = story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${sanitizedTitle || 'cyoa_story'}.cyoa.json`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export story data:", error);
            alert("An error occurred while exporting the story data.");
        }
    };

    // --- AI Edit Handlers ---
    const handleAiSuggest = async (isRegeneration = false) => {
        if (!currentNode || !aiEditPrompt) return;
        setAiEditStatus('loading');
        try {
            const { newDialogue } = await editStoryNodeDialogue(currentNode.dialogue, aiEditPrompt);
            if (isRegeneration) {
                setAiSuggestions(prev => [...prev, newDialogue]);
                setCurrentSuggestionIndex(prev => prev + 1);
            } else {
                setAiSuggestions([newDialogue]);
                setCurrentSuggestionIndex(0);
            }
            setAiEditStatus('hasSuggestion');
        } catch (error) {
            alert(`AI edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setAiEditStatus('idle');
        }
    };

    const handleApproveSuggestion = () => {
        setEditingDialogue(aiSuggestions[currentSuggestionIndex]);
        setAiEditStatus('idle');
        setAiSuggestions([]);
    };

    const handleDeclineSuggestion = () => {
        setAiEditStatus('idle');
        setAiSuggestions([]);
    };

    const handleNavigateSuggestions = (direction: 'next' | 'prev') => {
        if (direction === 'next' && currentSuggestionIndex < aiSuggestions.length - 1) {
            setCurrentSuggestionIndex(i => i + 1);
        } else if (direction === 'prev' && currentSuggestionIndex > 0) {
            setCurrentSuggestionIndex(i => i - 1);
        }
    };
    
    const renderPredictionIcon = (prediction: ChoicePrediction) => {
        switch (prediction) {
            case 'good': return <ThumbsUpIcon />;
            case 'bad': return <ThumbsDownIcon />;
            case 'ending': return <FlagIcon />;
            case 'none': default: return null;
        }
    };


    if (!currentNode) return <div className="text-center"><LoadingSpinner /> Loading story...</div>;

    const isEnding = story.endNodeIds.includes(currentNodeId);

    const TabButton = ({ name }: { name: string }) => (
        <button
            onClick={() => setActiveTab(name)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${
                activeTab === name
                    ? 'bg-purple-700/50 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
            }`}
        >
            {name}
        </button>
    );

    return (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30 flex flex-col">
                <div className="relative mb-4">
                    {currentNode.illustrationUrl ? (
                        <img src={currentNode.illustrationUrl} alt="Scene Illustration" className="w-full h-auto object-cover rounded-md shadow-lg" />
                    ) : (
                        <div className="w-full aspect-video bg-gray-700 rounded-md flex items-center justify-center">
                            <p className="text-gray-400">No illustration for this scene.</p>
                        </div>
                    )}
                    <div className="absolute bottom-2 right-2 flex items-center gap-2 flex-wrap justify-end">
                        <button onClick={handleCopyIllustrationPrompt} className="bg-gray-600/80 hover:bg-gray-500/80 backdrop-blur-sm text-white font-bold p-2 rounded-md transition flex items-center" title="Copy Prompt">
                            <CopyIcon className="h-4 w-4" />
                        </button>
                        {currentNode.illustrationUrl && (
                             <button onClick={handleRemoveIllustration} className="bg-red-600/80 hover:bg-red-700/80 backdrop-blur-sm text-white font-bold p-2 rounded-md transition flex items-center" title="Remove Illustration">
                                <TrashIcon />
                            </button>
                        )}
                        <label className="cursor-pointer bg-green-600/80 hover:bg-green-700/80 backdrop-blur-sm text-white font-bold py-1 px-3 text-sm rounded-md transition flex items-center gap-1.5">
                            <UploadIcon className="h-4 w-4" /> Upload
                            <input type="file" accept="image/*" className="hidden" onChange={handleUploadIllustration} disabled={illustrationLoading} />
                        </label>
                        <button onClick={handleGenerateIllustration} disabled={illustrationLoading} className="bg-purple-600/80 hover:bg-purple-700/80 backdrop-blur-sm text-white font-bold py-1 px-3 text-sm rounded-md transition disabled:bg-purple-800/80 flex items-center gap-1.5">
                            {illustrationLoading ? <LoadingSpinner /> : 'Generate'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow space-y-3 pr-2 -mr-2 overflow-y-auto">
                    {isEditing ? (
                         <textarea
                            value={editingDialogue}
                            onChange={e => setEditingDialogue(e.target.value)}
                            className="w-full h-64 bg-gray-900/50 p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        />
                    ) : (
                        <div className="p-4 bg-black/20 rounded-lg italic">
                            <p className="text-gray-300 whitespace-pre-wrap">{currentNode.dialogue}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="space-y-4">
                <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30">
                    <h3 className="text-xl font-bold mb-4 font-title text-purple-300">Choices</h3>
                    <div className="space-y-3">
                        {currentNode.choices.map(choice => (
                            <div key={choice.id} className="group flex items-center gap-2 relative">
                                {infoTooltipId === choice.id && choice.predictionRationale && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-purple-400 rounded-lg shadow-xl z-10 text-sm text-white">
                                        <p><span className="font-bold text-purple-300">AI Rationale:</span> {choice.predictionRationale}</p>
                                    </div>
                                )}
                                <button
                                    onClick={() => handleChoiceClick(choice)}
                                    disabled={loading || isEnding}
                                    className={`flex-grow text-left p-3 rounded-md transition flex items-center justify-between ${
                                        choice.isChosen ? 'bg-purple-900/70 text-gray-400' : 'bg-gray-700 hover:bg-purple-800/50'
                                    } disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed`}
                                >
                                    <div className="flex items-center gap-3">
                                        {showPredictions && choice.prediction !== 'none' && (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`flex-shrink-0 ${
                                                    choice.prediction === 'good' ? 'text-green-400' : choice.prediction === 'bad' ? 'text-red-400' : 'text-blue-400'
                                                }`} title={`AI Prediction: ${choice.prediction}`}>
                                                    {renderPredictionIcon(choice.prediction)}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); setInfoTooltipId(infoTooltipId === choice.id ? null : choice.id); }} className="text-gray-400 hover:text-white" title="Show AI Rationale">
                                                    <InfoIcon />
                                                </button>
                                            </div>
                                        )}
                                        <span>{choice.text}</span>
                                    </div>
                                    {choice.isChosen && <CheckIcon />}
                                </button>
                                {choice.nextNodeId && (
                                    <button onClick={() => onRegenerateNode(choice, currentNodeId)} disabled={loading} className="opacity-0 group-hover:opacity-100 transition text-blue-400 hover:text-blue-300 p-1 disabled:opacity-50" title="Regenerate outcome">
                                        <RefreshIcon />
                                    </button>
                                )}
                                <button onClick={() => handleRemoveChoice(choice.id)} className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300 p-1"><TrashIcon /></button>
                            </div>
                        ))}
                        {loading && <div className="flex justify-center p-4"><LoadingSpinner /></div>}
                        {isEnding && <div className="text-center p-4 text-green-400 font-bold border-t border-b border-green-500/50 my-4">This is an ending.</div>}
                    </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg shadow-lg border border-purple-500/30">
                    <div className="flex border-b border-purple-500/30 px-2">
                        <TabButton name="Content & AI" />
                        <TabButton name="Page Actions" />
                        <TabButton name="Story Actions" />
                    </div>
                    <div className="p-6 space-y-3">
                        {activeTab === 'Content & AI' && (
                            <>
                                <button onClick={toggleEditMode} className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md transition">
                                    <EditIcon /> {isEditing ? "Cancel Edit" : "Edit Story"}
                                </button>
                                {isEditing && (
                                    <div className="p-4 bg-gray-900/50 rounded-md space-y-3">
                                        <button onClick={handleSaveDialogueEdit} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition">Save Story</button>
                                        <h4 className="text-lg font-bold font-title text-purple-300 pt-2 border-t border-gray-600">AI Edit Assistant</h4>
                                        <textarea value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)} placeholder="e.g., 'Make this more dramatic...'" className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 h-20" />
                                        <button onClick={() => handleAiSuggest(false)} disabled={aiEditStatus === 'loading'} className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md transition">
                                            {aiEditStatus === 'loading' ? <LoadingSpinner/> : <WandIcon />} Suggest Edit
                                        </button>
                                        {aiEditStatus === 'loading' && <p className="text-center text-gray-400">AI is thinking...</p>}
                                        {aiEditStatus === 'hasSuggestion' && (
                                            <div className="p-3 bg-gray-800 rounded-md space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h5 className="font-bold">AI Suggestion {aiSuggestions.length > 1 ? `${currentSuggestionIndex + 1}/${aiSuggestions.length}` : ''}</h5>
                                                    <div className="flex gap-2 items-center text-sm">
                                                        <span className="text-green-400 font-mono">+{diffStats.added}</span>
                                                        <span className="text-red-400 font-mono">-{diffStats.removed}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm italic p-2 bg-black/30 rounded max-h-32 overflow-y-auto">{aiSuggestions[currentSuggestionIndex]}</p>
                                                {aiSuggestions.length > 1 && (
                                                    <div className="flex justify-center gap-2">
                                                         <button onClick={() => handleNavigateSuggestions('prev')} disabled={currentSuggestionIndex === 0} className="px-2 py-1 bg-gray-600 rounded disabled:opacity-50">&lt; Prev</button>
                                                         <button onClick={() => handleNavigateSuggestions('next')} disabled={currentSuggestionIndex === aiSuggestions.length - 1} className="px-2 py-1 bg-gray-600 rounded disabled:opacity-50">Next &gt;</button>
                                                    </div>
                                                )}
                                                <div className="flex gap-2 pt-2">
                                                    <button onClick={handleApproveSuggestion} className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-1 px-2 rounded text-sm">Approve</button>
                                                    <button onClick={() => handleAiSuggest(true)} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-bold py-1 px-2 rounded text-sm">Regenerate</button>
                                                    <button onClick={handleDeclineSuggestion} className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-1 px-2 rounded text-sm">Decline</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button onClick={handleAddChoice} disabled={loading || isGeneratingEnding} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-blue-800 disabled:cursor-not-allowed"><PlusIcon /> Add a Choice</button>
                                <button onClick={() => onRegenerateChoices(currentNodeId)} disabled={loading || isGeneratingEnding} className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-pink-800 disabled:cursor-not-allowed"><WandIcon /> Regenerate Choices</button>
                                <button onClick={onTogglePredictions} className="w-full flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition"><BrainIcon /> {showPredictions ? 'Hide' : 'Show'} AI Predictions</button>
                            </>
                        )}
                        {activeTab === 'Page Actions' && (
                            <>
                                 <div className="flex items-center gap-2">
                                    <label htmlFor="node-jump" className="font-title text-purple-300 whitespace-nowrap">Jump to Page:</label>
                                    <select id="node-jump" onChange={e => onJump(e.target.value)} value={currentNodeId} className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition">
                                        {jumpOptions.map(opt => ( <option key={opt.id} value={opt.id}>{opt.label}</option>))}
                                    </select>
                                </div>
                                <button onClick={() => onRequestDeleteNode(currentNodeId)} disabled={loading || isGeneratingEnding || currentNodeId === story.startNodeId} className="w-full flex items-center justify-center gap-2 bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-red-900 disabled:opacity-50"><TrashIcon /> Delete This Page</button>
                                <button onClick={() => onMarkAsEnding(currentNodeId)} disabled={isEnding || loading || isGeneratingEnding} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-red-800 disabled:opacity-50">Mark as Ending</button>
                            </>
                        )}
                         {activeTab === 'Story Actions' && (
                            <>
                                <button onClick={onShowMap} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition"><MapIcon /> Story Map</button>
                                <button onClick={() => onGenerateEnding(currentNodeId)} disabled={loading || isGeneratingEnding} className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-teal-800 disabled:cursor-not-allowed">
                                    {isGeneratingEnding ? <LoadingSpinner/> : <WandIcon />}
                                    {isGeneratingEnding ? 'Generating...' : 'Generate Ending Path'}
                                </button>
                                <button onClick={handleExportStoryData} className="w-full flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition"><DownloadIcon /> Export Story Data</button>
                                 <button onClick={onExport} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition"><BookIcon /> Export to Printable Book</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameScreen;