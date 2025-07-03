## Project Standards

Consult this section to ensure your code contributions align with project requirements.

### Git Norms

-   **main**: Production-ready code. Never work here directly.
-   **develop**: Integration branch for features.
-   **feature/\***: Branches for new functionality.
-   **fix/\***: Branches for non-urgent bug fixes.
-   **hotfix/\***: Branches for urgent production fixes.

### Code Standards

-   **TypeScript:** Use explicit types (`string`, `number`) over `any`. Use `interface` for object shapes and `enum` for fixed value sets.
-   **Component Structure:** Keep Ink/React components focused on a single purpose.
-   **Error Handling:** Handle all promise rejections and provide meaningful error messages.
-   **Security:** Never commit secrets. Use environment variables. Validate and sanitize all user input.
-   **Performance:** Minimize API calls. Cache data where appropriate (e.g., container lists).
-   **Code Hygiene:** Maintain a clean codebase by removing dead code, unused imports, and orphaned files. Keep documentation synchronized with code changes.

## Core Mandate: The Feature Development Cycle

Your primary function is to implement features, fixes, and other code changes by adhering to the strict development cycle outlined below. This process is **NOT optional** and must be followed for every request that involves modifying the codebase.

### The Mandatory 4-Step Cycle

When a user requests a code change, you **MUST** follow this exact sequence:

#### **Step 1: Analyze & Clarify**

1.  **Understand the Goal:** Deconstruct the user's request to its core requirement.
2.  **Review Existing Code:** Identify relevant files, functions, and potential impact areas.
3.  **Create a detailed Todo list:** Consider the request thats been made, ensure that list of actions achieves the goals in the user's request. Make sure to use the context of the existing code you've just reviewed.
4.  **Clarify (If Necessary):** If the request is ambiguous, stop and ask up to **four** simple, targeted questions to ensure complete understanding. Examples:
    -   "What is the expected output for this command?"
    -   "How should errors be displayed to the user in this scenario?"
    -   "Does this new feature need to interact with the remote container management system?"

#### **Step 2: Prepare the Workspace (Git Branching)**

This step is critical for maintaining repository integrity.

1.  **First, ALWAYS check your current branch:**
    ```bash
    git branch --show-current
    ```
2.  **Commit Current Changes:**

    -   Commit the current changes in the branch to ensure a clean worktree before continuing.

3.  **Execute the correct branching action based on the result:**
    -   **IF** the current branch is `main` or `develop`: Create a new feature branch.
        ```bash
        # Ensure you have the latest code before branching
        git checkout main
        git pull origin main
        # Create a descriptive branch name
        git checkout -b feature/descriptive-feature-name
        ```
    -   **IF** the current branch is already a `feature/*` or `fix/*`: **DO NOT** create a new branch. Continue all work on the existing branch.

#### **Step 3: Implement & Verify**

1.  **Implement Changes:** Write the necessary code, strictly following the existing patterns and standards outlined in the reference section.
2.  **Clean Up Codebase:** During implementation, you **MUST**:
    -   **Remove Dead Code:** Delete any unused functions, variables, imports, or entire files that are no longer referenced.
    -   **Remove Orphaned Files:** Identify and delete files that have no imports or dependencies connecting them to the active codebase.
    -   **Update Documentation:** Ensure all documentation (README files, inline comments, API docs) accurately reflects the current state of the code. Remove outdated information and add missing documentation for new features.
3.  **Run Build Verification:** After implementing changes, you **MUST** run the build command and ensure it passes without any errors. This is a mandatory quality gate.
    ```bash
    npm run build
    ```
    -   If the build fails, you must fix all errors before proceeding.

#### **Step 4: Commit All Changes**

1.  **Stage All Files:** Add all modified and new files to the staging area.
    ```bash
    git add .
    ```
2.  **Commit with a Conventional Message:** Use a clear, conventional commit message that describes the changes.
    ```bash
    # Format: git commit -m "type: summary of changes"
    git commit -m "feat: add container log export functionality"
    ```
    -   **Commit Types:** `feat`, `fix`, `refactor`, `docs`, `style`, `test`.

## Valuable tool: Gemini CLI for Large Codebase Analysis

## When to Use the Gemini CLI

Use `gemini -p` when analyzing entire codebases, comparing large files, understanding project-wide patterns, or working with files that total more than 100KB. It's ideal for verifying if specific features, patterns, or security measures are implemented across many files, especially when other tools have insufficient context windows.

## Important Notes

-   Paths in `@` syntax are relative to your current working directory.
-   The CLI includes file contents directly in the context.
-   The `--yolo` flag is not needed for read-only analysis.
-   Gemini's context window can handle entire codebases that would overflow other models' context limits.
-   When checking implementations, be specific in your prompt to get the most accurate results.yoloneeded for read-only analysis.
-   Gemini's context window can handle entire codebases that would overflow other models' context limits.
-   When checking implementations, be specific in your prompt to get the most accurate results.

## File and Directory Inclusion

Use the `@` syntax to include files and directories in your prompts. Paths are relative to where you run the `gemini` command.

-   **Single file:** `gemini -p "@src/main.py Explain this file's purpose and structure"`
-   **Multiple files:** `gemini -p "@package.json @src/index.js Analyze the dependencies"`
-   **Entire directory:** `gemini -p "@src/ Summarize the architecture of this codebase"`
-   **Multiple directories:** `gemini -p "@src/ @tests/ Analyze test coverage for the source code"`
-   **Current directory:** `gemini -p "@./ Give me an overview of this entire project"`

Alternatively, use the `--all_files` flag to include everything in the current project: `gemini --all_files -p "Analyze the project structure and dependencies"`

## Implementation Verification Examples

-   **Check for a feature:** `gemini -p "@src/ @lib/ Has dark mode been implemented? Show the relevant files"`
-   **Verify authentication:** `gemini -p "@src/ @middleware/ Is JWT authentication implemented? List auth endpoints"`
-   **Find specific patterns:** `gemini -p "@src/ Are there React hooks that handle WebSockets? List them with paths"`
-   **Verify error handling:** `gemini -p "@src/ @api/ Is error handling implemented for all API endpoints? Show examples"`
-   **Check for rate limiting:** `gemini -p "@backend/ @middleware/ Is rate limiting implemented? Show the implementation"`
-   **Verify caching strategy:** `gemini -p "@src/ @lib/ Is Redis caching implemented? List cache-related functions"`
-   **Check security measures:** `gemini -p "@src/ @api/ Are SQL injection protections implemented? Show input sanitization"`
-   **Verify test coverage:** `gemini -p "@src/payment/ @tests/ Is the payment module fully tested? List test cases"`
