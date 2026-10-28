class RouteFinder {
  #graph;

  constructor(graph) {
    if (
      !graph ||
      typeof graph.getVertices !== 'function' ||
      typeof graph.getNeighbors !== 'function' ||
      typeof graph.getEdgeWeight !== 'function' ||
      typeof graph.getFloorId !== 'function' ||
      typeof graph.getElevatorNodeIdByNodeId !== 'function'
    ) {
      throw new TypeError('graph must provide the Graph interface');
    }

    this.#graph = graph;
  }

  #getMinDistanceVertex(distances, visited) {
    let minDistance = Infinity;
    let minVertex;

    for (const [vertex, distance] of distances) {
      if (!visited.has(vertex) && distance < minDistance) {
        minDistance = distance;
        minVertex = vertex;
      }
    }

    return minVertex;
  }

  dijkstra(startVertex, endVertex) {
    const vertices = this.#graph.getVertices();
    const vertexSet = new Set(vertices);

    if (!vertexSet.has(startVertex)) {
      throw new RangeError(`unknown start vertex ID: ${startVertex}`);
    }
    if (!vertexSet.has(endVertex)) {
      throw new RangeError(`unknown end vertex ID: ${endVertex}`);
    }

    const distances = new Map(vertices.map((vertex) => [vertex, Infinity]));
    const previous = new Map(vertices.map((vertex) => [vertex, undefined]));
    const visited = new Set();
    distances.set(startVertex, 0);

    for (let i = 0; i < vertices.length; i += 1) {
      const currentVertex = this.#getMinDistanceVertex(distances, visited);

      if (
        currentVertex === undefined ||
        distances.get(currentVertex) === Infinity
      ) {
        break;
      }

      visited.add(currentVertex);
      if (currentVertex === endVertex) {
        break;
      }

      for (const neighbor of this.#graph.getNeighbors(currentVertex)) {
        const weight = this.#graph.getEdgeWeight(currentVertex, neighbor);
        if (visited.has(neighbor) || !Number.isFinite(weight)) {
          continue;
        }

        const newDistance = distances.get(currentVertex) + weight;
        if (newDistance < distances.get(neighbor)) {
          distances.set(neighbor, newDistance);
          previous.set(neighbor, currentVertex);
        }
      }
    }

    if (distances.get(endVertex) === Infinity) {
      return [];
    }

    const path = [];
    for (
      let currentVertex = endVertex;
      currentVertex !== undefined;
      currentVertex = previous.get(currentVertex)
    ) {
      path.push(currentVertex);
    }

    path.reverse();
    return path;
  }

  findShortestPath(startVertex, endVertex) {
    const startFloorId = this.#graph.getFloorId(startVertex);
    const endFloorId = this.#graph.getFloorId(endVertex);

    if (startFloorId === undefined || endFloorId === undefined) {
      throw new Error('floor metadata is required to find a route');
    }

    if (startFloorId === endFloorId) {
      return this.dijkstra(startVertex, endVertex);
    }

    const startElevator = this.#graph.getElevatorNodeIdByNodeId(startVertex);
    const endElevator = this.#graph.getElevatorNodeIdByNodeId(endVertex);

    if (startElevator === null || endElevator === null) {
      return [];
    }

    const pathToElevator = this.dijkstra(startVertex, startElevator);
    const pathFromElevator = this.dijkstra(endElevator, endVertex);

    if (pathToElevator.length === 0 || pathFromElevator.length === 0) {
      return [];
    }

    return [...pathToElevator, ...pathFromElevator];
  }
}

module.exports = RouteFinder;
