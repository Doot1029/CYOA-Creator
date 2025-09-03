import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Story, StoryNode, Choice, ChoicePrediction } from '../types';

let ai: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI client.
 * Throws an error if the API key is not available in the environment.
 */
const getAi = (): GoogleGenAI => {
    if (ai) {
        return ai;
    }
    
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        // This error will be caught by the calling function and displayed to the user.
        throw new Error("Gemini API key not found. Please ensure the API_KEY environment variable is set in your hosting provider's settings.");
    }

    ai = new GoogleGenAI({ apiKey });
    return ai;
};

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


export const generateStoryPrompt = async (genre: string): Promise<string> => {
    const gemini = getAi();
    const response: GenerateContentResponse = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a one-sentence story prompt for a choose-your-own-adventure visual novel. The genre must be: ${genre}.`,
    });
    return response.text.trim();
};

export const generateTitle = async (storyPrompt: string): Promise<string> => {
    const gemini = getAi();
     const response: GenerateContentResponse = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a single, short, creative title for a visual novel based on this prompt: "${storyPrompt}". Respond with ONLY the title text. Do not include quotation marks, labels, or any other descriptive text.`,
    });
    return response.text.trim().replace(/"/g, ''); // Remove quotes from the response
}

export const generateCoverArtPromptKeywords = async (title: string, storyPrompt: string, artStyle: string): Promise<string> => {
    const gemini = getAi();
    const prompt = `
        You are an AI assistant for creating art prompts. Generate a concise, comma-separated list of keywords for a book cover based on the provided details.
        The output should be a single line of text. Do not use descriptive sentences.
        The keywords should include the main subject, setting, mood, and the specified art style.
        
        Details:
        - Title: "${title}"
        - Story Prompt: "${storyPrompt}"
        - Art Style: "${artStyle}"

        Example output: book cover, title: The Last Dragon, epic fantasy, a lone knight facing a giant red dragon, fiery mountain peak, dramatic lighting, digital painting
    `;
    const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text.trim().replace(/\n/g, ''); // Ensure single line
};

export const generateIllustrationPromptKeywords = async (sceneDialogue: string, artStyle: string): Promise<string> => {
    const gemini = getAi();
    const prompt = `
        You are an AI assistant for creating art prompts. Generate a concise, comma-separated list of keywords for a visual novel illustration based on the provided scene dialogue.
        The output should be a single line of text. Do not use descriptive sentences.
        The keywords should describe the key characters, actions, setting, mood, and the specified art style.
        
        Details:
        - Scene Dialogue: "${sceneDialogue}"
        - Art Style: "${artStyle}"

        Example output: anime style, two characters arguing, medieval tavern, dimly lit, intense emotion, wooden table, mugs of ale
    `;
    const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text.trim().replace(/\n/g, ''); // Ensure single line
};


