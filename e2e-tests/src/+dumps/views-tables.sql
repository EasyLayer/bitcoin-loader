-- Drop the blocks table if it already exists
DROP TABLE IF EXISTS blocks;

-- Create the blocks table
CREATE TABLE blocks (
    hash VARCHAR PRIMARY KEY,
    height INTEGER NOT NULL,
    previousblockhash VARCHAR,
    is_suspended INTEGER NOT NULL DEFAULT 0,
    tx TEXT NOT NULL
);

-- Drop the system table if it already exists
DROP TABLE IF EXISTS system;

-- Create the system table
CREATE TABLE system (
    id INTEGER PRIMARY KEY,
    last_block_height INTEGER NOT NULL
);