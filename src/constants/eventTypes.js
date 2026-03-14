const EventTypes = Object.freeze({
  ButtonLock: 1,       // Lock initiated via a physical button
  RemoteLock: 2,       // Lock initiated via a remote command
  SuccessKeyUnlock: 3,        // Unlock initiated with a key
  FailKeyUnlock: 4,           // Failed unlock attempt with a key
  ButtonUnlock: 5,     // Unlock initiated via a physical button
  RemoteUnlock: 6,     // Unlock initiated via a remote command
  Open: 7,             // Door open
  Close: 8,            // Door close
});

module.exports = { EventTypes };