export const generateImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '3:4'): Promise<string> => {
    const gemini = getAi();
    const response = await gemini.models.generateImages({
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
    const gemini = getAi();
    const prompt = `
        This is the start of a choose-your-own-adventure story.
        Story Prompt: ${story.prompt}

        Write the very first scene of the story as a single block of text. It should be an engaging introduction that sets the scene.
        Then, provide 3 choices for the player to make.
        For each choice, provide a 'prediction' field: 'good' (likely positive outcome), 'bad' (likely negative outcome), or 'mixed' (a combination of good and bad outcomes, or an ambiguous result).
        Also provide a 'predictionRationale' field explaining your prediction in one short sentence.
    `;
    
    const response = await gemini.models.generateContent({
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
                                prediction: { type: Type.STRING, description: "The predicted outcome: 'good', 'bad', or 'mixed'." },
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
        choices: result.choices.map(c => ({ 
            id: `choice_${Date.now()}_${Math.random()}`, 
            text: c.text, 
            nextNodeId: null, 
            isChosen: false,
            prediction: c.prediction || 'none', 
            predictionRationale: c.predictionRationale || 'No rationale provided by AI.' 
        }))
    };
};

export const generateStoryNode = async (story: Story, fromNodeId: string, choiceMade: Choice, pathScores: { good: number; bad: number; mixed: number; }): Promise<Omit<StoryNode, 'id'>> => {
    const gemini = getAi();
    const previousNode = story.nodes[fromNodeId];

    const { good, bad, mixed } = pathScores;
    const { good: goodTarget, bad: badTarget, mixed: mixedTarget } = story.endingConditions;

    let endingType: 'good' | 'bad' | 'mixed' | null = null;
    if (good >= goodTarget) endingType = 'good';
    else if (bad >= badTarget) endingType = 'bad';
    else if (mixed >= mixedTarget) endingType = 'mixed';

    let instructions: string;
    let responseSchema: any;

    if (endingType) {
        instructions = `
        CRITICAL INSTRUCTION: The player's actions have led to the '${endingType}' ending.
        1. Write the final, concluding scene for the story that reflects a '${endingType}' outcome based on the story so far.
        2. This is the definitive end. Wrap up the story.
        3. DO NOT provide any choices. The 'choices' array in your JSON response MUST be empty.
        `;
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                dialogue: {
                    type: Type.STRING,
                    description: `The final concluding script for the '${endingType}' ending.`
                },
                choices: {
                    type: Type.ARRAY,
                    description: "This MUST be an empty array as it is an ending.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            prediction: { type: Type.STRING },
                            predictionRationale: { type: Type.STRING }
                        }
                    }
                }
            }
        };
    } else {
        instructions = `
        The player has not yet reached an ending.
        Current path score: ${good} good, ${bad} bad, ${mixed} mixed choices.
        Ending requires: ${goodTarget} good, ${badTarget} bad, or ${mixedTarget} mixed choices.
        
        Instructions:
        1. Write the next part of the story as a single block of text. The outcome MUST align with the choice's prediction ('${choiceMade.prediction || 'neutral'}').
        2. Provide 3 new, distinct choices for the player to continue the adventure.
        3. For each new choice, provide a 'prediction' ('good', 'bad', or 'mixed') and a short 'predictionRationale'.
        `;
        responseSchema = {
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
                            prediction: { type: Type.STRING, description: "The predicted outcome: 'good', 'bad', or 'mixed'." },
                            predictionRationale: { type: Type.STRING, description: "A brief justification for the prediction." }
                        }
                    }
                }
            }
        };
    }

    const prompt = `
        Continue a choose-your-own-adventure story based on the previous events and the user's choice.
        
        Overall Story Prompt: ${story.prompt}

        Previous Scene:
        ${previousNode.dialogue}

        Player's Choice:
        "${choiceMade.text}"
        This choice was predicted to have a '${choiceMade.prediction || 'neutral'}' outcome. AI Rationale: "${choiceMade.predictionRationale || 'N/A'}"

        ${instructions}
    `;

    const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
            thinkingConfig: { thinkingBudget: 0 },
        }
    });

    const result = safelyParseJSON<{dialogue: string, choices: {text: string, prediction: ChoicePrediction, predictionRationale: string}[]}>(response.text);
    if (!result) throw new Error("Failed to generate next story node.");

    return {
        dialogue: result.dialogue,
        choices: result.choices ? result.choices.map(c => ({ 
            id: `choice_${Date.now()}_${Math.random()}`, 
            text: c.text, 
            nextNodeId: null, 
            isChosen: false,
            prediction: c.prediction || 'none', 
            predictionRationale: c.predictionRationale || 'No rationale provided by AI.' 
        })) : []
    };
};

export const regenerateChoices = async (story: Story, nodeId: string): Promise<{ choices: Omit<Choice, 'id' | 'nextNodeId' | 'isChosen'>[] }> => {
    const gemini = getAi();
    const node = story.nodes[nodeId];

    const prompt = `
        You are an assistant for a choose-your-own-adventure game creator.
        The overall story prompt is: "${story.prompt}"
        The current scene's text is: "${node.dialogue}"

        The author is unhappy with the current choices and wants a new set.
        
        Instructions:
        1. Generate exactly 3 new, creative, and distinct choices based on the scene's text.
        2. Do NOT repeat any of the previous choices.
        3. For each new choice, provide a 'prediction' of the outcome ('good', 'bad', or 'mixed').
        4. For each prediction, provide a short 'predictionRationale'.
    `;

    const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    choices: {
                        type: Type.ARRAY,
                        description: "The new choices for the player.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "The text for a new choice." },
                                prediction: { type: Type.STRING, description: "The predicted outcome: 'good', 'bad', or 'mixed'." },
                                predictionRationale: { type: Type.STRING, description: "A brief justification for the prediction." }
                            }
                        }
                    }
                }
            },
            thinkingConfig: { thinkingBudget: 0 },
        }
    });

    const result = safelyParseJSON<{choices: {text: string, prediction: ChoicePrediction, predictionRationale: string}[]}>(response.text);
    if (!result || !result.choices) throw new Error("Failed to regenerate choices.");

    return {
        choices: result.choices,
    };
};

export const editStoryNodeDialogue = async (originalDialogue: string, userPrompt: string): Promise<{ newDialogue: string }> => {
    const gemini = getAi();
    const prompt = `
        You are an expert story editor. A user wants to revise a piece of dialogue from their choose-your-own-adventure story.
        
        Original Dialogue:
        ---
        ${originalDialogue}
        ---

        User's instruction for the edit: "${userPrompt}"

        Instructions:
        1. Rewrite the "Original Dialogue" according to the user's instruction.
        2. Keep the tone and style consistent with the original text unless the instruction says otherwise.
        3. Only output the revised dialogue text. Do not add any extra commentary, introductions, or quotation marks around the text.
    `;

    const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    const newDialogue = response.text.trim();
    if (!newDialogue) throw new Error("AI failed to generate an edit.");

    return { newDialogue };
};