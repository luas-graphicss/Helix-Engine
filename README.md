# Helix Engine

[Leia em português](README.pt-BR.md)

Helix is a 3D engine for the web with its own editor, written in TypeScript on top of Next.js. The idea is to have something close to a desktop game editor that opens in a browser tab. There is a viewport with transform gizmos, the scene hierarchy, an inspector for properties, an assets panel, a console and panels for environment, physics and performance.

Almost everything inside the engine folder was written from scratch, without a ready made 3D library. The renderer talks straight to WebGL and has its own shaders, shadows, sky, level of detail, culling and batching. There is a physics module with bodies, collision detection and a solver, and a terrain system split into chunks with procedural generation, materials, foliage and brushes to sculpt and paint the ground. The editor imports models in glTF, FBX, OBJ and STL, keeps an undo and redo history and has a play mode to test the scene without leaving the editor.

From the add menu you can place primitives, terrain, a directional light, ambient light, empty groups and cameras.

## How to use

You need Node.js and pnpm. Clone the repository, run pnpm install and then pnpm dev. The editor opens on the home page, at localhost on port 3000. For a production build run pnpm build and then pnpm start.

## Development time

So far Helix took three days of work. It is still in development, so a lot is missing and things can change from one commit to the next.

## License

GNU General Public License version 3. The full text is in the LICENSE file.
