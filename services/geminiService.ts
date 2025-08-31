import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Story, StoryNode, Choice, ChoicePrediction } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const safelyParseJSON = <T,>(jsonString: string): T | null => {
    try {
        // Find the start and end of the JSON content
        const startIndex = jsonString.indexOf('{');
        const endIndex = jsonString.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) {
            const arrayStartIndex = jsonString.indexOf('[');
            const arrayEndIndex = jsonString.lastIndexOf(']');
            if(arrayStartIndex !== -1 && arrayEndIndex !== -1) {
                 const correctedJSON = jsonString.substring(arrayStartIndex, arrayEndIndex + 1);
                 return JSON.parse(correctedJSON) as T;
            }
            console.error("No JSON object or array found in the string.");
            return null;
        }
        const correctedJSON = jsonString.substring(startIndex, endIndex + 1);
        return JSON.parse(correctedJSON) as T;
    } catch (error) {
        console.error("Failed to parse JSON:", error, "Raw string:", jsonString);
        return null;
    }
};


export const generateStoryPrompt = async (): Promise<string> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Generate a one-sentence story prompt for a choose-your-own-adventure visual novel. The theme should be fantasy, sci-fi, or mystery.',
    });
    return response.text.trim();
};

export const generateTitle = async (storyPrompt: string): Promise<string> => {
     const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a short, catchy, and creative title for a visual novel with the following prompt: "${storyPrompt}"`,
    });
    return response.text.trim().replace(/"/g, ''); // Remove quotes from the response
}

export const generateImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4'): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
    });

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const generateInitialStoryNode = async (story: Omit<Story, 'nodes' | 'startNodeId' | 'endNodeIds' | 'coverImageUrl'>): Promise<Omit<StoryNode, 'id'>> => {
    const prompt = `
        This is the start of a choose-your-own-adventure story.
        Story Prompt: ${story.prompt}

        Write the very first scene of the story as a single block of text. It should be an engaging introduction that sets the scene.
        Then, provide 3 choices for the player to make.
        For each choice, provide a 'prediction' field: 'good' (likely positive outcome), 'bad' (likely negative outcome), or 'ending' (moves story to conclusion).
        Also provide a 'predictionRationale' field explaining your prediction in one short sentence.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    dialogue: {
                        type: Type.STRING,
                        description: "The script for the scene, as a single block of text.",
                    },
                    choices: {
                        type: Type.ARRAY,
                        description: "The choices for the player.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "The text for a choice the player can make." },
                                prediction: { type: Type.STRING, description: "The predicted outcome: 'good', 'bad', or 'ending'." },
                                predictionRationale: { type: Type.STRING, description: "A brief justification for the prediction." }
                            }
                        }
                    }
                }
            }
        }
    });

    const result = safelyParseJSON<{dialogue: string, choices: {text: string, prediction: ChoicePrediction, predictionRationale: string}[] }>(response.text);
    if (!result) throw new Error("Failed to generate initial story node.");

    return {
        dialogue: result.dialogue,
        choices: result.choices.map(c => ({ id: `choice_${Date.now()}_${Math.random()}`, text: c.text, nextNodeId: null, prediction: c.prediction, predictionRationale: c.predictionRationale }))
    };
};

