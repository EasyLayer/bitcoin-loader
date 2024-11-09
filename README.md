# Bitcoin Loader

Bitcoin Loader is a server-side application designed to read data via RPC from a blockchain node and save it into a SQL database (currently supporting SQLite and PostgreSQL). The purpose of Bitcoin Loader is to provide a tool that allows loading data from the blockchain and saving it in a relation database under any structure.

## Table of Contents

1. [Key Features](#key-features)
2. [Performance](#performance)
3. [How to Run](#how-to-run)
    - [a) Running from Source via Monorepo](#a-running-from-source-via-monorepo)
    - [b) Creating Your Own Loader with `@easylayer/bitcoin-loader`](#b-creating-your-own-loader-with-easylayerbitcoin-loader)

## Key Features

- **Self-Hosted Application**: Developers deploy and manage it themselves.
- **Flexible Connectivity**: Works with both your own blockchain node and custom providers like Quicknode.
- **Block Range Flexibility**: Can be started at any blockchain height range and supports real-time mode with automatic blockchain reorganization.
- **Schema Flexibility**: Developers can configure the Loader to extract data by blocks and load the relevant information into their chosen database schema.
- **Database Compatibility**: Supports SQLite and PostgreSQL.
- **Configuration Management**: Managed and configured using environment variables.
- **REST API Server**: Includes a ready-to-use REST API server for accessing loaded data.
------------
- **Example applications** based on the loader are available in the `examples` folder at the root of the `el` repository.
- Uses **Node.js** as the engine (version 18 or higher is important).

## Performance

Loader is engineered for high-speed operation, but actual performance is primarily influenced by two factors: network latency when fetching blocks from the blockchain and the efficiency of inserting large datasets into your SQL database, depending on your chosen schema structure.

In 99% of cases, performance bottlenecks arise from either network delays or database insertion speeds. To mitigate network latency, developers can increase the number of parallel requests to the node or provider and adjust the size of data transmitted per request through configuration parameters. Additionally, optimizing node settings can further reduce network delays.

When it comes to the database, performance tuning becomes more intricate. Database performance is multifaceted, depending on the complexity of your database schema, the presence of indexes, and the defined relationships. Loader is optimized for high-volume data insertion through several software-level optimizations:

- **UNLOGGED Databases**: Enabled by default to accelerate insertion speeds, with the option to disable if necessary.
- **COPY for Streaming Inserts**: Utilizes the COPY command for efficient, high-throughput data streaming.
- **Batch Transactions**: Executes a large number of inserts within a single transaction to minimize overhead and enhance performance.

Developers should ensure their database infrastructure is properly configured for high-speed writes. For complex data schemas or when loading the entire blockchain, it is recommended to initially load data without indexes and relationships to achieve faster loading times. Once the blockchain height is reached, developers can then create the necessary indexes and relationships separately and restart Loader to apply these schema optimizations.

## How to Run

### a) Running from Source

To run the project from source follow these steps:

1. **Prerequisites**: You will need [Node.js](https://nodejs.org/) v18 or higher.

2. **Clone the `bitcoin-loader` Repository**:

    ```bash
    git clone https://github.com/easylayer/bitcoin-loader.git
    ```

3. **Navigate to the Project Folder**:

    ```bash
    cd bitcoin-loader
    ```

4. **Install Packages**:

    ```bash
    yarn install
    ```

5. **Build All Packages**:

    ```bash
    yarn build:dev
    ```

6. **Find Example Applications**:

    - In the `examples` folder, there are example applications; look for those related to the loader.

7. **Create Your Own `.env` File** (for each example):

    - Update the `.env` file with your blockchain node URL or a Quicknode provider URL.

8. **Database Configuration**:

    - By default, SQLite is used without any configurations.
    - If you need PostgreSQL, specify the environment variables for PostgreSQL in the `.env` file.

9. **Run the Project**:

    - You can run the project either from the specific example folder or from the root folder.

### b) Creating Your Own Loader with `@easylayer/bitcoin-loader`
*Note: Detailed instructions and examples will be provided in future releases.*