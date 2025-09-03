


import React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { GamePhase, Story, Choice, StoryNode, ChoicePrediction } from './types';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import ExportScreen from './components/ExportScreen';
import Modal from './components/Modal';
import { generateStoryNode, regenerateChoices, generateInitialStoryNode } from './services/geminiService';
import { generatePageMap, calculatePathScores, getParentMap } from './utils/storyUtils';

interface ModalConfig {
    type: 'confirm' | 'prompt';
    title: string;
    message: string;
    defaultValue?: string;
    onConfirm: (value?: string) => void;
}

type PathScores = Record<Exclude<ChoicePrediction, 'none'>, number>;

const App: React.FC = () => {
    const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.SETUP);
    const [story, setStory] = useState<Story | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [pathScores, setPathScores] = useState<PathScores>({ good: 0, bad: 0, mixed: 0 });
    const [loading, setLoading] = useState<string | null>(null);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const [showPredictions, setShowPredictions] = useState(false);
    const [autoCompleteProgress, setAutoCompleteProgress] = useState<string | null>(null);


    const handleStartGame = (initialStory: Story) => {
        setStory(initialStory);
        setCurrentNodeId(initialStory.startNodeId);
        setPathScores({ good: 0, bad: 0, mixed: 0 });
        setGamePhase(GamePhase.PLAY);
    };

    const handleNavigate = useCallback(async (choice: Choice, fromNodeId: string) => {
        if (!story) return;
        setLoading('loading');

        const newScores = { ...pathScores };
        if (choice.prediction !== 'none') {
            newScores[choice.prediction]++;
        }

        try {
            const newNode = await generateStoryNode(story, fromNodeId, choice, newScores);
            const newId = `node_${Date.now()}`;
            
            setStory(prevStory => {
                if (!prevStory) return null;

                const updatedNodes = { ...prevStory.nodes, [newId]: { ...newNode, id: newId } };
                const fromNode = { ...updatedNodes[fromNodeId] }; // Create a mutable copy

                // Find the specific choice and update it, marking it as explored.
                fromNode.choices = fromNode.choices.map(c => {
                    if (c.id === choice.id) {
                        return {
                            ...c,
                            isChosen: true, // Mark as explored
                            nextNodeId: newId,
                        };
                    }
                    return c; // Leave other choices untouched
                });

                updatedNodes[fromNodeId] = fromNode; // Assign the updated node back

                const updatedEndNodeIds = [...prevStory.endNodeIds];
                if (newNode.choices.length === 0 && !updatedEndNodeIds.includes(newId)) {
                    updatedEndNodeIds.push(newId);
                }

                return { ...prevStory, nodes: updatedNodes, endNodeIds: updatedEndNodeIds };
            });

            setCurrentNodeId(newId);
            setPathScores(newScores);

        } catch (error) {
            console.error("Failed to generate next story node:", error);
            alert(`There was an error generating the next part of the story: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(null);
        }
    }, [story, pathScores]);
    
    const recalculateScoresAndSetState = useCallback((targetNodeId: string, currentStory: Story) => {
        const parentMap = getParentMap(currentStory);
        const newScores = calculatePathScores(currentStory, targetNodeId, parentMap);
        setPathScores(newScores);
    }, []);

    const handleAutoCompleteStory = async (storyData: Omit<Story, 'nodes' | 'startNodeId' | 'endNodeIds'>) => {
        setLoading('auto-completing');
        setAutoCompleteProgress("Generating initial page...");
    
        // This variable will be mutated during generation and set to state once.
        let storyInProgress: Story | null = null;
    
        try {
            const initialNodeData = await generateInitialStoryNode(storyData);
            const startNodeId = `node_start_${Date.now()}`;
            
            storyInProgress = {
                ...storyData,
                startNodeId,
                nodes: {
                    [startNodeId]: { ...initialNodeData, id: startNodeId }
                },
                endNodeIds: []
            };
            
            const queue: string[] = [startNodeId];
            const visited = new Set<string>([startNodeId]);
            let pagesGenerated = 1;
    
            while (queue.length > 0) {
                const nodeId = queue.shift()!;
                const parentNode = storyInProgress.nodes[nodeId];
    
                setAutoCompleteProgress(`Generated ${pagesGenerated} pages. Processing queue (${queue.length} remaining)...`);
                // Allow the UI to update with the progress message
                await new Promise(resolve => setTimeout(resolve, 50));
    
                for (let i = 0; i < parentNode.choices.length; i++) {
                    const choice = parentNode.choices[i];
                    if (choice.nextNodeId) continue;
    
                    const pathScores = calculatePathScores(storyInProgress, nodeId, getParentMap(storyInProgress));
                    const newScores = { ...pathScores };
                    if (choice.prediction !== 'none') {
                        newScores[choice.prediction]++;
                    }
    
                    const newNodeData = await generateStoryNode(storyInProgress, nodeId, choice, newScores);
                    const newId = `node_${Date.now()}_${i}`;
                    pagesGenerated++;
    
                    // Directly mutate the local story object
                    storyInProgress.nodes[newId] = { ...newNodeData, id: newId };
                    parentNode.choices[i] = { ...choice, nextNodeId: newId, isChosen: true };
    
                    const isEnding = newNodeData.choices.length === 0;
                    if (isEnding && !storyInProgress.endNodeIds.includes(newId)) {
                        storyInProgress.endNodeIds.push(newId);
                    }
    
                    if (!isEnding && !visited.has(newId)) {
                        queue.push(newId);
                        visited.add(newId);
                    }
                }
            }
    
            setStory(storyInProgress);
            setCurrentNodeId(storyInProgress.startNodeId);
            setPathScores({ good: 0, bad: 0, mixed: 0 });
            setGamePhase(GamePhase.PLAY);
    
        } catch (error) {
            console.error("Failed to auto-complete story:", error);
            alert(`An error occurred during auto-completion: ${error instanceof Error ? error.message : String(error)}. The story has been partially generated and will now be loaded for editing.`);
            // If an error occurs, save the partial progress.
            if (storyInProgress) {
                setStory(storyInProgress);
                setCurrentNodeId(storyInProgress.startNodeId);
                setPathScores({ good: 0, bad: 0, mixed: 0 });
                setGamePhase(GamePhase.PLAY);
            }
        } finally {
            setLoading(null);
            setAutoCompleteProgress(null);
        }
    };
    
    const handleRequestMarkAsEnding = (nodeId: string) => {
        setModalConfig({
            type: 'confirm',
            title: 'Mark as Ending',
            message: 'Are you sure you want to mark this page as an ending?',
            onConfirm: () => {
                setStory(prev => {
                    if (!prev || prev.endNodeIds.includes(nodeId)) return prev;
                    // Clear choices when manually marking as an ending
                    const updatedNode = { ...prev.nodes[nodeId], choices: [] };
                    const updatedNodes = { ...prev.nodes, [nodeId]: updatedNode };
                    return {
                        ...prev,
                        nodes: updatedNodes,
                        endNodeIds: [...prev.endNodeIds, nodeId]
                    };
                });
                setModalConfig(null);
            },
        });
    };

    const handleChoiceJump = (choice: Choice, fromNodeId: string) => {
        if (!story || !choice.nextNodeId) return;

        // Simply navigate to the next node. The "isChosen" state is persistent
        // and doesn't need to be updated when just viewing an explored path.
        setCurrentNodeId(choice.nextNodeId);
        recalculateScoresAndSetState(choice.nextNodeId, story);
    };
    
    const handleJumpToNode = (nodeId: string) => {
        if (!story) return;
        setCurrentNodeId(nodeId);
        recalculateScoresAndSetState(nodeId, story);
    };

    const handleGoToExport = () => {
        setGamePhase(GamePhase.EXPORT);
    };
    
    const handleReturnToGame = () => {
        setGamePhase(GamePhase.PLAY);
    }
    
    const handleReturnToSetup = () => {
        setStory(null);
        setCurrentNodeId(null);
        setGamePhase(GamePhase.SETUP);
    };
    
    const handleRegenerateNode = async (choice: Choice, fromNodeId: string) => {
        if (!story || !choice.nextNodeId) return;
        setLoading('loading');

        // Recalculate scores up to the point *before* the node to be regenerated
        const parentMap = getParentMap(story);
        const scoresAtPreviousNode = calculatePathScores(story, fromNodeId, parentMap);
        const newScores = { ...scoresAtPreviousNode };
        if (choice.prediction !== 'none') {
             newScores[choice.prediction]++;
        }
        
        try {
            const regeneratedNodeData = await generateStoryNode(story, fromNodeId, choice, newScores);
            const targetNodeId = choice.nextNodeId;

            setStory(prevStory => {
                if (!prevStory) return null;
                const updatedNodes = { ...prevStory.nodes };
                const oldNode = updatedNodes[targetNodeId];
                updatedNodes[targetNodeId] = { 
                    ...oldNode,
                    ...regeneratedNodeData, 
                    id: targetNodeId 
                };
                
                const updatedEndNodeIds = [...prevStory.endNodeIds];
                const isEnding = regeneratedNodeData.choices.length === 0;
                if(isEnding && !updatedEndNodeIds.includes(targetNodeId)) {
                    updatedEndNodeIds.push(targetNodeId);
                } else if (!isEnding && updatedEndNodeIds.includes(targetNodeId)) {
                    updatedEndNodeIds.splice(updatedEndNodeIds.indexOf(targetNodeId), 1);
                }

                return { ...prevStory, nodes: updatedNodes, endNodeIds: updatedEndNodeIds };
            });

            setCurrentNodeId(targetNodeId); 
            recalculateScoresAndSetState(targetNodeId, story);

        } catch (error) {
            console.error("Failed to regenerate story node:", error);
            alert(`There was an error regenerating the story: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(null);
        }
    };

    const handleRegenerateChoices = async (nodeId: string) => {
        if (!story) return;
        setLoading('loading');
        try {
            const { choices: newChoicesData } = await regenerateChoices(story, nodeId);

            setStory(prevStory => {
                if (!prevStory) return null;
                const updatedNodes = { ...prevStory.nodes };
                const updatedNode = { ...updatedNodes[nodeId] };
                
                updatedNode.choices = newChoicesData.map(c => ({
                    id: `choice_${Date.now()}_${Math.random()}`,
                    text: c.text,
                    prediction: c.prediction || 'none',
                    predictionRationale: c.predictionRationale || 'No rationale provided by AI.',
                    nextNodeId: null,
                    isChosen: false
                }));
                
                updatedNodes[nodeId] = updatedNode;
                return { ...prevStory, nodes: updatedNodes };
            });
        } catch (error) {
            console.error("Failed to regenerate choices:", error);
            alert(`An error occurred while regenerating choices: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(null);
        }
    };

    const handleDeleteNode = (nodeId: string) => {
        if (!story || nodeId === story.startNodeId) return;

        const nodesToDelete = new Set<string>([nodeId]);
        const queue = [nodeId];
        const visited = new Set<string>([nodeId]);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentNode = story.nodes[currentId];
            if (currentNode) {
                for (const choice of currentNode.choices) {
                    if (choice.nextNodeId && !visited.has(choice.nextNodeId) && story.nodes[choice.nextNodeId]) {
                        visited.add(choice.nextNodeId);
                        nodesToDelete.add(choice.nextNodeId);
                        queue.push(choice.nextNodeId);
                    }
                }
            }
        }

        setStory(prevStory => {
            if (!prevStory) return null;

            const remainingNodeIds = Object.keys(prevStory.nodes).filter(id => !nodesToDelete.has(id));
            const updatedNodes: Record<string, StoryNode> = {};

            for (const id of remainingNodeIds) {
                const node = { ...prevStory.nodes[id] };
                node.choices = node.choices.map(choice => {
                    if (choice.nextNodeId && nodesToDelete.has(choice.nextNodeId)) {
                        return { ...choice, nextNodeId: null, isChosen: false };
                    }
                    return choice;
                });
                updatedNodes[id] = node;
            }
            
            const updatedEndNodeIds = prevStory.endNodeIds.filter(id => !nodesToDelete.has(id));

            return {
                ...prevStory,
                nodes: updatedNodes,
                endNodeIds: updatedEndNodeIds
            };
        });

        setCurrentNodeId(story.startNodeId);
        recalculateScoresAndSetState(story.startNodeId, story);
        alert(`Deleted page and ${nodesToDelete.size - 1} connected sub-pages.`);
    };

    const handleRequestDeleteNode = (nodeId: string) => {
        if (!story || nodeId === story.startNodeId) {
            alert("You cannot delete the starting page.");
            return;
        }
        setModalConfig({
            type: 'confirm',
            title: 'Delete Page and Descendants',
            message: 'Are you sure you want to delete this page and all pages that follow from it? This action cannot be undone.',
            onConfirm: () => {
                setModalConfig(null);
                handleDeleteNode(nodeId);
            },
        });
    };

    const renderContent = () => {
        switch (gamePhase) {
            case GamePhase.SETUP:
                return <SetupScreen 
                    onStartGame={handleStartGame} 
                    onAutoCompleteStory={handleAutoCompleteStory}
                    loading={loading}
                    autoCompleteProgress={autoCompleteProgress}
                />;
            case GamePhase.PLAY:
                if (story && currentNodeId) {
                    const pageMap = generatePageMap(story.nodes, story.startNodeId);
                    return (
                        <>
                            <GameScreen
                                story={story}
                                setStory={setStory}
                                currentNodeId={currentNodeId}
                                pageMap={pageMap}
                                onNavigate={handleNavigate}
                                onJump={handleJumpToNode}
                                onChoiceJump={handleChoiceJump}
                                onExport={handleGoToExport}
                                onMarkAsEnding={handleRequestMarkAsEnding}
                                showPredictions={showPredictions}
                                onTogglePredictions={() => setShowPredictions(p => !p)}
                                onRegenerateNode={handleRegenerateNode}
                                onRegenerateChoices={handleRegenerateChoices}
                                onRequestDeleteNode={handleRequestDeleteNode}
                                loading={!!loading}
                            />
                        </>
                    );
                }
                return null;
            case GamePhase.EXPORT:
                if (story) {
                    return <ExportScreen story={story} onReturnToGame={handleReturnToGame} onRestart={handleReturnToSetup}/>;
                }
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200">
           <header className="p-4 bg-gray-900/80 backdrop-blur-sm shadow-lg border-b border-purple-500/30 sticky top-0 z-40">
                <h1 className="text-3xl md:text-4xl text-center font-title text-purple-300 tracking-wider">CYOA Creator</h1>
            </header>
            <main className="p-4 md:p-8">
                {renderContent()}
            </main>
             {modalConfig && (
                <Modal
                    {...modalConfig}
                    onClose={() => setModalConfig(null)}
                />
            )}
        </div>
    );
};

export default App;