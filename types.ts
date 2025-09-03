export enum GamePhase {
    SETUP = 'setup',
    PLAY = 'play',
    EXPORT = 'export'
}

export type ChoicePrediction = 'good' | 'bad' | 'mixed' | 'none';

export interface Choice {
    id: string;
    text: string;
    nextNodeId: string | null;
    isChosen: boolean;
    prediction: ChoicePrediction;
    predictionRationale: string;
}

export interface StoryNode {
    id:string;
    dialogue: string;
    illustrationUrl?: string; // base64 string
    choices: Choice[];
}

export interface Story {
    title: string;
    coverImageUrl: string; // base64 string
    prompt: string;
    artStyle: string;
    endingConditions: {
        good: number;
        bad: number;
        mixed: number;
    };
    nodes: Record<string, StoryNode>;
    startNodeId: string;
    endNodeIds: string[];
}

export interface Character {
    id: string;
    name: string;
    description: string;
    bio: string;
    imageUrl: string;
}