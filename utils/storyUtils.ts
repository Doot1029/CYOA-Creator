import { StoryNode } from '../types';

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
