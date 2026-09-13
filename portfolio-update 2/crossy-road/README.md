# Crossy Road MVP

## About the game 

I designed this game in pseudo-isometric view. I chose a chicken as the main character in the game. The UI is very simple and stripped down, and follows a simple and consistent color scheme. I think it's distinct from crossy roads in its visuals. I decided to keep a blocky, geometric design for the game with minimal ornamentation to reduce visual clutter.

## How to play

- Use the arrow keys or WASD to hop forward, backward, left, or right.
- Cross the roads while avoiding cars. Contact with a car while standing on a road ends the run. Falling too far behind the camera also ends the run.
- Your score is the furthest row reached during the current run; moving sideways or revisiting earlier rows does not add points.
- After game over, press a movement key to restart. The current implementation also accepts other keys.
- The best score lasts until the page is reloaded; it is not saved between visits.

## Running

Open `index.html` in a desktop browser with a keyboard. All game code, styles, and graphics are contained in that file. No installation, external assets, build step, or application server is needed.


## AI tools and development strategy

- Original development: Kiro Quick Spec and OpenAI Codex

- I started the project in Kiro, and was able to get a working version in a few prompts. However, after running into repeated UI glitches that Kiro was unable to fix, I moved the development to Codex, and was able to fix the glitches in one prompt. 

## Known limitations from source inspection

- Keyboard controls only; no touch controls.
- Roads and grass are implemented; rivers, logs, trains, and audio are not.
- Collision checks skip the hop animation, so the player can pass through a vehicle while hopping.
- The starting row is not generated, and backward movement can reach missing ground near the starting area.
- Restart does not clear a queued movement input.
- The fixed-size score and controls display may overlap on narrow screens.

