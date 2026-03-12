# Neolution Desktop Wrapper

This wrapper now launches the **release shell** (`release/Neolution_SteamVerticalSlice.html`) instead of the raw prototype directly.

## Local run

```bash
cd desktop
npm install
npm run start
```

## Current purpose

- open the release-style front end
- preserve the browser prototype in an embedded frame
- provide the correct entry surface for future Steam packaging
- keep save data local through browser storage in the wrapper runtime

## Next build steps

1. swap localStorage save data to a file-backed save path
2. add native fullscreen toggle + settings bridge
3. attach Steamworks for achievements and cloud saves
4. package via electron-builder or Electron Forge
