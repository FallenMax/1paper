# A quick cover of notepad.cc

https://1paper.at

## Features

- (Original) _notepad.cc ([discontinued](https://www.reddit.com/r/UsefulWebsites/comments/3wepc4/notepadcc_online_notepad_is_shutting_down_soon/))_ style and features
  - No login/register required, user can start writing right away
  - Open/create notes using `pathname` part of url
  - Save as you type
- Extras
  - **Real-time collaboration**, implemented using [Socket.IO] and [diff3] algorithm.
  - **Better list editing UX**
    - <kbd>Tab</kbd>: indent list item(s)
    - <kbd>Shift</kbd> + <kbd>Tab</kbd>: deindent list item(s)
    - <kbd>Enter</kbd>: new list item
    - <kbd>-</kbd>: turn selected block into list
    - ...More to be discovered

## Requirements

- [mongodb](https://www.mongodb.com/)

## Getting Started

```shell
# make sure you have mongodb running and configured accordingly
export MONGODB_URL=your-mongodb-url
export MONGODB_DATABASE=mongdo-database-to-use

pnpm install
pnpm start
```

[diff3]: https://en.wikipedia.org/wiki/Diff3
[socket.io]: https://socket.io/
