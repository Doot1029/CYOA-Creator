import React, { useState, useMemo, useEffect } from 'react';
import { Story, StoryNode } from '../types';
import { RefreshIcon, ArrowLeftIcon, HomeIcon, PdfIcon } from './Icon';
import { generatePageMap } from '../utils/storyUtils';
import LoadingSpinner from './LoadingSpinner';

declare global {
    interface Window {
        jspdf: any;
        htmlToImage: any;
    }
}

interface ExportScreenProps {
    story: Story;
    onReturnToGame: () => void;
    onRestart: () => void;
}

type Page =
    | { type: 'cover'; title: string; imageUrl: string; }
    | { type: 'back_cover'; prompt: string; }
    | {
        type: 'node';
        node: StoryNode;
        originalId: string;
        dialogueChunk: string;
        isFirstChunk: boolean;
        isLastChunk: boolean;
      };

// FIX: Define a type for layout calculation to avoid issues with `Omit` on a discriminated union.
// This helper type explicitly defines the shape of page objects before the dialogue chunk is added,
// which helps TypeScript correctly identify it as a discriminated union.
type LayoutPage =
    | { type: 'cover'; title: string; imageUrl: string; }
    | { type: 'back_cover'; prompt: string; }
    | {
        type: 'node';
        node: StoryNode;
        originalId: string;
        isFirstChunk: boolean;
        isLastChunk: boolean;
      };

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const MAX_WORDS_ILLUSTRATED = 110;
const MAX_WORDS_NO_ILLUSTRATION = 250;

const splitTextIntoChunksByWordCount = (text: string, wordLimit: number): string[] => {
    const words = text.split(' ');
    if (words.length <= wordLimit) {
        return [text];
    }

    const chunks: string[] = [];
    let currentChunkWords: string[] = [];

    for (const word of words) {
        currentChunkWords.push(word);
        if (currentChunkWords.length >= wordLimit) {
            chunks.push(currentChunkWords.join(' '));
            currentChunkWords = [];
        }
    }

    if (currentChunkWords.length > 0) {
        chunks.push(currentChunkWords.join(' '));
    }
    return chunks;
};


