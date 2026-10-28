PRAGMA foreign_keys = ON;

-- 1. 건물 정보
CREATE TABLE IF NOT EXISTS buildings (
                                         building_id   TEXT PRIMARY KEY,
                                         building_name TEXT NOT NULL
);

-- 2. 층 정보
CREATE TABLE IF NOT EXISTS floors (
                                      floor_id    TEXT PRIMARY KEY,
                                      building_id TEXT NOT NULL,
                                      floor       INTEGER NOT NULL,   -- 함박관 B1층은 0
                                      floor_name  TEXT NOT NULL,
                                      svg_url     TEXT,
                                      FOREIGN KEY (building_id) REFERENCES buildings(building_id),
                                      UNIQUE (building_id, floor)
);

-- 3. 길찾기 노드
CREATE TABLE IF NOT EXISTS nodes (
                                     node_id     INTEGER PRIMARY KEY,
                                     building_id TEXT NOT NULL,
                                     floor_id    TEXT NOT NULL,
                                     node_name   TEXT,
                                     node_type   TEXT NOT NULL
                                         CHECK (node_type IN (
                                                              'ENTRANCE',
                                                              'CORRIDOR',
                                                              'CLASSROOM',
                                                              'ELEVATOR'
                                             )),
                                     x REAL NOT NULL,                -- SVG viewBox 기준
                                     y REAL NOT NULL,                -- SVG viewBox 기준
                                     FOREIGN KEY (building_id) REFERENCES buildings(building_id),
                                     FOREIGN KEY (floor_id)    REFERENCES floors(floor_id)
);

-- 4. 강의실 정보
CREATE TABLE IF NOT EXISTS classrooms (
                                          facility_id      TEXT PRIMARY KEY,
                                          node_id          INTEGER NOT NULL,
                                          room_number      TEXT NOT NULL,
                                          name             TEXT,
                                          has_computer_lab INTEGER NOT NULL DEFAULT 0
                                              CHECK (has_computer_lab IN (0, 1)),
                                          FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE
);

-- 5. 길찾기 간선 정보
CREATE TABLE IF NOT EXISTS edges (
                                     edge_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                                     start_node_id INTEGER NOT NULL,
                                     end_node_id   INTEGER NOT NULL,
                                     weight        REAL NOT NULL CHECK (weight >= 0),
                                     FOREIGN KEY (start_node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
                                     FOREIGN KEY (end_node_id)   REFERENCES nodes(node_id) ON DELETE CASCADE,
                                     UNIQUE (start_node_id, end_node_id),
                                     CHECK (start_node_id <> end_node_id)
);

-- 검색 및 길찾기 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_nodes_floor
    ON nodes(building_id, floor_id);

CREATE INDEX IF NOT EXISTS idx_classrooms_room
    ON classrooms(room_number);

CREATE INDEX IF NOT EXISTS idx_edges_start
    ON edges(start_node_id);