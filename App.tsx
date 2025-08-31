import React from 'react';
import { useState, useCallback } from 'react';
import { GamePhase, Story, Choice, StoryNode } from './types';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import ExportScreen from './components/ExportScreen';
import Modal from './components/Modal';
import StoryMapView from './components/StoryMapView';
import { generateStoryNode, generateStoryNodeForEnding, generateFinalEndingNode } from './services/geminiService';
import { generatePageMap } from './utils/storyUtils';

interface ModalConfig {
    type: 'confirm' | 'prompt';
    title: string;
    message: string;
    defaultValue?: string;
    onConfirm: (value?: string) => void;
}

const App: React.FC = () => {
    const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.SETUP);
    const [story, setStory] = useState<Story | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isGeneratingEnding, setIsGeneratingEnding] = useState(false);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const [isMapViewVisible, setIsMapViewVisible] = useState(false);
    const [showPredictions, setShowPredictions] = useState(false);

    const handleStartGame = (initialStory: Story) => {
        setStory(initialStory);
        setCurrentNodeId(initialStory.startNodeId);
        setGamePhase(GamePhase.PLAY);
    };

    const handleNavigate = useCallback(async (choice: Choice, fromNodeId: string) => {
        if (!story) return;
        setLoading(true);
        try {
            const newNode = await generateStoryNode(story, fromNodeId, choice);
            const newId = `node_${Date.now()}`;
            
            setStory(prevStory => {
                if (!prevStory) return null;
                const updatedNodes = { ...prevStory.nodes, [newId]: { ...newNode, id: newId } };
                const fromNode = updatedNodes[fromNodeId];
                const updatedChoice = fromNode.choices.find(c => c.id === choice.id);
                if(updatedChoice) {
                    updatedChoice.nextNodeId = newId;
                    updatedChoice.isChosen = true;
                }
                return { ...prevStory, nodes: updatedNodes };
            });
            setCurrentNodeId(newId);
        } catch (error) {
            console.error("Failed to generate next story node:", error);
            alert("There was an error generating the next part of the story. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [story]);
    
    const handleRequestGenerateEnding = (fromNodeId: string) => {
        setModalConfig({
            type: 'prompt',
            title: 'Generate Ending Path',
            message: 'Enter the text for the choice that begins the ending sequence:',
            defaultValue: "Head towards the story's conclusion.",
            onConfirm: (choiceText) => {
                setModalConfig(null);
                if (choiceText) {
                    generateEndingPath(fromNodeId, choiceText);
                }
            },
        });
    };

    const generateEndingPath = async (fromNodeId: string, choiceText: string) => {
        if (!story) return;
        setIsGeneratingEnding(true);

        try {
            let updatedStory = JSON.parse(JSON.stringify(story)); // Deep copy

            const startChoiceId = `choice_ending_start_${Date.now()}`;
            const newChoice: Choice = { 
                id: startChoiceId, 
                text: choiceText, 
                nextNodeId: null, 
                isChosen: true,
                prediction: 'ending',
                predictionRationale: 'This choice begins the final sequence of the story.'
            };
            updatedStory.nodes[fromNodeId].choices.push(newChoice);

            let previousNodeId = fromNodeId;
            let previousChoice: Choice = newChoice;

            const ENDING_PATH_LENGTH = 3;

            for (let i = 1; i < ENDING_PATH_LENGTH; i++) {
                const newNodeData = await generateStoryNodeForEnding(updatedStory, previousNodeId, previousChoice, i, ENDING_PATH_LENGTH);
                const newNodeId = `node_ending_${i}_${Date.now()}`;
                const newNode: StoryNode = { ...newNodeData, id: newNodeId };

                updatedStory.nodes[newNodeId] = newNode;
                const prevNodeChoice = updatedStory.nodes[previousNodeId].choices.find((c: Choice) => c.id === previousChoice.id);
                if (prevNodeChoice) prevNodeChoice.nextNodeId = newNodeId;

                previousNodeId = newNodeId;
                if (!newNode.choices || newNode.choices.length === 0) {
                    updatedStory.endNodeIds.push(newNodeId);
                    setStory(updatedStory);
                    setIsGeneratingEnding(false);
                    return;
                }
                previousChoice = newNode.choices[0];
            }

            const finalNodeData = await generateFinalEndingNode(updatedStory, previousNodeId, previousChoice);
            const finalNodeId = `node_ending_final_${Date.now()}`;
            const finalNode: StoryNode = { dialogue: finalNodeData.dialogue, choices: [], id: finalNodeId };

            updatedStory.nodes[finalNodeId] = finalNode;
            const prevNodeChoice = updatedStory.nodes[previousNodeId].choices.find((c: Choice) => c.id === previousChoice.id);
            if (prevNodeChoice) prevNodeChoice.nextNodeId = finalNodeId;
            
            updatedStory.endNodeIds.push(finalNodeId);
            setStory(updatedStory);

        } catch (error) {
            console.error("Failed to generate ending path:", error);
            alert("An error occurred while generating the ending path.");
        } finally {
            setIsGeneratingEnding(false);
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
                    return {
                        ...prev,
                        endNodeIds: [...prev.endNodeIds, nodeId]
                    };
                });
                setModalConfig(null);
            },
        });
    };

    const handleChoiceJump = (choice: Choice, fromNodeId: string) => {
        setStory(prev => {
            if (!prev) return null;
            const updatedNodes = { ...prev.nodes };
            const fromNode = { ...updatedNodes[fromNodeId] };
            fromNode.choices = fromNode.choices.map(c => 
                c.id === choice.id ? { ...c, isChosen: true } : c
            );
            updatedNodes[fromNodeId] = fromNode;
            return { ...prev, nodes: updatedNodes };
        });
        setCurrentNodeId(choice.nextNodeId!);
    };
    
    const handleJumpToNode = (nodeId: string) => {
        setCurrentNodeId(nodeId);
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

    const renderContent = () => {
        switch (gamePhase) {
            case GamePhase.SETUP:
                return <SetupScreen onStartGame={handleStartGame} />;
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
                                onGenerateEnding={handleRequestGenerateEnding}
                                onMarkAsEnding={handleRequestMarkAsEnding}
                                onShowMap={() => setIsMapViewVisible(true)}
                                showPredictions={showPredictions}
                                onTogglePredictions={() => setShowPredictions(p => !p)}
                                loading={loading}
                                isGeneratingEnding={isGeneratingEnding}
                            />
                            {isMapViewVisible && (
                                <StoryMapView
                                    story={story}
                                    currentNodeId={currentNodeId}
                                    pageMap={pageMap}
                                    onJump={handleJumpToNode}
                                    onClose={() => setIsMapViewVisible(false)}
                                />
                            )}
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