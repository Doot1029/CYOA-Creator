import React from 'react';
import { Character } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { TrashIcon, RefreshIcon, UploadIcon, CopyIcon } from './Icon';

interface CharacterCardProps {
    character: Character;
    onUpdate: (character: Character) => void;
    onRemove: (id: string) => void;
    onGenerateDetails: () => void;
    onGenerateImage: () => void;
    onUploadImage: (file: File) => void;
    onCopyImagePrompt: () => void;
    isLoading: boolean;
    loadingId: string | null;
}

const CharacterCard: React.FC<CharacterCardProps> = ({
    character, onUpdate, onRemove, onGenerateDetails,
    onGenerateImage, onUploadImage, onCopyImagePrompt,
    isLoading, loadingId
}) => {
    const handleChange = (field: keyof Omit<Character, 'id' | 'imageUrl'>, value: string) => {
        onUpdate({ ...character, [field]: value });
    };

    const isDetailsLoading = loadingId === `char_details_${character.id}`;
    const isImageLoading = loadingId === `char_image_${character.id}`;

    return (
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex flex-col md:flex-row gap-4 relative">
            <div className="flex-shrink-0 w-full md:w-32 h-32 flex items-center justify-center bg-gray-600 rounded-md">
                {isImageLoading ? (
                     <LoadingSpinner />
                ) : character.imageUrl ? (
                    <img src={character.imageUrl} alt={character.name} className="w-32 h-32 object-cover rounded-md" />
                ) : (
                    <span className="text-gray-400 text-center text-sm p-2">Generate or upload a portrait.</span>
                )}
            </div>
            <div className="flex-grow space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-grow space-y-2">
                        <input
                            type="text"
                            placeholder="Character Name"
                            value={character.name}
                            onChange={e => handleChange('name', e.target.value)}
                            className="w-full bg-gray-800 p-2 rounded-md border border-gray-600"
                        />
                        <textarea
                            placeholder="Physical Description"
                            value={character.description}
                            onChange={e => handleChange('description', e.target.value)}
                            className="w-full bg-gray-800 p-2 rounded-md border border-gray-600 h-20"
                        />
                    </div>
                     <div className="flex-shrink-0">
                        <button onClick={onGenerateDetails} disabled={isLoading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md transition text-sm disabled:bg-blue-800 flex items-center justify-center">
                            {isDetailsLoading ? <LoadingSpinner /> : 'Gen Details'}
                        </button>
                    </div>
                </div>
                 <textarea
                    placeholder="Bio / Personality"
                    value={character.bio}
                    onChange={e => handleChange('bio', e.target.value)}
                    className="w-full bg-gray-800 p-2 rounded-md border border-gray-600 h-16"
                />
                 <div className="flex flex-wrap gap-2 pt-2">
                     <button onClick={onGenerateImage} disabled={isLoading || !character.description} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-3 rounded-md transition text-sm disabled:bg-teal-800 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[120px]">
                        {isImageLoading ? <LoadingSpinner /> : <RefreshIcon className="h-4 w-4" />}
                        {character.imageUrl ? 'Regen' : 'Gen'} Portrait
                    </button>
                    <label className="flex-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition text-sm flex items-center justify-center gap-2 min-w-[120px]">
                        <UploadIcon className="h-4 w-4" /> Upload
                        <input type="file" accept="image/*" className="hidden" disabled={isLoading} onChange={(e) => { if (e.target.files?.[0]) onUploadImage(e.target.files[0]) }} />
                    </label>
                    <button onClick={onCopyImagePrompt} disabled={!character.description} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-md transition text-sm disabled:opacity-50 flex items-center justify-center gap-2 min-w-[120px]">
                        <CopyIcon className="h-4 w-4" /> Copy Prompt
                    </button>
                </div>
            </div>
            
            <button
                onClick={() => onRemove(character.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition"
            >
                <TrashIcon />
            </button>
        </div>
    );
};

export default CharacterCard;
