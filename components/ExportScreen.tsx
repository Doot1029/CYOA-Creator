import React, { useState, useMemo, useEffect } from 'react';
import { Story, StoryNode } from '../types';
import { BookIcon, RefreshIcon, ArrowLeftIcon, HomeIcon, ZipIcon } from './Icon';
import { generatePageMap } from '../utils/storyUtils';
import LoadingSpinner from './LoadingSpinner';

// Declare global variables for libraries loaded via script tags
declare var htmlToImage: any;
declare var JSZip: any;

interface ExportScreenProps {
    story: Story;
    onReturnToGame: () => void;
    onRestart: () => void;
}

type Page = 
    | { type: 'cover'; title: string; imageUrl: string; }
    | { type: 'back_cover'; prompt: string; }
    | { type: 'node'; node: StoryNode; originalId: string; }
    | { type: 'ending'; text: string; };

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const ExportScreen: React.FC<ExportScreenProps> = ({ story, onReturnToGame, onRestart }) => {
    const [pages, setPages] = useState<Page[]>([]);
    const [isZipping, setIsZipping] = useState(false);
    
    // Create a stable, logical mapping of node IDs to page numbers
    const logicalPageMap = useMemo(() => {
        return generatePageMap(story.nodes, story.startNodeId);
    }, [story.nodes, story.startNodeId]);
    
    // Create the initial, unshuffled list of printable pages
    useEffect(() => {
        const coverPage: Page = { type: 'cover', title: story.title, imageUrl: story.coverImageUrl };
        const backCoverPage: Page = { type: 'back_cover', prompt: story.prompt };
        const endingPage: Page = { type: 'ending', text: "The End" };
        
        const nodePages: Page[] = Array.from(logicalPageMap.entries())
            .sort(([, pageNumA], [, pageNumB]) => pageNumA - pageNumB)
            .map(([nodeId]) => ({
                type: 'node',
                node: story.nodes[nodeId],
                originalId: nodeId
            }));

        setPages([coverPage, backCoverPage, ...nodePages, endingPage]);
    }, [story, logicalPageMap]);
    
    // Create a map from original node ID to its current physical page position
    const physicalPageMap = useMemo(() => {
        const map = new Map<string, number>();
        pages.forEach((page, index) => {
            if (page.type === 'node') {
                map.set(page.originalId, index + 1);
            }
        });
        return map;
    }, [pages]);

    const handleShuffle = () => {
        // Not enough pages to shuffle (e.g., Cover, Back Cover, Page 1, End)
        if (pages.length <= 4) {
            return;
        }
        
        const coverPage = pages[0];
        const backCoverPage = pages[1];
        const startPage = pages.find(p => p.type === 'node' && p.originalId === story.startNodeId);
        const lastPage = pages[pages.length - 1];
        
        // Exclude start page, cover, and back cover from shuffling
        const middlePages = pages.slice(2, -1).filter(p => p !== startPage);
        
        const shuffledMiddle = shuffleArray(middlePages);
        
        // Reconstruct with start page physically after back cover
        setPages([coverPage, backCoverPage, startPage!, ...shuffledMiddle, lastPage]);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportToZip = async () => {
        if (!story) return;
        setIsZipping(true);

        try {
            if (typeof htmlToImage === 'undefined' || typeof JSZip === 'undefined') {
                alert("Export libraries could not be loaded. Please check your internet connection and try again.");
                setIsZipping(false);
                return;
            }

            const zip = new JSZip();
            const pageElements = document.querySelectorAll<HTMLElement>('.printable-page');
            
            for (let i = 0; i < pageElements.length; i++) {
                const pageElement = pageElements[i];
                const pageNumber = i + 1;
                try {
                    const pngDataUrl = await htmlToImage.toPng(pageElement, { pixelRatio: 2 });
                    const base64Data = pngDataUrl.split(',')[1];
                    zip.file(`page_${String(pageNumber).padStart(2, '0')}.png`, base64Data, { base64: true });
                } catch (imageError) {
                    console.error(`Failed to render page ${pageNumber}:`, imageError);
                }
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            
            const a = document.createElement('a');
            const sanitizedTitle = story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `${sanitizedTitle || 'cyoa_story'}_png_export.zip`;
            a.href = URL.createObjectURL(content);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

        } catch (error) {
            console.error("Failed to create zip file:", error);
            alert("An error occurred while creating the zip file.");
        } finally {
            setIsZipping(false);
        }
    };

    return (
        <>
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #print-area, #print-area * {
                            visibility: visible;
                        }
                        #print-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                        }
                        .page {
                            page-break-after: always;
                            height: 100vh;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        .no-print {
                            display: none;
                        }
                    }
                    @page {
                        size: 8.5in 11in;
                        margin: 0.5in;
                    }
                `}
            </style>
            <div className="max-w-4xl mx-auto">
                <div className="no-print bg-gray-800/50 p-4 rounded-lg shadow-lg border border-purple-500/30 mb-8 flex flex-wrap items-center justify-center gap-4">
                    <button onClick={onReturnToGame} disabled={isZipping} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"><ArrowLeftIcon/> Return to Game</button>
                    <button onClick={handleShuffle} disabled={isZipping} className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"><RefreshIcon/> Shuffle Pages</button>
                    <button onClick={handleExportToZip} disabled={isZipping} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50">
                        {isZipping ? <LoadingSpinner/> : <ZipIcon/>}
                        {isZipping ? 'Exporting...' : 'Export as PNG ZIP'}
                    </button>
                    <button onClick={handlePrint} disabled={isZipping} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"><BookIcon/> Print Book</button>
                    <button onClick={onRestart} disabled={isZipping} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"><HomeIcon/> Start New Story</button>
                </div>

                <div id="print-area">
                    {pages.map((page, index) => (
                        <div key={index} className="page printable-page bg-white text-gray-900 aspect-[8.5/11] max-w-2xl mx-auto mb-8 shadow-2xl p-8 md:p-12 border-2 border-gray-700 flex flex-col">
                            {page.type === 'cover' && (
                                <div className="flex flex-col items-center justify-center text-center h-full">
                                    <h1 className="text-5xl font-bold font-title mb-8">{page.title}</h1>
                                    <img src={page.imageUrl} alt="Cover Art" className="w-full max-w-sm object-cover rounded shadow-lg border-4 border-gray-800" />
                                </div>
                            )}
                             {page.type === 'back_cover' && (
                                <div className="flex flex-col items-center justify-center text-center h-full p-8 bg-gray-50 border-4 border-gray-800 rounded">
                                    <h2 className="text-3xl font-bold font-title mb-6">About This Adventure</h2>
                                    <p className="text-lg leading-relaxed text-gray-700 italic">
                                        {page.prompt}
                                    </p>
                                </div>
                            )}
                             {page.type === 'node' && (
                                <div className="flex-grow">
                                    {page.node.cgImageUrl && (
                                        <div className="mb-4">
                                            <img src={page.node.cgImageUrl} alt="Scene CG" className="w-full h-auto object-cover rounded shadow-md border-2 border-gray-800" />
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <p className="text-lg leading-relaxed italic text-gray-700 whitespace-pre-wrap">{page.node.dialogue}</p>
                                    </div>

                                    {page.node.choices.length > 0 && !story.endNodeIds.includes(page.originalId) && (
                                        <div className="mt-8 pt-4 border-t-2 border-gray-300">
                                            <h3 className="text-xl font-bold mb-4 font-title">Your choices:</h3>
                                            <ul className="list-none space-y-3">
                                                {page.node.choices.map((choice) => (
                                                    <li key={choice.id} className="italic">
                                                        - {choice.text} (Turn to page {physicalPageMap.get(choice.nextNodeId || '') || '???'})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {story.endNodeIds.includes(page.originalId) && (
                                        <div className="mt-8 text-center text-2xl font-bold font-title">THE END</div>
                                    )}
                                </div>
                            )}
                            {page.type === 'ending' && (
                                 <div className="flex flex-col items-center justify-center h-full">
                                    <h2 className="text-6xl font-bold font-title">{page.text}</h2>
                                </div>
                            )}
                            <div className="mt-auto text-center font-bold text-gray-800 pt-4">
                                Page {index + 1}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ExportScreen;