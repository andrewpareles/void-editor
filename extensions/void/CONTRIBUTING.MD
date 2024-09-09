
# TODOs

## Diffs
"Diffs" are the inline green/red highlights you see to approve/reject a change.

- Right now Diffs are shown as a green text decoration. Instead, we'd like to copy code from VS Code's native diffEditor ("inline" mode) to build Diffs. 

- Alternatively, we could improve diffs right now using `inline-diff-added-lines` and `inline-diff-removed-lines`.

- Diffs are not responsive to users editing the file right now. To make Diffs responsive, we should detect whether a user's change collides with a Diff (its range), and update the changed Diff's range appropriately. 

- **History:** ctrl+Z-ing after an approval/rejection should bring back the Diff.

- **Events:** 
- We should re-highlight all the Diffs after every user edit.
- When in doubt, reject all the current diffs. (user submitting a new chat message, clicking Apply again, etc).



## Core
- We need to migrate the helloworld extension as a native VS Code extension. There's initial work here at glass.contribution.ts.

- Allow access to the VS Code extension marketplace



## ctrl+l (chat)

- Allow user to accept / reject all Diffs in a whole file
- Allow user to make multiple selections of code and files at once



## ctrl+k (inline edits)

- Create a new input box that takes in the user's description
- Make it appear above each
- The input box should appear directly above the code selection - this requires using a Zone widget



## Ollama

- Ollama doesn't work now because its JS library depends on Node.js and uses imports like 'path', 'os', while extensions must be able to run in the browser. When we migrate the extension into the VS Code codebase, we'll be able to access Node.js and will uncomment the Ollama integration. 

## Greptile

- 

# Design principles

- Least amount of eye movement necessary; if user presses submit, show them the message where they submitted

## Naming conventions

- types: CamelCase

- variables and functions: camelCase

- private variables: _camelCase

# Run

To run/test this extension, run `npm run build` and then hit F5 (or hit the restart button if the extension is already running).

## Note on using React

VS Code does not support React out of the box. To get around this, we convert all of our React code into native javascript code at build time (`npm run build`). 

For example, the sidebar is written in React `sidebar/index.tsx` but compiled into `dist/sidebar/index.js` and `dist/sidebar/styles.css` on build.


