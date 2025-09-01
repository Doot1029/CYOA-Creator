import React, { useState, useEffect } from 'react';
import { Story } from '../types';
import { generateStoryPrompt, generateImage, generateInitialStoryNode, generateTitle, generateCoverArtPromptKeywords } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { UploadIcon, CopyIcon } from './Icon';

interface SetupScreenProps {
    onStartGame: (story: Story) => void;
}

const ART_STYLES = ['Digital Painting', 'Anime', 'Comic Book', 'Watercolor', 'Pixel Art', 'Photorealistic', 'Fantasy Art', 'Sci-Fi Concept Art', 'Steampunk'];

const SetupScreen: React.FC<SetupScreenProps> = ({ onStartGame }) => {
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [coverImageUrl, setCoverImageUrl] = useState('');
    const [artStyle, setArtStyle] = useState(ART_STYLES[0]);
    const [loading, setLoading] = useState<string | null>(null);
    const [isCopyingPrompt, setIsCopyingPrompt] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleFile = (file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            setLoading('cover');
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverImageUrl(reader.result as string);
                setLoading(null);
            };
            reader.onerror = () => {
                console.error("Failed to read file");
                alert("Failed to read file.");
                setLoading(null);
            }
            reader.readAsDataURL(file);
        } else if (file) {
            alert("Please use an image file (e.g., PNG, JPG).");
        }
    };

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    handleFile(file);
                    event.preventDefault();
                    return;
                }
            }
        };

        document.addEventListener('paste', handlePaste);

        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, []); 

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDraggingOver(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDraggingOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleGeneratePrompt = async () => {
        setLoading('prompt');
        try {
            const newPrompt = await generateStoryPrompt();
            setPrompt(newPrompt);
        } catch (error) {
            console.error(error);
            alert("Failed to generate prompt. Check console for details.");
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateTitle = async () => {
        if (!prompt) {
            alert("Please generate or write a prompt first.");
            return;
        }
        setLoading('title');
        try {
            const newTitle = await generateTitle(prompt);
            setTitle(newTitle);
        } catch (error) {
            console.error(error);
            alert("Failed to generate title.");
        } finally {
            setLoading(null);
        }
    }

    const handleGenerateCover = async () => {
        if (!title || !prompt) {
            alert("Please provide a title and prompt first.");
            return;
        }
        setLoading('cover');
        try {
            const coverPromptKeywords = await generateCoverArtPromptKeywords(title, prompt, artStyle);
            const url = await generateImage(coverPromptKeywords, '3:4');
            setCoverImageUrl(url);
        } catch (error) {
            console.error(error);
            alert("Failed to generate cover image.");
        } finally {
            setLoading(null);
        }
    };

    const handleUploadCover = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleCopyCoverPrompt = async () => {
        if (!title || !prompt) {
            alert("Please provide a title and prompt first.");
            return;
        }
        setIsCopyingPrompt(true);
        try {
            const coverPromptKeywords = await generateCoverArtPromptKeywords(title, prompt, artStyle);
            await navigator.clipboard.writeText(coverPromptKeywords);
            alert("Cover prompt copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy prompt:", err);
            alert("Failed to copy prompt.");
        } finally {
            setIsCopyingPrompt(false);
        }
    };

    const handleStart = async () => {
        if (!title || !prompt || !coverImageUrl) {
            alert("Please provide a title, a prompt, and a cover image.");
            return;
        }
        setLoading('start');
        try {
            const storyData = { title, prompt, artStyle };
            const initialNode = await generateInitialStoryNode(storyData);
            
            const startNodeId = `node_start_${Date.now()}`;
            const story: Story = {
                ...storyData,
                coverImageUrl,
                startNodeId,
                nodes: {
                    [startNodeId]: { ...initialNode, id: startNodeId }
                },
                endNodeIds: []
            };

            onStartGame(story);

        } catch (error) {
            console.error(error);
            alert("Failed to start the game. Check console for details.");
        } finally {
            setLoading(null);
        }
    };

    const handleImportStory = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setLoading('start');
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const importedStory: Story = JSON.parse(text);
                    if (importedStory.title && importedStory.nodes && importedStory.startNodeId) {
                        onStartGame(importedStory);
                    } else {
                        alert("Invalid story file format.");
                    }
                } catch (error) {
                    console.error("Failed to import story:", error);
                    alert("Failed to import story. The file might be corrupted or in the wrong format.");
                } finally {
                    setLoading(null);
                }
            };
            reader.onerror = () => {
                 console.error("Failed to read file");
                 alert("Failed to read file.");
                 setLoading(null);
            }
            reader.readAsText(file);
        }
        event.target.value = ''; 
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30">
                <h2 className="text-2xl font-bold mb-4 font-title text-purple-300">1. Story Details</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Your Story Title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-gray-700 p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        />
                         <button onClick={handleGenerateTitle} disabled={!!loading || !prompt} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-purple-800 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap">
                            {loading === 'title' ? <LoadingSpinner /> : 'Generate'}
                        </button>
                    </div>
                    <textarea
                        placeholder="Enter your story prompt here, or generate one."
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        className="w-full bg-gray-700 p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition h-24"
                    />
                    <button onClick={handleGeneratePrompt} disabled={!!loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-purple-800 disabled:cursor-not-allowed flex items-center justify-center">
                        {loading === 'prompt' ? <LoadingSpinner /> : 'Generate Prompt'}
                    </button>
                </div>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-purple-500/30">
                <h2 className="text-2xl font-bold mb-4 font-title text-purple-300">2. Cover Art</h2>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div 
                        className={`w-full md:w-48 h-64 bg-gray-700 rounded-md flex-shrink-0 flex items-center justify-center border border-gray-600 transition-all duration-300 relative ${isDraggingOver ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-gray-800' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {loading === 'cover' ? <LoadingSpinner /> : coverImageUrl ? (
                            <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover rounded-md" />
                        ) : <p className="text-gray-400 text-center p-2">Generate, upload, or drop a cover image</p>}
                        {isDraggingOver && (
                             <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                                <p className="text-white font-bold">Drop Image</p>
                             </div>
                        )}
                    </div>
                    <div className="flex-grow space-y-2 w-full">
                         <div className="flex items-center gap-2">
                            <label htmlFor="art-style" className="text-sm font-bold text-gray-300 whitespace-nowrap">Art Style:</label>
                            <select
                                id="art-style"
                                value={artStyle}
                                onChange={e => setArtStyle(e.target.value)}
                                className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm"
                            >
                                {ART_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                            </select>
                        </div>
                        <button onClick={handleGenerateCover} disabled={!!loading || !prompt || !title} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-purple-800 disabled:cursor-not-allowed flex items-center justify-center">
                            {loading === 'cover' ? <LoadingSpinner /> : 'Generate Cover'}
                        </button>
                        <label className="w-full cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition flex items-center justify-center gap-2">
                            <UploadIcon /> Upload Cover
                            <input type="file" accept="image/*" className="hidden" onChange={handleUploadCover} disabled={!!loading} />
                        </label>
                        <button onClick={handleCopyCoverPrompt} disabled={!prompt || !title || isCopyingPrompt} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-gray-800 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {isCopyingPrompt ? <LoadingSpinner /> : <CopyIcon />}
                            {isCopyingPrompt ? 'Generating...' : 'Copy Prompt'}
                        </button>
                        <p className="text-xs text-gray-400 text-center pt-1">You can also drag & drop or paste an image.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <button onClick={handleStart} disabled={!!loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition text-xl disabled:bg-blue-800 disabled:cursor-not-allowed flex items-center justify-center">
                    {loading === 'start' ? <LoadingSpinner /> : 'Start Your Adventure!'}
                </button>
                <div className="text-center text-gray-400">or</div>
                <label className="w-full cursor-pointer bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md transition text-xl flex items-center justify-center gap-2">
                    <UploadIcon /> Import Story
                    <input type="file" accept=".json,.cyoa.json" className="hidden" onChange={handleImportStory} disabled={!!loading} />
                </label>
            </div>
        </div>
    );
};

export default SetupScreen;