/**
 * Nearest Neighbor Graph for Street Viewer
 * Manages spatial relationships between viewpoints
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ViewPointNode {
  id: string;
  imageUrl: string;
  position: Point3D;
  metadata?: Record<string, any>;
}

export interface Edge {
  from: string;
  to: string;
  distance: number;
  direction: number; // angle in degrees (0-360)
}

export class NearestNeighborGraph {
  private nodes: Map<string, ViewPointNode>;
  private edges: Map<string, Edge[]>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  /**
   * Add a viewpoint node to the graph
   */
  addNode(node: ViewPointNode): void {
    this.nodes.set(node.id, node);
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, []);
    }
  }

  /**
   * Remove a viewpoint node from the graph
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.edges.delete(nodeId);
    
    // Remove all edges pointing to this node
    for (const [fromId, edges] of this.edges.entries()) {
      this.edges.set(
        fromId,
        edges.filter(edge => edge.to !== nodeId)
      );
    }
  }

  /**
   * Add a directed edge between two nodes
   */
  addEdge(fromId: string, toId: string, distance: number, direction: number): void {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error('Both nodes must exist before adding an edge');
    }

    const edges = this.edges.get(fromId) || [];
    edges.push({ from: fromId, to: toId, distance, direction });
    this.edges.set(fromId, edges);
  }

  /**
   * Get all neighbors of a node
   */
  getNeighbors(nodeId: string): Edge[] {
    return this.edges.get(nodeId) || [];
  }

  /**
   * Get a specific node
   */
  getNode(nodeId: string): ViewPointNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): ViewPointNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private static calculateDistance(p1: Point3D, p2: Point3D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate direction angle from one point to another (in XZ plane)
   * Returns angle in degrees (0-360), where 0 is north (+Z), 90 is east (+X)
   */
  private static calculateDirection(from: Point3D, to: Point3D): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    let angle = Math.atan2(dx, dz) * (180 / Math.PI);
    
    // Normalize to 0-360
    if (angle < 0) angle += 360;
    
    return angle;
  }

  /**
   * Automatically connect nodes to their K nearest neighbors
   */
  buildKNearestNeighbors(k: number = 4): void {
    const nodes = Array.from(this.nodes.values());

    for (const node of nodes) {
      // Calculate distances to all other nodes
      const distances = nodes
        .filter(other => other.id !== node.id)
        .map(other => ({
          node: other,
          distance: NearestNeighborGraph.calculateDistance(node.position, other.position),
          direction: NearestNeighborGraph.calculateDirection(node.position, other.position)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, k);

      // Clear existing edges for this node
      this.edges.set(node.id, []);

      // Add edges to K nearest neighbors
      for (const { node: neighbor, distance, direction } of distances) {
        this.addEdge(node.id, neighbor.id, distance, direction);
      }
    }
  }

  /**
   * Connect nodes within a certain radius
   */
  buildRadiusNeighbors(radius: number): void {
    const nodes = Array.from(this.nodes.values());

    for (const node of nodes) {
      // Clear existing edges for this node
      this.edges.set(node.id, []);

      // Find all nodes within radius
      for (const other of nodes) {
        if (other.id === node.id) continue;

        const distance = NearestNeighborGraph.calculateDistance(node.position, other.position);
        
        if (distance <= radius) {
          const direction = NearestNeighborGraph.calculateDirection(node.position, other.position);
          this.addEdge(node.id, other.id, distance, direction);
        }
      }
    }
  }

  /**
   * Find the shortest path between two nodes using Dijkstra's algorithm
   */
  findShortestPath(startId: string, endId: string): string[] | null {
    if (!this.nodes.has(startId) || !this.nodes.has(endId)) {
      return null;
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    // Initialize
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }
    distances.set(startId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentId: string | null = null;
      let minDistance = Infinity;
      
      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId) || Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          currentId = nodeId;
        }
      }

      if (currentId === null || minDistance === Infinity) {
        break; // No path exists
      }

      if (currentId === endId) {
        break; // Found shortest path to destination
      }

      unvisited.delete(currentId);

      // Check neighbors
      const edges = this.getNeighbors(currentId);
      for (const edge of edges) {
        if (!unvisited.has(edge.to)) continue;

        const altDistance = (distances.get(currentId) || 0) + edge.distance;
        
        if (altDistance < (distances.get(edge.to) || Infinity)) {
          distances.set(edge.to, altDistance);
          previous.set(edge.to, currentId);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = endId;
    
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) || null;
      
      if (current === startId) {
        path.unshift(startId);
        break;
      }
    }

    return path.length > 1 ? path : null;
  }

  /**
   * Export graph to JSON
   */
  toJSON(): { nodes: ViewPointNode[]; edges: Edge[] } {
    const allEdges: Edge[] = [];
    for (const edges of this.edges.values()) {
      allEdges.push(...edges);
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: allEdges
    };
  }

  /**
   * Import graph from JSON
   */
  static fromJSON(data: { nodes: ViewPointNode[]; edges: Edge[] }): NearestNeighborGraph {
    const graph = new NearestNeighborGraph();

    // Add nodes
    for (const node of data.nodes) {
      graph.addNode(node);
    }

    // Add edges
    for (const edge of data.edges) {
      graph.addEdge(edge.from, edge.to, edge.distance, edge.direction);
    }

    return graph;
  }
}
