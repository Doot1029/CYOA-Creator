import React, { useState, useEffect, useMemo } from 'react';
import { Story, StoryNode, Choice, ChoicePrediction } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { generateImage } from '../services/geminiService';
import { EditIcon, TrashIcon, PlusIcon, BookIcon, UploadIcon, CopyIcon, CheckIcon, DownloadIcon, WandIcon, MapIcon, BrainIcon, ThumbsUpIcon, ThumbsDownIcon, FlagIcon, InfoIcon } from './Icon';

interface GameScreenProps {
    story: Story;
    setStory: React.Dispatch<React.SetStateAction<Story | null>>;
    currentNodeId: string;
    pageMap: Map<string, number>;
    onNavigate: (choice: Choice, fromNodeId: string) => Promise<void>;
    onChoiceJump: (choice: Choice, fromNodeId: string) => void;
    onJump: (nodeId: string) => void;
    onExport: () => void;
    onGenerateEnding: (fromNodeId: string) => void;
    onMarkAsEnding: (nodeId: string) => void;
    onShowMap: () => void;
    showPredictions: boolean;
    onTogglePredictions: () => void;
    loading: boolean;
    isGeneratingEnding: boolean;
}

const GameScreen: React.FC<GameScreenProps> = ({ story, setStory, currentNodeId, pageMap, onNavigate, onJump, onChoiceJump, onExport, onGenerateEnding, onMarkAsEnding, onShowMap, showPredictions, onTogglePredictions, loading, isGeneratingEnding }) => {
    const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
    const [cgLoading, setCgLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingDialogue, setEditingDialogue] = useState<string>('');
    const [infoTooltipId, setInfoTooltipId] = useState<string | null>(null);

    useEffect(() => {
        const node = story.nodes[currentNodeId];
        setCurrentNode(node);
        setInfoTooltipId(null); // Close tooltip on page change
        if (node) {
            setEditingDialogue(node.dialogue);
        }
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

    const handleChoiceClick = (choice: Choice) => {
        if (choice.nextNodeId) {
            onChoiceJump(choice, currentNodeId);
        } else {
            onNavigate(choice, currentNodeId);
        }
    };
    
    const handleGenerateCG = async () => {
        if (!currentNode) return;
        setCgLoading(true);
        const sceneText = currentNode.dialogue;
        const cgPrompt = `A cinematic digital painting of the following scene: "${sceneText}". Style: detailed, atmospheric, visual novel CG.`;
        try {
            const imageUrl = await generateImage(cgPrompt, '16:9');
            setStory(prev => {
                if (!prev) return null;
                const newNodes = { ...prev.nodes };
                newNodes[currentNodeId].cgImageUrl = imageUrl;
                return { ...prev, nodes: newNodes };
            });
        } catch (error) {
            console.error(error);
            alert("Failed to generate CG image.");
        } finally {
            setCgLoading(false);
        }
    };

    const handleUploadCG = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && currentNode) {
            setCgLoading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                const imageUrl = reader.result as string;
                setStory(prev => {
                    if (!prev) return null;
                    const newNodes = { ...prev.nodes };
                    newNodes[currentNodeId].cgImageUrl = imageUrl;
                    return { ...prev, nodes: newNodes };
                });
                setCgLoading(false);
            };
            reader.onerror = () => {
                console.error("Failed to read file");
                alert("Failed to read file.");
                setCgLoading(false);
            }
            reader.readAsDataURL(file);
        }
    };
    
    const handleCopyCGPrompt = () => {
        if (!currentNode) return;
        const sceneText = currentNode.dialogue;
        const cgPrompt = `A cinematic digital painting of the following scene: "${sceneText}". Style: detailed, atmospheric, visual novel CG.`;
        navigator.clipboard.writeText(cgPrompt).then(() => {
            alert("CG prompt copied to clipboard!");
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
    };

    const toggleEditMode = () => {
        if(isEditing && currentNode) {
            // Reset changes if user is cancelling
            setEditingDialogue(currentNode.dialogue);
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

    const renderPredictionIcon = (prediction: ChoicePrediction) => {
        switch (prediction) {
            case 'good':
                return <ThumbsUpIcon />;
            case 'bad':
                return <ThumbsDownIcon />;
            case 'ending':
                return <FlagIcon />;
            default:
                return null;
        }
    };


    if (!currentNode) return <div className="text-center"><LoadingSpinner /> Loading story...</div>;

    const isEnding = story.endNodeIds.includes(currentNodeId);

    return (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30 flex flex-col">
                <div className="relative mb-4">
                    {currentNode.cgImageUrl ? (
                        <img src={currentNode.cgImageUrl} alt="Scene" className="w-full h-auto object-cover rounded-md shadow-lg" />
                    ) : (
                        <div className="w-full aspect-video bg-gray-700 rounded-md flex items-center justify-center">
                            <p className="text-gray-400">No CG generated for this scene.</p>
                        </div>
                    )}
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        <button onClick={handleCopyCGPrompt} className="bg-gray-600/80 hover:bg-gray-500/80 backdrop-blur-sm text-white font-bold p-2 rounded-md transition flex items-center" title="Copy Prompt">
                            <CopyIcon className="h-4 w-4" />
                        </button>
                        <label className="cursor-pointer bg-green-600/80 hover:bg-green-700/80 backdrop-blur-sm text-white font-bold py-1 px-3 text-sm rounded-md transition flex items-center gap-1.5">
                            <UploadIcon className="h-4 w-4" /> Upload
                            <input type="file" accept="image/*" className="hidden" onChange={handleUploadCG} disabled={cgLoading} />
                        </label>
                        <button onClick={handleGenerateCG} disabled={cgLoading} className="bg-purple-600/80 hover:bg-purple-700/80 backdrop-blur-sm text-white font-bold py-1 px-3 text-sm rounded-md transition disabled:bg-purple-800/80 flex items-center gap-1.5">
                            {cgLoading ? <LoadingSpinner /> : 'Generate'}
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
                                    className={`w-full text-left p-3 rounded-md transition flex items-center justify-between ${
                                        choice.isChosen
                                            ? 'bg-purple-900/70 text-gray-400'
                                            : 'bg-gray-700 hover:bg-purple-800/50'
                                    } disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed`}
                                >
                                    <div className="flex items-center gap-3">
                                        {showPredictions && choice.prediction && (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`flex-shrink-0 ${
                                                    choice.prediction === 'good' ? 'text-green-400' :
                                                    choice.prediction === 'bad' ? 'text-red-400' :
                                                    'text-blue-400'
                                                }`} title={`AI Prediction: ${choice.prediction}`}>
                                                    {renderPredictionIcon(choice.prediction)}
                                                </span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setInfoTooltipId(infoTooltipId === choice.id ? null : choice.id); }}
                                                    className="text-gray-400 hover:text-white"
                                                    title="Show AI Rationale"
                                                >
                                                    <InfoIcon />
                                                </button>
                                            </div>
                                        )}
                                        <span>{choice.text}</span>
                                    </div>
                                    {choice.isChosen && <CheckIcon />}
                                </button>
                                 <button onClick={() => handleRemoveChoice(choice.id)} className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300 p-1"><TrashIcon /></button>
                            </div>
                        ))}
                        {loading && <div className="flex justify-center p-4"><LoadingSpinner /></div>}
                         {isEnding && <div className="text-center p-4 text-green-400 font-bold border-t border-b border-green-500/50 my-4">This is an ending.</div>}
                    </div>
                </div>

                <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30 space-y-3">
                    <h3 className="text-xl font-bold mb-4 font-title text-purple-300">Story Tools</h3>
                    <button onClick={onTogglePredictions} className="w-full flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition">
                        <BrainIcon /> {showPredictions ? 'Hide' : 'Show'} AI Predictions
                    </button>
                     <button onClick={toggleEditMode} className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md transition">
                        <EditIcon /> {isEditing ? "Cancel Edit" : "Edit Story"}
                    </button>
                    {isEditing && (
                         <button onClick={handleSaveDialogueEdit} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition">
                            Save Story
                        </button>
                    )}
                    <button onClick={handleAddChoice} disabled={loading || isGeneratingEnding} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-blue-800 disabled:cursor-not-allowed">
                       <PlusIcon /> Add a Choice
                    </button>
                     <button onClick={onShowMap} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition">
                        <MapIcon /> Story Map
                    </button>
                    <button onClick={() => onGenerateEnding(currentNodeId)} disabled={loading || isGeneratingEnding} className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-teal-800 disabled:cursor-not-allowed">
                        {isGeneratingEnding ? <LoadingSpinner/> : <WandIcon />}
                        {isGeneratingEnding ? 'Generating...' : 'Generate Ending Path'}
                    </button>
                    <button onClick={() => onMarkAsEnding(currentNodeId)} disabled={isEnding || loading || isGeneratingEnding} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-red-800 disabled:opacity-50">
                        Mark as Ending
                    </button>
                    <button onClick={handleExportStoryData} className="w-full flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition">
                       <DownloadIcon /> Export Story Data
                    </button>
                     <div className="flex items-center gap-2">
                        <label htmlFor="node-jump" className="font-title text-purple-300">Jump to Page:</label>
                        <select id="node-jump" onChange={e => onJump(e.target.value)} value={currentNodeId} className="flex-grow bg-gray-700 p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition">
                            {jumpOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                 <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30">
                    <button onClick={onExport} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition">
                        <BookIcon /> Export to Printable Book
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameScreen;