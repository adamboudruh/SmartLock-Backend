const EventTypes = Object.freeze({
  ButtonLock: 1,       // Lock initiated via a physical button
  RemoteLock: 2,       // Lock initiated via a remote command
  KeyUnlock: 3,        // Unlock initiated with a key
  RemoteUnlock: 4,     // Unlock initiated via a remote command
  Unlock: 5,           // General unlock event
  Open: 6,             // Door open
  Close: 7,            // Door close
  WhitelistSync: 8     // Whitelist sync
});

module.exports = { EventTypes };