export const generateStoryNode = async (story: Story, fromNodeId: string, choiceMade: Choice): Promise<Omit<StoryNode, 'id'>> => {
    const previousNode = story.nodes[fromNodeId];
    
    const prompt = `
        Continue a choose-your-own-adventure story based on the previous events and the user's choice.
        
        Overall Story Prompt: ${story.prompt}

        Previous Scene:
        ${previousNode.dialogue}

        Player's Choice:
        "${choiceMade.text}"
        This choice was predicted to have a '${choiceMade.prediction || 'neutral'}' outcome. AI Rationale: "${choiceMade.predictionRationale || 'N/A'}"

        Instructions:
        1. Write the next part of the story as a single block of text. The outcome MUST align with the choice's prediction ('${choiceMade.prediction || 'neutral'}').
        2. Provide 3 new, distinct choices for the player to continue the adventure.
        3. For each new choice, provide a 'prediction' ('good', 'bad', or 'ending') and a short 'predictionRationale'.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    dialogue: {
                        type: Type.STRING,
                        description: "The script for the new scene, as a single block of text.",
                    },
                    choices: {
                        type: Type.ARRAY,
                        description: "The new choices for the player.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "The text for a new choice." },
                                prediction: { type: Type.STRING, description: "The predicted outcome: 'good', 'bad', or 'ending'." },
                                predictionRationale: { type: Type.STRING, description: "A brief justification for the prediction." }
                            }
                        }
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 0 },
        }
    });

    const result = safelyParseJSON<{dialogue: string, choices: {text: string, prediction: ChoicePrediction, predictionRationale: string}[]}>(response.text);
    if (!result) throw new Error("Failed to generate next story node.");

    return {
        dialogue: result.dialogue,
        choices: result.choices.map(c => ({ id: `choice_${Date.now()}_${Math.random()}`, text: c.text, nextNodeId: null, prediction: c.prediction, predictionRationale: c.predictionRationale }))
    };
};

export const generateStoryNodeForEnding = async (story: Story, fromNodeId: string, choiceMade: Choice, step: number, totalSteps: number): Promise<Omit<StoryNode, 'id'>> => {
    const previousNode = story.nodes[fromNodeId];
    
    const prompt = `
        Continue a choose-your-own-adventure story, moving it towards a conclusion. This is step ${step} of ${totalSteps} in the ending sequence.
        
        Overall Story Prompt: ${story.prompt}

        Previous Scene:
        ${previousNode.dialogue}

        Player's Choice That Started Ending Sequence:
        "${choiceMade.text}"

        Instructions:
        1. Write the next part of the story as a single block of text. It should clearly progress the story towards a final resolution, consistent with an 'ending' path.
        2. Provide 2 new, distinct choices for the player that continue down this path to the end.
        3. For each choice, provide a 'prediction' (which should be 'ending') and a 'predictionRationale'.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    dialogue: {
                        type: Type.STRING,
                        description: "The script for the new scene, progressing to the end.",
                    },
                    choices: {
                        type: Type.ARRAY,
                        description: "The new choices for the player.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "The text for a new choice." },
                                prediction: { type: Type.STRING, description: "The predicted outcome. Use 'ending'." },
                                predictionRationale: { type: Type.STRING, description: "A brief justification for the prediction." }
                            }
                        }
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 0 },
        }
    });

    const result = safelyParseJSON<{dialogue: string, choices: {text: string, prediction: ChoicePrediction, predictionRationale: string}[]}>(response.text);
    if (!result) throw new Error("Failed to generate next story node for ending.");

    return {
        dialogue: result.dialogue,
        choices: result.choices.map(c => ({ id: `choice_${Date.now()}_${Math.random()}`, text: c.text, nextNodeId: null, prediction: c.prediction, predictionRationale: c.predictionRationale }))
    };
};

export const generateFinalEndingNode = async (story: Story, fromNodeId: string, choiceMade: Choice): Promise<{ dialogue: string }> => {
    const previousNode = story.nodes[fromNodeId];
    
    const prompt = `
        This is the final scene of a choose-your-own-adventure story. Write a definitive conclusion based on the story so far and the final choice made.
        
        Overall Story Prompt: ${story.prompt}

        Previous Scene:
        ${previousNode.dialogue}

        Player's Final Choice:
        "${choiceMade.text}"

        Instructions:
        1. Write the final, concluding scene for the story as a single block of text.
        2. This is the definitive end. Wrap up major plot points.
        3. DO NOT provide any choices.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    dialogue: {
                        type: Type.STRING,
                        description: "The final, concluding script for the story.",
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 0 },
        }
    });

    const result = safelyParseJSON<{dialogue: string}>(response.text);
    if (!result) throw new Error("Failed to generate final ending node.");

    return { dialogue: result.dialogue };
};