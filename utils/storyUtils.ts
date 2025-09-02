import { Story, StoryNode, ChoicePrediction } from '../types';

/**
 * Generates a stable mapping from node ID to a sequential page number.
 * Uses a breadth-first search starting from the start node to ensure a logical page order.
 * Appends any orphaned/unreachable nodes at the end.
 * @param nodes - The record of all story nodes.
 * @param startNodeId - The ID of the story's starting node.
 * @returns A Map where keys are node IDs and values are page numbers.
 */
export const generatePageMap = (nodes: Record<string, StoryNode>, startNodeId: string): Map<string, number> => {
    const pageMap = new Map<string, number>();
    if (!nodes[startNodeId]) return pageMap;

    const queue: string[] = [startNodeId];
    const visited = new Set<string>([startNodeId]);
    let pageCounter = 1;

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        pageMap.set(nodeId, pageCounter++);

        const node = nodes[nodeId];
        if (node) {
            for (const choice of node.choices) {
                if (choice.nextNodeId && !visited.has(choice.nextNodeId)) {
                    // Check if the target node actually exists to prevent errors
                    if (nodes[choice.nextNodeId]) {
                        visited.add(choice.nextNodeId);
                        queue.push(choice.nextNodeId);
                    }
                }
            }
        }
    }

    // Add any orphaned nodes that weren't reached by the traversal
    const sortedOrphanIds = Object.keys(nodes).filter(nodeId => !pageMap.has(nodeId)).sort();
    
    sortedOrphanIds.forEach(nodeId => {
        pageMap.set(nodeId, pageCounter++);
    });

    return pageMap;
};


/**
 * Creates a map of child node IDs to their parent node IDs for efficient path traversal.
 * @param story - The full story object.
 * @returns A Map where keys are child node IDs and values are parent node IDs.
 */
export const getParentMap = (story: Story): Map<string, string> => {
    const parentMap = new Map<string, string>();
    for (const nodeId in story.nodes) {
        for (const choice of story.nodes[nodeId].choices) {
            if (choice.nextNodeId) {
                parentMap.set(choice.nextNodeId, nodeId);
            }
        }
    }
    return parentMap;
};

/**
 * Calculates the cumulative score of good, bad, and mixed choices along the path to a target node.
 * It traces back from the target node to the start node using a parent map.
 * @param story - The full story object.
 * @param targetNodeId - The ID of the node to calculate the path score for.
 * @param parentMap - A pre-computed map of child-to-parent node relationships.
 * @returns An object containing the counts of good, bad, and mixed choices.
 */
export const calculatePathScores = (
    story: Story,
    targetNodeId: string,
    parentMap: Map<string, string>
): { good: number; bad: number; mixed: number } => {
    const scores: { good: number; bad: number; mixed: number } = { good: 0, bad: 0, mixed: 0 };

    // Build the path from start to target by tracing back from the target
    const path: string[] = [];
    let currentId: string | undefined = targetNodeId;
    while (currentId) {
        path.unshift(currentId);
        if (currentId === story.startNodeId) break;
        currentId = parentMap.get(currentId);
    }
    
    if (path[0] !== story.startNodeId) {
        // Path is not connected to the start, so scores are 0
        return scores;
    }

    // Traverse the reconstructed path and sum up choice predictions
    for (let i = 0; i < path.length - 1; i++) {
        const parentId = path[i];
        const childId = path[i + 1];
        const parentNode = story.nodes[parentId];

        if (parentNode) {
            const chosenChoice = parentNode.choices.find(c => c.nextNodeId === childId);
            if (chosenChoice && chosenChoice.prediction !== 'none') {
                scores[chosenChoice.prediction]++;
            }
        }
    }

    return scores;
};