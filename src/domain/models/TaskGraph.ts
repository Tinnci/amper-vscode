export interface TaskNode {
    id: string;
    name: string;
    module?: string;
}

export interface TaskEdge {
    from: string; // task id
    to: string;   // task id
}

export interface TaskGraph {
    nodes: TaskNode[];
    edges: TaskEdge[];
    rootPath: string;
}
