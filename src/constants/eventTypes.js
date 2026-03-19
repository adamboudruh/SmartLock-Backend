const EventTypes = Object.freeze({
  ButtonLock: 1,       // Lock initiated via a physical button
  RemoteLock: 2,       // Lock initiated via a remote command
  AutoLock: 3,         // Auto-lock engaged after timeout
  SuccessKeyUnlock: 4,        // Unlock initiated with a key
  FailKeyUnlock: 5,           // Failed unlock attempt with a key
  ButtonUnlock: 6,     // Unlock initiated via a physical button
  RemoteUnlock: 7,     // Unlock initiated via a remote command
  Open: 8,             // Door open
  Close: 9,            // Door close
});

module.exports = { EventTypes };