const ExportScreen: React.FC<ExportScreenProps> = ({ story, onReturnToGame, onRestart }) => {
    const [pages, setPages] = useState<Page[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    
    const logicalPageMap = useMemo(() => {
        return generatePageMap(story.nodes, story.startNodeId);
    }, [story.nodes, story.startNodeId]);
    
    const physicalPageMap = useMemo(() => {
        const map = new Map<string, number>();
        let physicalPageCounter = 1;
        const tempPages: LayoutPage[] = [];
        
        // First pass: layout pages to get indices
        tempPages.push({ type: 'cover', title: story.title, imageUrl: story.coverImageUrl });
        tempPages.push({ type: 'back_cover', prompt: story.prompt });
        
        const sortedNodeEntries = Array.from(logicalPageMap.entries())
            .sort(([, pageNumA], [, pageNumB]) => pageNumA - pageNumB);

        for (const [nodeId] of sortedNodeEntries) {
            const node = story.nodes[nodeId];
            if (node) {
                const wordLimit = node.illustrationUrl ? MAX_WORDS_ILLUSTRATED : MAX_WORDS_NO_ILLUSTRATION;
                const dialogueChunks = splitTextIntoChunksByWordCount(node.dialogue, wordLimit);
                dialogueChunks.forEach((chunk, index) => {
                    tempPages.push({
                        type: 'node',
                        node: node,
                        originalId: nodeId,
                        isFirstChunk: index === 0,
                        isLastChunk: index === dialogueChunks.length - 1,
                    });
                });
            }
        }
        
        tempPages.forEach((page, index) => {
             if (page.type === 'node' && page.isFirstChunk) {
                map.set(page.originalId, index + 1);
            }
        });
        
        return map;
    }, [story, logicalPageMap]);


    useEffect(() => {
        const coverPage: Page = { type: 'cover', title: story.title, imageUrl: story.coverImageUrl };
        const backCoverPage: Page = { type: 'back_cover', prompt: story.prompt };

        const nodePages: Page[] = [];

        const sortedNodeEntries = Array.from(logicalPageMap.entries())
            .sort(([, pageNumA], [, pageNumB]) => pageNumA - pageNumB);

        for (const [nodeId] of sortedNodeEntries) {
            const node = story.nodes[nodeId];
            if (node) {
                const wordLimit = node.illustrationUrl ? MAX_WORDS_ILLUSTRATED : MAX_WORDS_NO_ILLUSTRATION;
                const dialogueChunks = splitTextIntoChunksByWordCount(node.dialogue, wordLimit);
                
                dialogueChunks.forEach((chunk, index) => {
                    nodePages.push({
                        type: 'node',
                        node: node,
                        originalId: nodeId,
                        dialogueChunk: chunk,
                        isFirstChunk: index === 0,
                        isLastChunk: index === dialogueChunks.length - 1,
                    });
                });
            }
        }

        const finalPagesWithContinuations = [coverPage, backCoverPage, ...nodePages].map((page, index, arr) => {
            if (page.type === 'node') {
                let newDialogueChunk = page.dialogueChunk;
                if (!page.isLastChunk) {
                    const nextPageNumber = index + 2;
                    newDialogueChunk += `\n\n...(Continued on page ${nextPageNumber})`;
                }
                if (!page.isFirstChunk) {
                    const prevPageNumber = index;
                    newDialogueChunk = `(Continued from page ${prevPageNumber})...\n\n` + newDialogueChunk;
                }
                return { ...page, dialogueChunk: newDialogueChunk };
            }
            return page;
        });

        setPages(finalPagesWithContinuations);
    }, [story, logicalPageMap]);
    
    const handleShuffle = () => {
        if (pages.length <= 3) return;

        const coverPage = pages[0];
        const backCoverPage = pages[1];
        const contentPages = pages.slice(2);

        const pageGroups = new Map<string, Page[]>();
        contentPages.forEach(p => {
            if (p.type === 'node') {
                const group = pageGroups.get(p.originalId) || [];
                group.push(p);
                pageGroups.set(p.originalId, group);
            }
        });

        const startPageGroup = pageGroups.get(story.startNodeId);
        if (!startPageGroup) return; 

        pageGroups.delete(story.startNodeId);
        const otherGroups = Array.from(pageGroups.values());
        const shuffledGroups = shuffleArray(otherGroups);

        const shuffledMiddlePages = shuffledGroups.flat();

        setPages([coverPage, backCoverPage, ...startPageGroup, ...shuffledMiddlePages]);
    };

    const handleExportToPdf = async () => {
        if (isExporting) return;
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const { jsPDF } = window.jspdf;
            const printArea = document.getElementById('print-area');
            if (!printArea) {
                throw new Error("Print area not found");
            }

            const pageElements = Array.from(printArea.querySelectorAll('.printable-page')) as HTMLElement[];
            if (pageElements.length === 0) {
                alert("No pages found to export.");
                return;
            }

            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const availableWidth = pdfWidth - margin * 2;
            const availableHeight = pdfHeight - margin * 2;

            for (let i = 0; i < pageElements.length; i++) {
                const element = pageElements[i];
                
                const dataUrl = await window.htmlToImage.toPng(element, { 
                    quality: 1.0, 
                    pixelRatio: 2
                });

                const imgProps = pdf.getImageProperties(dataUrl);
                const aspectRatio = imgProps.height / imgProps.width;

                let imgWidth = availableWidth;
                let imgHeight = imgWidth * aspectRatio;

                if (imgHeight > availableHeight) {
                    imgHeight = availableHeight;
                    imgWidth = imgHeight / aspectRatio;
                }

                const x = (pdfWidth - imgWidth) / 2;
                const y = (pdfHeight - imgHeight) / 2;

                if (i > 0) {
                    pdf.addPage();
                }
                
                pdf.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);
            }

            const sanitizedTitle = story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            pdf.save(`${sanitizedTitle || 'cyoa_story'}.pdf`);

        } catch (error) {
            console.error("Failed to export to PDF:", error);
            alert(`An error occurred while exporting to PDF: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <div className="max-w-4xl mx-auto">
                <div className="no-print bg-gray-800/50 p-4 rounded-lg shadow-lg border border-purple-500/30 mb-8 flex flex-wrap items-center justify-center gap-4">
                    <button onClick={onReturnToGame} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition"><ArrowLeftIcon/> Return to Game</button>
                    <button onClick={handleShuffle} className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md transition"><RefreshIcon/> Shuffle Pages</button>
                    <button onClick={handleExportToPdf} disabled={isExporting} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-red-800 disabled:cursor-wait">
                        {isExporting ? <LoadingSpinner /> : <PdfIcon />}
                        {isExporting ? 'Exporting...' : 'Export to PDF'}
                    </button>
                    <button onClick={onRestart} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition"><HomeIcon/> Start New Story</button>
                </div>

                <div id="print-area">
                    {pages.map((page, index) => (
                        <div key={index} className="max-w-2xl mx-auto mb-8">
                            <div className="page printable-page bg-white text-gray-900 w-full shadow-2xl p-8 md:p-12 border-2 border-gray-700 flex flex-col aspect-[2/3] overflow-hidden">
                                {page.type === 'cover' && (
                                    <div className="flex flex-col items-center justify-center text-center h-full">
                                        <h1 className="text-5xl font-bold font-title mb-8">{page.title}</h1>
                                        <img src={page.imageUrl} alt="Cover Art" className="w-full max-w-sm object-cover rounded shadow-lg border-4 border-gray-800" />
                                    </div>
                                )}
                                {page.type === 'back_cover' && (
                                    <div className="flex flex-col items-center justify-center text-center h-full p-8 bg-gray-50 border-4 border-gray-800 rounded">
                                        <h2 className="text-3xl font-bold font-title mb-6">About This Adventure</h2>
                                        <p className="text-lg leading-relaxed text-gray-700 italic break-words">
                                            {page.prompt}
                                        </p>
                                    </div>
                                )}
                                {page.type === 'node' && (
                                    <div className="flex-grow flex flex-col overflow-hidden">
                                        {page.node.illustrationUrl && page.isFirstChunk && (
                                            <div className="mb-4 flex-shrink-0">
                                                <img src={page.node.illustrationUrl} alt="Scene Illustration" className="w-full h-auto object-cover rounded shadow-md border-2 border-gray-800" />
                                            </div>
                                        )}
                                        <div className="space-y-4 overflow-hidden flex-grow">
                                            <p className="text-lg leading-relaxed italic text-gray-700 whitespace-pre-wrap break-words">{page.dialogueChunk}</p>
                                        </div>

                                        {page.isLastChunk && page.node.choices.length > 0 && !story.endNodeIds.includes(page.originalId) && (
                                            <div className="mt-8 pt-4 border-t-2 border-gray-300 flex-shrink-0">
                                                <h3 className="text-xl font-bold mb-4 font-title">Your choices:</h3>
                                                <ul className="list-none space-y-3">
                                                    {page.node.choices.map((choice) => (
                                                        <li key={choice.id} className="italic break-words">
                                                            - {choice.text} (Turn to page {physicalPageMap.get(choice.nextNodeId || '') || '???'})
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {page.isLastChunk && story.endNodeIds.includes(page.originalId) && (
                                            <div className="mt-8 text-center text-2xl font-bold font-title flex-shrink-0">THE END</div>
                                        )}
                                    </div>
                                )}
                                <div className="mt-auto text-center font-bold text-gray-800 pt-4 flex-shrink-0">
                                    Page {index + 1}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ExportScreen;