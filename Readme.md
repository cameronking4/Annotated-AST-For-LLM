# Proof of Concept: Annotated AST for the purposes of LLM code repository context

`yarn install`

`node index.js`

## Overview
This document outlines the structure and script to generate a custom Abstract Syntax Tree (AST) for a given JavaScript / Typescript repository - for the purposes of sharing repo context with LLM. This custom AST provides a detailed representation of the files, their dependencies, and metadata, which is crucial for analysis and manipulation of the codebase for the purposes of Langchain Agent / OpenAI assistant vector memory. This is a scalable approach for sharing repo knowledge for an LLM as a single JSON file to light up "chat with Github" scenarios quickly.

## AST Structure
The AST is structured in a nested JSON format, where each node represents a file or a module with its specific properties:

- **file**: The path to the file or module.
- **type**: The type of the file (e.g., JSON, JavaScript).
- **ast**: A recursive breakdown of the file’s contents, including metadata such as versions, dependencies, and other relevant details.

Each node may contain the following attributes:

- **name**: The name of the package or module.
- **version**: The version number.
- **lockfileVersion**: Specific to npm lock files, indicating the lockfile version.
- **requires**: Boolean indicating whether the module requires other modules.
- **dependencies**: An object listing dependencies, structured similarly to the parent object.

## Usage
### Analysis
The AST can be used to analyze the structure of the project, including dependency analysis, license compliance checks, and upgrade recommendations. This helps in maintaining the health and security of the project.

### Tool Integration
The AST can be integrated with tools for:
- **Static analysis**: Analyze code quality, security vulnerabilities, and coding standards compliance.
- **Dependency management**: Tools that automate dependency upgrades, ensuring that all dependencies are up to date and secure.
- **Custom scripts**: Write scripts that traverse the AST to automate specific tasks such as refactoring or identifying unused code.
