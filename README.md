# Holy Grail test
*Simulate catastrophic database failure*

## Running the test
1. Clone this repo
2. Install the dependencies
3. Run `npm test`
4. Open two browser windows to `http://localhost:3000`

The tests should begin automatically.

## Tweaking the parameters
All test configuration is inside `panic.config.js` in the repo's root. For example, you can:

- Override which gun library path is used.
- Configure what ports are used.
- Where data is saved.
- What HTML page is served.

And bunches of other things. Read the comments for more details.
