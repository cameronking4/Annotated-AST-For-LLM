Greptile Clone: An Annotated AST for the purposes of providing LLM full context of code repository in single file
## Try POC
Use `main` branch if you're looking to generate an AI annotated AST for a local repository. Switch to `from-github` branch if you want to process an array of github repositories. 

`yarn install`

`node index.js`



## Overview
This document outlines the structure and script to generate a custom Abstract Syntax Tree (AST) for a given JavaScript / Typescript repository - for the purposes of sharing repo context with LLM. This custom AST provides a detailed representation of the files, their dependencies, and metadata, which is crucial for analysis and manipulation of the codebase for the purposes of Langchain Agent / OpenAI assistant vector memory. This is a scalable approach for sharing repo knowledge for an LLM as a single JSON file to light up "chat with Github" scenarios quickly.

## Novel AST Structure
Using this method will structure your repo in a nested JSON format, where each node represents a file or a module with its specific properties:

- **file**: The path to the file or module.
- **type**: The type of the file (e.g., JSON, JavaScript).
- **ast**: A recursive breakdown of the file’s contents, including metadata such as versions, dependencies, and other relevant details.
- **summary**: An AI generated summary of the file, the annotation!
- **sourceCode**: The source code itself for the file. (Optional)

## Usage
### Analysis
This can be uses a pre-processing step for exposing your source code and giving an LLM the full context of how your repo works. [Learn more]()

### Tool Integration
The AST can be integrated with tools for:
- **Static analysis**: Analyze code quality, security vulnerabilities, and coding standards compliance.
- **Dependency management**: Tools that automate dependency upgrades, ensuring that all dependencies are up to date and secure.
- **Custom scripts**: Write scripts that traverse the AST to automate specific tasks such as refactoring or identifying unused code.
