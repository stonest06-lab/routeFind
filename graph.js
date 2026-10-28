let prisma;

function getPrismaClient() {
  if (!prisma) {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  }

  return prisma;
}

// 1. 특정 건물 및 층의 노드 조회
async function getNodesByFloor(buildingId, floorId) {
  try {
    const nodes = await getPrismaClient().node.findMany({
      where: {
        buildingId: buildingId,
        floorId: floorId
      },
      select: {
        nodeId: true,
        floorId: true,
        nodeName: true,
        nodeType: true,
        x: true,
        y: true
      }
    });

    console.log(`[${buildingId} - ${floorId}] 노드 목록:`, nodes);
    return nodes;
  } catch (error) {
    console.error('노드 조회 에러:', error);
  }
}

async function getElevatorNodeIdByNodeId(nodeId) {
  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    throw new TypeError('nodeId must be a positive integer');
  }

  const currentNode = await getPrismaClient().node.findUnique({
    where: { nodeId },
    select: {
      nodeId: true,
      floorId: true,
      nodeType: true
    }
  });

  if (!currentNode) return null;

  // 이미 엘리베이터 노드면 그대로 반환
  if (currentNode.nodeType === 'ELEVATOR') {
    return currentNode.nodeId;
  }

  // 같은 floor_id 안에서 ELEVATOR 노드 찾기
  const elevatorNode = await getPrismaClient().node.findFirst({
    where: {
      floorId: currentNode.floorId,
      nodeType: 'ELEVATOR'
    },
    select: {
      nodeId: true
    }
  });

  return elevatorNode?.nodeId ?? null;
}
// 2. 강의실 번호로 정보 및 노드 좌표 조회
async function getClassroomInfo(roomNumber) {
  try {
    const classroom = await getPrismaClient().classroom.findFirst({
      where: {
        roomNumber: roomNumber
      },
      select: {
        facilityId: true,
        roomNumber: true,
        name: true,
        hasComputerLab: true,
        node: {
          select: {
            nodeId: true,
            buildingId: true,
            floorId: true,
            x: true,
            y: true
          }
        }
      }
    });

    console.log(`[${roomNumber}] 강의실 조회 결과:`, classroom);
    return classroom;
  } catch (error) {
    console.error('강의실 조회 에러:', error);
  }
}

// 3. 길찾기용 전체 간선(Edges) 조회
async function getEdges() {
  try {
    const edges = await getPrismaClient().edge.findMany({
      select: {
        edgeId: true,
        startNodeId: true,
        endNodeId: true,
        weight: true
      }
    });

    console.log('전체 간선 데이터:', edges);
    return edges;
  } catch (error) {
    console.error('간선 조회 에러:', error);
  }
}

async function main() {
  // 실제 DB 내의 데이터 조건에 맞게 인자값을 넣어 실행합니다.
  await getNodesByFloor('HAMBAK', 'FL_01');
  await getClassroomInfo('S1101');
  await getEdges();
}

if (require.main === module) {
  main()
    .catch((e) => console.error(e))
    .finally(async () => {
      if (prisma) {
        await prisma.$disconnect();
      }
    });
}

class Graph {
  constructor(nodes = [], edges = []) {
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      throw new TypeError('nodes and edges must be arrays');
    }

    this.adjacencyList = new Map();
    this.edgeWeights = new Map();
    this.nodeMetadata = new Map();

    for (const node of nodes) {
      const nodeId =
        typeof node === 'object' && node !== null ? node.nodeId : node;
      this.addVertex(nodeId, typeof node === 'object' && node !== null ? node : undefined);
    }

    for (const edge of edges) {
      if (edge === null || typeof edge !== 'object') {
        throw new TypeError('each edge must be an object');
      }

      this.addEdge(edge.startNodeId, edge.endNodeId, edge.weight);
    }
  }

  addVertex(vertexId, metadata) {
    if (!Number.isInteger(vertexId)) {
      throw new TypeError('vertex ID must be an integer');
    }

    if (!this.adjacencyList.has(vertexId)) {
      this.adjacencyList.set(vertexId, new Set());
    }

    if (metadata !== undefined) {
      this.nodeMetadata.set(vertexId, metadata);
    }
  }

  addEdge(startNodeId, endNodeId, weight) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError('edge weight must be a non-negative finite number');
    }

    this.addVertex(startNodeId);
    this.addVertex(endNodeId);

    this.adjacencyList.get(startNodeId).add(endNodeId);
    this.edgeWeights.set(this.#edgeKey(startNodeId, endNodeId), weight);
  }

  getNumVertices() {
    return this.adjacencyList.size;
  }

  getVertices() {
    return [...this.adjacencyList.keys()];
  }

  getFloorId(vertexId) {
    if (!this.adjacencyList.has(vertexId)) {
      throw new RangeError(`unknown vertex ID: ${vertexId}`);
    }

    return this.nodeMetadata.get(vertexId)?.floorId;
  }

  getElevatorNodeIdByNodeId(vertexId) {
    if (!this.adjacencyList.has(vertexId)) {
      throw new RangeError(`unknown vertex ID: ${vertexId}`);
    }

    const node = this.nodeMetadata.get(vertexId);
    if (!node?.floorId) {
      throw new Error(`floor metadata is missing for vertex ID: ${vertexId}`);
    }
    if (node.nodeType === 'ELEVATOR') {
      return vertexId;
    }

    for (const [candidateId, candidate] of this.nodeMetadata) {
      if (candidate.floorId === node.floorId && candidate.nodeType === 'ELEVATOR') {
        return candidateId;
      }
    }

    return null;
  }

  getNeighbors(vertexId) {
    const neighbors = this.adjacencyList.get(vertexId);
    if (!neighbors) {
      throw new RangeError(`unknown vertex ID: ${vertexId}`);
    }

    return [...neighbors];
  }

  getEdgeWeight(startNodeId, endNodeId) {
    if (!this.adjacencyList.has(startNodeId)) {
      throw new RangeError(`unknown vertex ID: ${startNodeId}`);
    }
    if (!this.adjacencyList.has(endNodeId)) {
      throw new RangeError(`unknown vertex ID: ${endNodeId}`);
    }

    return this.edgeWeights.get(this.#edgeKey(startNodeId, endNodeId)) ?? Infinity;
  }

  #edgeKey(startNodeId, endNodeId) {
    return `${startNodeId}:${endNodeId}`;
  }
}

module.exports = {
  Graph,
  getNodesByFloor,
  getElevatorNodeIdByNodeId,
  getClassroomInfo,
  getEdges
};