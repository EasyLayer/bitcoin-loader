CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aggregateId VARCHAR NOT NULL,
  extra VARCHAR DEFAULT NULL,
  version INT DEFAULT 0,
  requestId VARCHAR DEFAULT NULL,
  type VARCHAR NOT NULL,
  payload JSON NOT NULL
);

CREATE UNIQUE INDEX UQ__request_id__aggregate_id ON events (requestId, aggregateId);
CREATE UNIQUE INDEX UQ__version__aggregate_id ON events (version, aggregateId);
